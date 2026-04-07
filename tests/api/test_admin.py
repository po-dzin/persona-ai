"""
Tests for the admin API router (/admin/api/*).

Auth strategy in tests:
  - We use X-Admin-Token (static token fallback) since we cannot forge
    valid Telegram initData signatures without a real bot token.
  - TG-based auth path is covered by the unit test for require_admin.
"""
from __future__ import annotations

import os
from dataclasses import replace as dc_replace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.db import UserRow, OrderRow, PaymentRow, get_session
from app.main import create_app

ADMIN_TOKEN = "test-admin-secret"


def _client() -> TestClient:
    return TestClient(create_app())


def _admin_headers() -> dict[str, str]:
    return {"X-Admin-Token": ADMIN_TOKEN}


def _user_headers(user_id: str) -> dict[str, str]:
    return {"X-Dev-User-Id": user_id}


@pytest.fixture(autouse=True)
def patch_admin_token(monkeypatch):
    """Patch ADMIN_SECRET_TOKEN for every test in this module."""
    import app.routers.admin as admin_mod
    patched = dc_replace(admin_mod.settings, admin_secret_token=ADMIN_TOKEN)
    monkeypatch.setattr(admin_mod, "settings", patched)


# ─────────────────────── auth tests ──────────────────────────────

def test_admin_requires_auth():
    client = _client()
    res = client.get("/admin/api/overview")
    assert res.status_code == 401


def test_admin_rejects_wrong_token():
    client = _client()
    res = client.get("/admin/api/overview", headers={"X-Admin-Token": "wrong"})
    assert res.status_code == 401


def test_admin_rejects_non_admin_tg_user(monkeypatch):
    """A valid-looking TG init data for a non-admin user should be rejected."""
    import app.routers.admin as admin_mod
    import app.core.auth as auth_mod

    # Patch parse_tg_user to return a non-admin user without needing real HMAC
    monkeypatch.setattr(auth_mod, "_verify_init_data", lambda _: {"id": 999999999})
    # Patch admin_user_ids to NOT include that user
    patched = dc_replace(admin_mod.settings, admin_secret_token=ADMIN_TOKEN)
    monkeypatch.setattr(admin_mod, "settings", patched)
    monkeypatch.setattr(admin_mod.settings.__class__, "admin_user_ids",
                        property(lambda self: {"574824008"}))

    client = _client()
    res = client.get("/admin/api/overview",
                     headers={"X-Telegram-Init-Data": "fake_init_data"})
    assert res.status_code == 403
    assert res.json()["detail"] == "not_admin"


def test_admin_accepts_tg_init_data_for_admin_user(monkeypatch):
    """A valid TG init data for a known admin user should be accepted."""
    import app.routers.admin as admin_mod
    import app.core.auth as auth_mod

    monkeypatch.setattr(auth_mod, "_verify_init_data", lambda _: {"id": 574824008})
    monkeypatch.setattr(admin_mod.settings.__class__, "admin_user_ids",
                        property(lambda self: {"574824008"}))

    client = _client()
    res = client.get("/admin/api/overview",
                     headers={"X-Telegram-Init-Data": "fake_but_patched"})
    assert res.status_code == 200


# ─────────────────────── is_admin in profile ─────────────────────

def test_profile_is_admin_true_for_admin_user(monkeypatch):
    import app.services.vertical_slice as vs_mod
    patched = dc_replace(vs_mod.settings)
    monkeypatch.setattr(vs_mod.settings.__class__, "admin_user_ids",
                        property(lambda self: {"574824008", "admin-test-user"}))

    client = _client()
    res = client.get("/v1/me/profile", headers=_user_headers("admin-test-user"))
    assert res.status_code == 200
    assert res.json()["profile"]["is_admin"] is True


def test_profile_is_admin_false_for_regular_user(monkeypatch):
    monkeypatch.setattr(
        "app.services.vertical_slice.settings.__class__.admin_user_ids",
        property(lambda self: {"574824008"}),
    )

    client = _client()
    res = client.get("/v1/me/profile", headers=_user_headers("regular-user-99"))
    assert res.status_code == 200
    assert res.json()["profile"]["is_admin"] is False


# ─────────────────────── overview ────────────────────────────────

