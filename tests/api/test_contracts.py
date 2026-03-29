from fastapi.testclient import TestClient

from app.main import create_app


def _client():
    return TestClient(create_app())


def _headers(user_id: str) -> dict[str, str]:
    return {"X-Dev-User-Id": user_id}


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
    assert packages["PRO"]["bonus_percent"] == 18
    assert packages["ULTRA"]["bonus_percent"] == 25


def test_catalog_endpoints_styles_and_models() -> None:
    client = _client()
    styles = client.get("/v1/styles")
    models = client.get("/v1/models")

    assert styles.status_code == 200
    assert models.status_code == 200
    assert len(styles.json()["styles"]) >= 3
    assert len(models.json()["models"]) == 2


def test_paywall_then_purchase_then_resume() -> None:
    client = _client()
    user_id = "u-pay"
    hdrs = _headers(user_id)

    up = client.post("/v1/uploads", json={"filename": "a.jpg"}, headers=hdrs).json()
    order = client.post(
        "/v1/orders",
        json={"style_code": "hollywood", "source_key": up["source_key"], "model_id": "nano-banana-v1"},
        headers=hdrs,
    ).json()["order"]

    # consume free credit
    first = client.post(f"/v1/orders/{order['order_id']}/start", json={}, headers=hdrs).json()
    assert first["result"] == "enqueued"

    # second order requires paywall
    up2 = client.post("/v1/uploads", json={"filename": "b.jpg"}, headers=hdrs).json()
    order2 = client.post(
        "/v1/orders",
        json={"style_code": "hollywood", "source_key": up2["source_key"], "model_id": "nano-banana-v1"},
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
    """BASIC package must credit 350 + 5% = 368 coins."""
    import math
    client = _client()
    hdrs = _headers("u-basic-bonus")

    res = client.post(
        "/v1/purchase",
        json={"package_code": "BASIC", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 200
    expected = 350 + math.ceil(350 * 5 / 100)
    assert res.json()["wallet"]["paid_credits"] == expected


def test_purchase_accepts_legacy_package_code() -> None:
    client = _client()
    hdrs = _headers("u-legacy-api")

    res = client.post(
        "/v1/purchase",
        json={"package_code": "STARTER_STARS", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 200
    assert res.json()["wallet"]["paid_credits"] == 150


def test_purchase_invoice_uses_demo_mode_even_with_bot_token(monkeypatch) -> None:
    from dataclasses import replace as dc_replace
    import app.routers.v1 as v1_mod
    import app.services.vertical_slice as vertical_slice_mod

    patched_settings = dc_replace(
        v1_mod.settings,
        free_demo_mode=True,
        telegram_bot_token="demo-token-enabled",
    )
    monkeypatch.setattr(v1_mod, "settings", patched_settings)
    monkeypatch.setattr(vertical_slice_mod, "settings", patched_settings)

    client = _client()
    hdrs = _headers("u-demo-invoice")

    res = client.post(
        "/v1/purchase/invoice",
        json={"package_code": "STARTER", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 200
    payload = res.json()
    assert "invoice_link" not in payload
    assert payload["wallet"]["paid_credits"] == 150


def test_demo_mode_test_package_gives_1000_credits(monkeypatch) -> None:
    from dataclasses import replace as dc_replace
    import app.services.vertical_slice as vertical_slice_mod

    patched_settings = dc_replace(vertical_slice_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vertical_slice_mod, "settings", patched_settings)

    client = _client()
    hdrs = _headers("u-api-test-package")

    res = client.post(
        "/v1/purchase",
        json={"package_code": "TEST", "provider": "telegram"},
        headers=hdrs,
    )
    assert res.status_code == 200
    assert res.json()["wallet"]["paid_credits"] == 1000


def test_webhook_idempotency_no_double_credit() -> None:
    client = _client()
    user_id = "u-idem"
    hdrs = _headers(user_id)

    event = {
        "event_id": "pay-evt-dup",
        "payload": {
            "payment_id": "p-dup",
            "user_id": user_id,
            "package_code": "BASIC",
            "status": "paid",
            "amount": 399,
        },
    }

    first = client.post("/v1/webhooks/telegram", json=event).json()
    second = client.post("/v1/webhooks/telegram", json=event).json()
    wallet = client.get("/v1/me/balance", headers=hdrs).json()["wallet"]

    assert first.get("accepted") is True
    assert second.get("deduplicated") is True
    # BASIC: 350 + 5% = 368 coins
    import math
    assert wallet["paid_credits"] == 350 + math.ceil(350 * 5 / 100)


def test_generate_and_provider_webhook_finalize_photo() -> None:
    client = _client()
    user_id = "u-photo"
    hdrs = _headers(user_id)

    up = client.post("/v1/uploads", json={"filename": "c.jpg"}, headers=hdrs).json()

    generated = client.post(
        "/v1/generate",
        json={
            "source_key": up["source_key"],
            "model_id": "nano-banana-v1",
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
        json={"style_code": "hollywood", "source_key": up["source_key"], "model_id": "nano-banana-v1"},
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
            "model_id": "nano-banana-v1",
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
        "/v1/webhooks/stable_diffusion",
        json=event,
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert res.status_code == 403

    # No secret → also 403
    res2 = client.post("/v1/webhooks/stable_diffusion", json=event)
    assert res2.status_code == 403

    # Correct secret → accepted (no matching order, so ignored — but not 403)
    res3 = client.post(
        "/v1/webhooks/stable_diffusion",
        json=event,
        headers={"X-Webhook-Secret": "correct-secret"},
    )
    assert res3.status_code == 200


def test_profile_endpoint_returns_real_stats() -> None:
    client = _client()
    hdrs = _headers("u-profile")

    # Fresh user: 0 generations
    profile = client.get("/v1/me/profile", headers=hdrs).json()["profile"]
    assert profile["generations_count"] == 0
    assert profile["paid_credits"] == 0
    assert profile["free_credit_available"] is True

    # Create and start an order (uses free credit)
    up = client.post("/v1/uploads", json={"filename": "p.jpg"}, headers=hdrs).json()
    order = client.post(
        "/v1/orders",
        json={"style_code": "hollywood", "source_key": up["source_key"], "model_id": "nano-banana-v1"},
        headers=hdrs,
    ).json()["order"]
    client.post(f"/v1/orders/{order['order_id']}/start", json={}, headers=hdrs)

    profile2 = client.get("/v1/me/profile", headers=hdrs).json()["profile"]
    assert profile2["generations_count"] == 1
    assert profile2["free_credit_available"] is False
