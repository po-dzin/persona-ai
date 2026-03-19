from fastapi.testclient import TestClient

from app.main import create_app


def test_packages_endpoint_exposes_5_tiers() -> None:
    app = create_app()
    client = TestClient(app)

    res = client.get("/v1/packages")
    assert res.status_code == 200
    payload = res.json()
    codes = [p["code"] for p in payload["packages"]]
    assert codes == ["STARTER", "BASIC", "POPULAR", "PRO", "ULTRA"]


def test_catalog_endpoints_styles_and_models() -> None:
    app = create_app()
    client = TestClient(app)

    styles = client.get("/v1/styles")
    models = client.get("/v1/models")

    assert styles.status_code == 200
    assert models.status_code == 200
    assert len(styles.json()["styles"]) >= 3
    assert len(models.json()["models"]) == 5


def test_paywall_then_purchase_then_resume() -> None:
    app = create_app()
    client = TestClient(app)

    user_id = "u-pay"

    up = client.post("/v1/uploads", json={"user_id": user_id, "filename": "a.jpg"}).json()
    order = client.post(
        "/v1/orders",
        json={
            "user_id": user_id,
            "style_code": "hollywood",
            "source_key": up["source_key"],
            "model_id": "nano-banana-v1",
        },
    ).json()["order"]

    # consume free credit
    first = client.post(f"/v1/orders/{order['order_id']}/start", json={"user_id": user_id}).json()
    assert first["result"] == "enqueued"

    # second order requires paywall
    up2 = client.post("/v1/uploads", json={"user_id": user_id, "filename": "b.jpg"}).json()
    order2 = client.post(
        "/v1/orders",
        json={
            "user_id": user_id,
            "style_code": "hollywood",
            "source_key": up2["source_key"],
            "model_id": "nano-banana-v1",
        },
    ).json()["order"]

    second = client.post(f"/v1/orders/{order2['order_id']}/start", json={"user_id": user_id}).json()
    assert second["result"] == "paywall_required"

    purchased = client.post(
        "/v1/purchase",
        json={"user_id": user_id, "package_code": "STARTER", "provider": "telegram"},
    )
    assert purchased.status_code == 200
    assert purchased.json()["wallet"]["paid_credits"] == 150

    resumed = client.post(f"/v1/orders/{order2['order_id']}/start", json={"user_id": user_id}).json()
    assert resumed["result"] == "enqueued"


def test_webhook_idempotency_no_double_credit() -> None:
    app = create_app()
    client = TestClient(app)

    user_id = "u-idem"
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
    wallet = client.get("/v1/me/balance", params={"user_id": user_id}).json()["wallet"]

    assert first.get("accepted") is True
    assert second.get("deduplicated") is True
    assert wallet["paid_credits"] == 350


def test_generate_and_provider_webhook_finalize_photo() -> None:
    app = create_app()
    client = TestClient(app)

    user_id = "u-photo"
    up = client.post("/v1/uploads", json={"user_id": user_id, "filename": "c.jpg"}).json()

    generated = client.post(
        "/v1/generate",
        json={
            "user_id": user_id,
            "source_key": up["source_key"],
            "model_id": "sd-3.5-turbo",
            "style_code": "cyberpunk",
            "aspect_ratio": "1:1",
        },
    ).json()

    order_id = generated["order"]["order_id"]

    finalized = client.post(
        "/v1/webhooks/stable_diffusion",
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

    photos = client.get("/v1/me/photos", params={"user_id": user_id}).json()["photos"]
    assert photos[0]["status"] == "done"
    assert photos[0]["result_url"] == "https://cdn.example.com/photo.jpg"
