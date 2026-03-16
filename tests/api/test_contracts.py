from fastapi.testclient import TestClient

from app.main import create_app


def test_packages_endpoint_exposes_3_tiers() -> None:
    app = create_app()
    client = TestClient(app)

    res = client.get("/v1/packages")
    assert res.status_code == 200
    payload = res.json()
    codes = [p["code"] for p in payload["packages"]]
    assert codes == ["S", "M", "L"]


def test_paywall_then_payment_then_resume() -> None:
    app = create_app()
    client = TestClient(app)

    user_id = "u-pay"

    up = client.post("/v1/uploads", json={"user_id": user_id, "filename": "a.jpg"}).json()
    order = client.post(
        "/v1/orders",
        json={"user_id": user_id, "style_code": "natural", "source_key": up["source_key"]},
    ).json()["order"]

    # consume free credit
    first = client.post(f"/v1/orders/{order['order_id']}/start", json={"user_id": user_id}).json()
    assert first["result"] == "enqueued"

    # second order requires paywall
    up2 = client.post("/v1/uploads", json={"user_id": user_id, "filename": "b.jpg"}).json()
    order2 = client.post(
        "/v1/orders",
        json={"user_id": user_id, "style_code": "natural", "source_key": up2["source_key"]},
    ).json()["order"]

    second = client.post(f"/v1/orders/{order2['order_id']}/start", json={"user_id": user_id}).json()
    assert second["result"] == "paywall_required"

    # mock payment webhook adds credits
    paid = client.post(
        "/v1/webhooks/telegram",
        json={
            "event_id": "pay-evt-1",
            "payload": {
                "payment_id": "p-1",
                "user_id": user_id,
                "package_code": "S",
                "status": "paid",
            },
        },
    )
    assert paid.status_code == 200

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
            "package_code": "M",
            "status": "paid",
        },
    }

    first = client.post("/v1/webhooks/telegram", json=event).json()
    second = client.post("/v1/webhooks/telegram", json=event).json()

    assert first.get("accepted") is True
    assert second.get("deduplicated") is True
