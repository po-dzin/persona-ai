from fastapi.testclient import TestClient

from app.core.db import UserRow, get_session
from app.main import create_app


def _client():
    return TestClient(create_app())


def _headers(user_id: str) -> dict[str, str]:
    return {"X-Dev-User-Id": user_id}


def _ensure_user(client: TestClient, user_id: str) -> None:
    """Hit balance endpoint to auto-create the user row."""
    client.get("/v1/me/balance", headers=_headers(user_id))


def _seed_balance(user_id: str, paid_credits: int) -> None:
    """Directly set paid_credits for test setup (call after _ensure_user)."""
    with get_session() as db:
        user = db.get(UserRow, user_id)
        if user is None:
            raise RuntimeError(f"User {user_id!r} not found — call _ensure_user first")
        user.paid_credits = paid_credits
        db.commit()


def test_healthz_reports_ok() -> None:
    client = _client()
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_packages_endpoint_exposes_5_tiers() -> None:
    client = _client()
    res = client.get("/v1/packages")
    assert res.status_code == 200
    payload = res.json()
    codes = [p["code"] for p in payload["packages"]]
    assert codes == ["STARTER", "BASIC", "POPULAR", "PRO", "ULTRA"]


def test_packages_expose_bonus_percent() -> None:
    client = _client()
    packages = {p["code"]: p for p in client.get("/v1/packages").json()["packages"]}
    assert packages["STARTER"]["bonus_percent"] == 0
    assert packages["BASIC"]["bonus_percent"] == 5
    assert packages["POPULAR"]["bonus_percent"] == 10
    assert packages["PRO"]["bonus_percent"] == 15
    assert packages["ULTRA"]["bonus_percent"] == 20

def test_packages_expose_bonus_coins() -> None:
    client = _client()
    packages = {p["code"]: p for p in client.get("/v1/packages").json()["packages"]}
    assert packages["STARTER"]["bonus_coins"] == 0
    assert packages["BASIC"]["bonus_coins"] == 20
    assert packages["POPULAR"]["bonus_coins"] == 80
    assert packages["PRO"]["bonus_coins"] == 300
    assert packages["ULTRA"]["bonus_coins"] == 1000


def test_catalog_endpoints_styles_and_models() -> None:
    client = _client()
    styles = client.get("/v1/styles")
    models = client.get("/v1/models")

    assert styles.status_code == 200
    assert models.status_code == 200
    assert len(styles.json()["styles"]) >= 100
    model_rows = models.json()["models"]
    assert len(model_rows) == 11
    by_id = {row["id"]: row for row in model_rows}
    assert by_id["nb2-1k"]["coins"] == 10
    assert by_id["nb2-2k"]["coins"] == 15
    assert by_id["nb2-4k"]["coins"] == 22
    assert by_id["nb-pro-2k"]["coins"] == 20
    assert by_id["nb-pro-4k"]["coins"] == 35
    assert by_id["flux2-pro-1k"]["coins"] == 7
    assert by_id["flux2-pro-2k"]["coins"] == 14
    assert by_id["flux2-pro-4k"]["coins"] == 27
    assert by_id["flux2-max-1k"]["coins"] == 12
    assert by_id["flux2-max-2k"]["coins"] == 22
    assert by_id["flux2-max-4k"]["coins"] == 42
    first_style = styles.json()["styles"][0]
    assert "prompt_template" in first_style
    assert "prompt_spec" in first_style
    assert "stylization_level" in first_style
    assert "style_anchors" in first_style
    assert "variation_axes" in first_style