def test_admin_overview_empty_db():
    client = _client()
    res = client.get("/admin/api/overview?days=7", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()

    assert body["period_days"] == 7
    assert body["users"]["total"] == 0
    assert body["users"]["paying"] == 0
    assert body["users"]["conversion_pct"] == 0
    assert body["generations"]["period"]["total"] == 0
    assert body["revenue"]["period_stars"] == 0
    assert isinstance(body["queue"]["jobs"], dict)


def test_admin_overview_counts_users_and_generations():
    client = _client()
    # Create two users via the app
    client.get("/v1/me/balance", headers=_user_headers("u-ov-1"))
    client.get("/v1/me/balance", headers=_user_headers("u-ov-2"))

    res = client.get("/admin/api/overview?days=7", headers=_admin_headers())
    assert res.status_code == 200
    assert res.json()["users"]["total"] == 2


def test_admin_overview_counts_revenue(monkeypatch):
    import app.services.vertical_slice as vs_mod
    patched = dc_replace(vs_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vs_mod, "settings", patched)

    client = _client()
    client.get("/v1/me/balance", headers=_user_headers("u-ov-pay"))
    client.post("/v1/purchase",
                json={"package_code": "BASIC", "provider": "telegram"},
                headers=_user_headers("u-ov-pay"))

    res = client.get("/admin/api/overview?days=7", headers=_admin_headers())
    assert res.status_code == 200
    # BASIC costs 399 stars
    assert res.json()["revenue"]["period_stars"] == 399
    assert res.json()["users"]["paying"] == 1


# ─────────────────────── timeseries ──────────────────────────────

def test_admin_timeseries_returns_lists():
    client = _client()
    res = client.get("/admin/api/timeseries?days=7", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()
    assert "users" in body
    assert "orders" in body
    assert "revenue" in body
    assert isinstance(body["users"], list)
    assert isinstance(body["orders"], list)
    assert isinstance(body["revenue"], list)


# ─────────────────────── revenue ─────────────────────────────────

def test_admin_revenue_structure(monkeypatch):
    import app.services.vertical_slice as vs_mod
    patched = dc_replace(vs_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vs_mod, "settings", patched)

    client = _client()
    client.get("/v1/me/balance", headers=_user_headers("u-rev-1"))
    client.post("/v1/purchase",
                json={"package_code": "STARTER", "provider": "telegram"},
                headers=_user_headers("u-rev-1"))

    res = client.get("/admin/api/revenue?days=30", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()

    assert body["totals"]["stars"] == 199  # STARTER = 199 stars
    assert body["totals"]["payments"] == 1
    assert body["totals"]["paying_users"] == 1
    assert len(body["by_package"]) >= 1
    assert body["by_package"][0]["package_code"] in ("STARTER", "STARTER_STARS")
    assert len(body["recent"]) >= 1


# ─────────────────────── generations ─────────────────────────────

def test_admin_generations_structure():
    client = _client()
    # Create one order via generate
    up = client.post("/v1/uploads", json={"filename": "g.jpg"},
                     headers=_user_headers("u-gen-admin")).json()
    client.post("/v1/generate",
                json={"source_key": up["source_key"], "model_id": "nano-banana-v1",
                      "style_code": "hollywood", "aspect_ratio": "1:1"},
                headers=_user_headers("u-gen-admin"))

    res = client.get("/admin/api/generations?days=7", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()

    assert "by_status" in body
    assert "top_styles" in body
    assert "by_model" in body
    assert "recent_failed" in body
    assert isinstance(body["top_styles"], list)
    assert isinstance(body["by_model"], list)

    # The order we created should appear in by_status
    total = sum(body["by_status"].values())
    assert total >= 1

    # hollywood style should appear in top_styles
    style_codes = [s["style_code"] for s in body["top_styles"]]
    assert "hollywood" in style_codes


# ─────────────────────── users list ──────────────────────────────

def test_admin_users_list_pagination():
    client = _client()
    for i in range(5):
        client.get("/v1/me/balance", headers=_user_headers(f"u-list-{i}"))

    res = client.get("/admin/api/users?limit=10", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()

    assert body["total"] >= 5
    assert body["page"] == 1
    assert isinstance(body["users"], list)
    assert len(body["users"]) >= 5

    user = body["users"][0]
    assert "user_id" in user
    assert "paid_credits" in user
    assert "gens_done" in user
    assert "total_stars" in user


def test_admin_users_list_filter_paying(monkeypatch):
    import app.services.vertical_slice as vs_mod
    patched = dc_replace(vs_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vs_mod, "settings", patched)

    client = _client()
    client.get("/v1/me/balance", headers=_user_headers("u-free-only"))
    client.get("/v1/me/balance", headers=_user_headers("u-paid-only"))
    client.post("/v1/purchase",
                json={"package_code": "STARTER", "provider": "telegram"},
                headers=_user_headers("u-paid-only"))

    res = client.get("/admin/api/users?filter=paying", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()
    user_ids = [u["user_id"] for u in body["users"]]
    assert "u-paid-only" in user_ids
    assert "u-free-only" not in user_ids


def test_admin_users_search():
    client = _client()
    # Create a user with a known first_name (via profile)
    client.get("/v1/me/profile", headers={
        **_user_headers("u-search-target"),
        "X-Telegram-Init-Data": "",  # will use dev header fallback
    })

    res = client.get("/admin/api/users?search=u-search-target", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()
    assert any(u["user_id"] == "u-search-target" for u in body["users"])


# ─────────────────────── user detail ─────────────────────────────

def test_admin_user_detail_not_found():
    client = _client()
    res = client.get("/admin/api/users/nonexistent-user-xyz", headers=_admin_headers())
    assert res.status_code == 404


def test_admin_user_detail_full_profile(monkeypatch):
    import app.services.vertical_slice as vs_mod
    patched = dc_replace(vs_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vs_mod, "settings", patched)

    client = _client()
    hdrs = _user_headers("u-detail-test")

    # Create user + generation + purchase
    client.get("/v1/me/balance", headers=hdrs)
    up = client.post("/v1/uploads", json={"filename": "d.jpg"}, headers=hdrs).json()
    client.post("/v1/generate",
                json={"source_key": up["source_key"], "model_id": "nano-banana-v1",
                      "style_code": "anime", "aspect_ratio": "1:1"},
                headers=hdrs)
    client.post("/v1/purchase",
                json={"package_code": "BASIC", "provider": "telegram"},
                headers=hdrs)

    res = client.get("/admin/api/users/u-detail-test", headers=_admin_headers())
    assert res.status_code == 200
    body = res.json()

    assert body["user"]["user_id"] == "u-detail-test"
    assert body["stats"]["total_orders"] >= 1
    assert body["stats"]["total_stars_paid"] == 399  # BASIC = 399 stars
    assert len(body["orders"]) >= 1
    assert len(body["payments"]) >= 1

    order = body["orders"][0]
    assert "order_id" in order
    assert "status" in order
    assert "model_id" in order

    payment = body["payments"][0]
    assert payment["package_code"] == "BASIC"
    assert payment["amount"] == 399
