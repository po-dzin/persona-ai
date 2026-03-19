from app.services.vertical_slice import VerticalSliceService


DEFAULT_MODEL = "nano-banana-v1"


def create_order(svc: VerticalSliceService, user_id: str = "u1", model_id: str = DEFAULT_MODEL) -> str:
    upload = svc.register_upload(user_id=user_id, filename="photo.jpg")
    order = svc.create_order(
        user_id=user_id,
        style_code="hollywood",
        source_key=upload["source_key"],
        model_id=model_id,
    )
    return order.order_id


def test_free_generation_is_one_time_per_user() -> None:
    svc = VerticalSliceService()

    order_1 = create_order(svc)
    result_1 = svc.start_order(order_1)
    assert result_1["result"] == "enqueued"
    assert result_1["order"]["is_free_credit_used"] is True

    order_2 = create_order(svc)
    result_2 = svc.start_order(order_2)
    assert result_2["result"] == "paywall_required"


def test_paid_credit_spend_and_technical_refund() -> None:
    svc = VerticalSliceService()
    user = svc.get_or_create_user("u1")
    user.free_credit_available = False
    user.paid_credits = 30

    order_id = create_order(svc, model_id="gpt-image-1.5")
    started = svc.start_order(order_id)
    assert started["result"] == "enqueued"
    assert started["wallet"]["paid_credits"] == 0

    out = svc.ingest_webhook(
        "openai_image",
        event_id="evt-tech-1",
        payload={"order_id": order_id, "event_type": "technical_failed"},
    )
    assert out["accepted"] is True
    assert svc.users["u1"].paid_credits == 30


def test_policy_failure_no_auto_refund() -> None:
    svc = VerticalSliceService()
    user = svc.get_or_create_user("u1")
    user.free_credit_available = False
    user.paid_credits = 30

    order_id = create_order(svc, model_id="gpt-image-1.5")
    started = svc.start_order(order_id)
    assert started["result"] == "enqueued"

    svc.ingest_webhook(
        "openai_image",
        event_id="evt-policy-1",
        payload={"order_id": order_id, "event_type": "policy_failed"},
    )

    assert svc.users["u1"].paid_credits == 0
    assert svc.orders[order_id].fail_reason_code == "policy_failed"


def test_model_routing_is_deterministic() -> None:
    svc = VerticalSliceService()
    order_id = create_order(svc, model_id="sd-3.5-turbo")
    started = svc.start_order(order_id)
    assert started["job"]["provider"] == "stable_diffusion"