def test_paywall_then_purchase_then_resume() -> None:
    client = _client()
    user_id = "u-pay"
    hdrs = _headers(user_id)

    # Create user then seed to exactly 10 coins (one v1 generation at 10 coins)
    _ensure_user(client, user_id)
    _seed_balance(user_id, 10)

    up = client.post("/v1/uploads", json={"filename": "a.jpg"}, headers=hdrs).json()
    order = client.post(
        "/v1/orders",
        json={"style_code": "hollywood", "source_key": up["source_key"], "model_id": "nb2-1k"},
        headers=hdrs,
    ).json()["order"]

    # spend the 10 coins
    first = client.post(f"/v1/orders/{order['order_id']}/start", json={}, headers=hdrs).json()
    assert first["result"] == "enqueued"

    # second order requires paywall (0 coins left)
    up2 = client.post("/v1/uploads", json={"filename": "b.jpg"}, headers=hdrs).json()
    order2 = client.post(
        "/v1/orders",
        json={"style_code": "hollywood", "source_key": up2["source_key"], "model_id": "nb2-1k"},
        headers=hdrs,
    ).json()["order"]

    second = client.post(f"/v1/orders/{order2['order_id']}/start", json={}, headers=hdrs).json()
    assert second["result"] == "paywall_required"

    purchased = client.post(
        "/v1/purchase",
        json={"package_code": "STARTER", "provider": "telegram"},
        headers=hdrs,
    )
    assert purchased.status_code == 200
    # STARTER has 0% bonus → exactly 150 coins
    assert purchased.json()["wallet"]["paid_credits"] == 150

    resumed = client.post(f"/v1/orders/{order2['order_id']}/start", json={}, headers=hdrs).json()
    assert resumed["result"] == "enqueued"


def test_purchase_basic_applies_volume_bonus() -> None:
    """BASIC package must credit exactly 370 coins (base + bonus) on top of existing balance."""
    client = _client()
    hdrs = _headers("u-basic-bonus")

    before = client.get("/v1/me/balance", headers=hdrs).json()["wallet"]["paid_credits"]
    res = client.post(
        "/v1/purchase",
        json={"package_code": "BASIC", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 200
    assert res.json()["wallet"]["paid_credits"] == before + 370


def test_purchase_rejects_legacy_package_code() -> None:
    client = _client()
    hdrs = _headers("u-legacy-api")

    res = client.post(
        "/v1/purchase",
        json={"package_code": "STARTER_STARS", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "package_not_found"


def test_purchase_invoice_returns_invoice_link_even_in_demo_mode(monkeypatch) -> None:
    from dataclasses import replace as dc_replace
    import app.routers.v1 as v1_mod
    import app.services.tg_bot as tg_bot_mod

    patched_settings = dc_replace(
        v1_mod.settings,
        free_demo_mode=True,
        telegram_bot_token="demo-token-enabled",
    )
    monkeypatch.setattr(v1_mod, "settings", patched_settings)
    monkeypatch.setattr(tg_bot_mod, "settings", patched_settings)
    monkeypatch.setattr(tg_bot_mod, "create_invoice_link", lambda _package_code: "https://t.me/invoice/demo")

    client = _client()
    hdrs = _headers("u-demo-invoice")

    res = client.post(
        "/v1/purchase/invoice",
        json={"package_code": "STARTER", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["invoice_link"] == "https://t.me/invoice/demo"


def test_demo_mode_test_package_gives_1000_credits(monkeypatch) -> None:
    from dataclasses import replace as dc_replace
    import app.services.vertical_slice as vertical_slice_mod

    patched_settings = dc_replace(vertical_slice_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vertical_slice_mod, "settings", patched_settings)

    client = _client()
    hdrs = _headers("u-api-test-package")

    before = client.get("/v1/me/balance", headers=hdrs).json()["wallet"]["paid_credits"]
    res = client.post(
        "/v1/purchase",
        json={"package_code": "TEST", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 200
    assert res.json()["wallet"]["paid_credits"] == before + 1000


def test_webhook_idempotency_no_double_credit() -> None:
    import math
    client = _client()
    user_id = "u-idem"
    hdrs = _headers(user_id)

    before = client.get("/v1/me/balance", headers=hdrs).json()["wallet"]["paid_credits"]

    event = {
        "event_id": "pay-evt-dup",
        "payload": {
            "payment_id": "p-dup",
            "user_id": user_id,
            "package_code": "BASIC",
            "status": "paid",
            "amount": 537,
        },
    }

    first = client.post("/v1/webhooks/telegram", json=event).json()
    second = client.post("/v1/webhooks/telegram", json=event).json()
    wallet = client.get("/v1/me/balance", headers=hdrs).json()["wallet"]

    assert first.get("accepted") is True
    assert second.get("deduplicated") is True
    # BASIC: 350 base + 20 bonus = 370 coins — credited exactly once regardless of duplicate webhook
    assert wallet["paid_credits"] == before + 370


def test_generate_and_provider_webhook_finalize_photo() -> None:
    client = _client()
    user_id = "u-photo"
    hdrs = _headers(user_id)

    up = client.post("/v1/uploads", json={"filename": "c.jpg"}, headers=hdrs).json()

    generated = client.post(
        "/v1/generate",
        json={
            "source_key": up["source_key"],
            "model_id": "nb2-1k",
            "style_code": "cyberpunk",
            "aspect_ratio": "1:1",
        },
        headers=hdrs,
    ).json()

    order_id = generated["order"]["order_id"]

    finalized = client.post(
        "/v1/webhooks/nano_banana",
        json={
            "event_id": "evt-done-1",
            "payload": {
                "order_id": order_id,
                "event_type": "done",
                "result_url": "https://cdn.example.com/photo.jpg",
            },
        },
    )
    assert finalized.status_code == 200

    photos = client.get("/v1/me/photos", headers=hdrs).json()["photos"]
    assert photos[0]["status"] == "done"
    assert photos[0]["result_url"] == "https://cdn.example.com/photo.jpg"


def test_generation_webhook_duplicate_event_id_is_deduplicated() -> None:
    client = _client()
    user_id = "u-webhook-dedup"
    hdrs = _headers(user_id)

    up = client.post("/v1/uploads", json={"filename": "dup.jpg"}, headers=hdrs).json()
    generated = client.post(
        "/v1/generate",
        json={
            "source_key": up["source_key"],
            "model_id": "nb2-1k",
            "style_code": "cyberpunk",
            "aspect_ratio": "1:1",
        },
        headers=hdrs,
    ).json()
    order_id = generated["order"]["order_id"]

    payload = {
        "event_id": "evt-gen-dedup-1",
        "payload": {
            "order_id": order_id,
            "event_type": "done",
            "result_url": "https://cdn.example.com/dedup.jpg",
        },
    }
    first = client.post("/v1/webhooks/nano_banana", json=payload)
    second = client.post("/v1/webhooks/nano_banana", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json().get("accepted") is True
    assert second.json().get("deduplicated") is True


def test_generation_webhook_out_of_order_processing_does_not_reopen_done() -> None:
    client = _client()
    user_id = "u-webhook-ooo"
    hdrs = _headers(user_id)

    up = client.post("/v1/uploads", json={"filename": "ooo.jpg"}, headers=hdrs).json()
    generated = client.post(
        "/v1/generate",
        json={
            "source_key": up["source_key"],
            "model_id": "nb2-1k",
            "style_code": "anime",
            "aspect_ratio": "1:1",
        },
        headers=hdrs,
    ).json()
    order_id = generated["order"]["order_id"]

    done = client.post(
        "/v1/webhooks/nano_banana",
        json={
            "event_id": "evt-ooo-done-api",
            "payload": {
                "order_id": order_id,
                "event_type": "done",
                "result_url": "https://cdn.example.com/ooo.jpg",
            },
        },
    )
    late_processing = client.post(
        "/v1/webhooks/nano_banana",
        json={
            "event_id": "evt-ooo-processing-api",
            "payload": {
                "order_id": order_id,
                "event_type": "processing",
            },
        },
    )
    assert done.status_code == 200
    assert late_processing.status_code == 200
    order = client.get(f"/v1/orders/{order_id}", headers=hdrs).json()["order"]
    assert order["status"] == "done"
    assert order["result_url"] == "https://cdn.example.com/ooo.jpg"


def test_generate_accepts_camel_case_payload_fields() -> None:
    client = _client()
    user_id = "u-camel-generate"
    hdrs = _headers(user_id)

    up = client.post("/v1/uploads", json={"filename": "camel.jpg"}, headers=hdrs).json()

    generated = client.post(
        "/v1/generate",
        json={
            "sourceKey": up["source_key"],
            "modelId": "nb2-1k",
            "styleCode": "anime",
            "aspectRatio": "3:4",
        },
        headers=hdrs,
    )
    assert generated.status_code == 200
    payload = generated.json()
    assert payload["result"] == "enqueued"
    assert payload["order"]["model_id"] == "nb2-1k"
    assert payload["order"]["source_key"] == up["source_key"]


def test_upload_rejects_invalid_file_type() -> None:
    client = _client()
    hdrs = _headers("u-filetype")

    res = client.post("/v1/uploads", json={"filename": "virus.exe"}, headers=hdrs)
    assert res.status_code == 400
    assert "invalid_file_type" in res.text

    # Valid types still work
    for valid in ("photo.jpg", "photo.jpeg", "photo.png", "photo.webp"):
        res = client.post("/v1/uploads", json={"filename": valid}, headers=hdrs)
        assert res.status_code == 200, f"Expected 200 for {valid}"


def test_order_access_forbidden_for_other_user() -> None:
    client = _client()
    owner_hdrs = _headers("u-owner")
    other_hdrs = _headers("u-other")

    up = client.post("/v1/uploads", json={"filename": "a.jpg"}, headers=owner_hdrs).json()
    order = client.post(
        "/v1/orders",
        json={"style_code": "hollywood", "source_key": up["source_key"], "model_id": "nb2-1k"},
        headers=owner_hdrs,
    ).json()["order"]
    order_id = order["order_id"]

    # Owner can access
    res_owner = client.get(f"/v1/orders/{order_id}", headers=owner_hdrs)
    assert res_owner.status_code == 200

    # Other user gets 403
    res_other = client.get(f"/v1/orders/{order_id}", headers=other_hdrs)
    assert res_other.status_code == 403


def test_delete_photo_removes_it_from_user_gallery() -> None:
    client = _client()
    hdrs = _headers("u-delete-photo")

    up = client.post("/v1/uploads", json={"filename": "d.jpg"}, headers=hdrs).json()
    generated = client.post(
        "/v1/generate",
        json={
            "source_key": up["source_key"],
            "model_id": "nb2-1k",
            "style_code": "hollywood",
            "aspect_ratio": "1:1",
        },
        headers=hdrs,
    ).json()
    order_id = generated["order"]["order_id"]

    finalized = client.post(
        "/v1/webhooks/nano_banana",
        json={
            "event_id": "evt-delete-1",
            "payload": {
                "order_id": order_id,
                "event_type": "done",
                "result_url": "https://cdn.example.com/delete-me.jpg",
            },
        },
    )
    assert finalized.status_code == 200

    before = client.get("/v1/me/photos", headers=hdrs).json()["photos"]
    assert any(p["order_id"] == order_id for p in before)

    deleted = client.delete(f"/v1/me/photos/{order_id}", headers=hdrs)
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    after = client.get("/v1/me/photos", headers=hdrs).json()["photos"]
    assert all(p["order_id"] != order_id for p in after)


def test_webhook_hmac_rejects_wrong_secret(monkeypatch) -> None:
    from dataclasses import replace as dc_replace
    from app.core.settings import settings as base_settings
    import app.routers.v1 as v1_mod

    # Patch the settings object used inside v1.py with one that has a secret
    patched = dc_replace(base_settings, provider_webhook_secret="correct-secret")
    monkeypatch.setattr(v1_mod, "settings", patched)

    client = _client()
    event = {"event_id": "e1", "payload": {"order_id": "x", "event_type": "done"}}

    # Wrong secret → 403
    res = client.post(
        "/v1/webhooks/flux",
        json=event,
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert res.status_code == 403

    # No secret → also 403
    res2 = client.post("/v1/webhooks/flux", json=event)
    assert res2.status_code == 403

    # Correct secret → accepted (no matching order, so ignored — but not 403)
    res3 = client.post(
        "/v1/webhooks/flux",
        json=event,
        headers={"X-Webhook-Secret": "correct-secret"},
    )
    assert res3.status_code == 200


def test_profile_endpoint_returns_real_stats() -> None:
    client = _client()
    hdrs = _headers("u-profile")

    # Fresh user: 20 welcome coins, 0 generations
    profile = client.get("/v1/me/profile", headers=hdrs).json()["profile"]
    assert profile["generations_count"] == 0
    assert profile["paid_credits"] == 20

    # Create and start an order (costs 10 paid coins for nb2-1k)
    up = client.post("/v1/uploads", json={"filename": "p.jpg"}, headers=hdrs).json()
    order = client.post(
        "/v1/orders",
        json={"style_code": "hollywood", "source_key": up["source_key"], "model_id": "nb2-1k"},
        headers=hdrs,
    ).json()["order"]
    client.post(f"/v1/orders/{order['order_id']}/start", json={}, headers=hdrs)

    profile2 = client.get("/v1/me/profile", headers=hdrs).json()["profile"]
    assert profile2["generations_count"] == 1
    assert profile2["paid_credits"] == 10  # 20 welcome coins − 10 for v1
