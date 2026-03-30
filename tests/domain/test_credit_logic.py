import math
from dataclasses import replace as dc_replace

from app.core.db import UserRow, get_session
import app.services.vertical_slice as vertical_slice_mod
from app.services.vertical_slice import VerticalSliceService

DEFAULT_MODEL = "nano-banana-v1"


def _seed_user(user_id: str, *, paid_credits: int = 0, free_credit_available: bool = True) -> None:
    """Directly set user balance via DB for test setup."""
    with get_session() as db:
        user = db.get(UserRow, user_id)
        if user is None:
            raise RuntimeError(f"User {user_id!r} not found — call svc.get_or_create_user first")
        user.free_credit_available = free_credit_available
        user.paid_credits = paid_credits
        db.commit()


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
    svc.get_or_create_user("u1")
    _seed_user("u1", paid_credits=50, free_credit_available=False)

    order_id = create_order(svc, model_id="nano-banana-pro")
    started = svc.start_order(order_id)
    assert started["result"] == "enqueued"
    assert started["wallet"]["paid_credits"] == 0

    out = svc.ingest_webhook(
        "nano_banana",
        event_id="evt-tech-1",
        payload={"order_id": order_id, "event_type": "technical_failed"},
    )
    assert out["accepted"] is True
    assert svc.get_balance("u1")["paid_credits"] == 50


def test_policy_failure_no_auto_refund() -> None:
    svc = VerticalSliceService()
    svc.get_or_create_user("u1")
    _seed_user("u1", paid_credits=50, free_credit_available=False)

    order_id = create_order(svc, model_id="nano-banana-pro")
    started = svc.start_order(order_id)
    assert started["result"] == "enqueued"

    svc.ingest_webhook(
        "nano_banana",
        event_id="evt-policy-1",
        payload={"order_id": order_id, "event_type": "policy_failed"},
    )

    assert svc.get_balance("u1")["paid_credits"] == 0
    assert svc.order_status(order_id)["order"]["fail_reason_code"] == "policy_failed"


def test_model_routing_is_deterministic() -> None:
    svc = VerticalSliceService()
    order_id = create_order(svc, model_id="nano-banana-pro")
    started = svc.start_order(order_id)
    assert started["job"]["provider"] == "nano_banana"


def test_volume_bonus_credits_on_purchase() -> None:
    """Purchasing a package with bonus_percent > 0 must credit base + bonus coins."""
    svc = VerticalSliceService()
    svc.get_or_create_user("u-bonus")

    # BASIC: 350 base coins + 5% bonus = ceil(350 * 5 / 100) = 18 → 368 total
    result = svc.purchase("u-bonus", "BASIC")
    expected = 350 + math.ceil(350 * 5 / 100)
    assert result["wallet"]["paid_credits"] == expected, (
        f"Expected {expected} coins for BASIC+5%, got {result['wallet']['paid_credits']}"
    )

    # POPULAR: 800 base + 10% = ceil(800 * 10 / 100) = 80 → 880 total (cumulative)
    result2 = svc.purchase("u-bonus", "POPULAR")
    popular_bonus = math.ceil(800 * 10 // 100)
    assert result2["wallet"]["paid_credits"] == expected + 800 + popular_bonus

    # STARTER: 0% bonus — exactly 150 coins added
    svc.get_or_create_user("u-starter")
    res = svc.purchase("u-starter", "STARTER")
    assert res["wallet"]["paid_credits"] == 150


def test_purchase_accepts_legacy_package_codes() -> None:
    svc = VerticalSliceService()
    svc.get_or_create_user("u-legacy")

    res = svc.purchase("u-legacy", "STARTER_STARS")
    assert res["wallet"]["paid_credits"] == 150


def test_demo_mode_test_package_gives_1000_credits(monkeypatch) -> None:
    patched_settings = dc_replace(vertical_slice_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vertical_slice_mod, "settings", patched_settings)

    svc = vertical_slice_mod.VerticalSliceService()
    svc.get_or_create_user("u-demo-test-package")

    res = svc.purchase("u-demo-test-package", "TEST")
    assert res["wallet"]["paid_credits"] == 1000


def test_demo_mode_auto_refunds_spent_paid_credits(monkeypatch) -> None:
    patched_settings = dc_replace(vertical_slice_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vertical_slice_mod, "settings", patched_settings)

    svc = vertical_slice_mod.VerticalSliceService()
    svc.get_or_create_user("u-demo-refund")
    _seed_user("u-demo-refund", paid_credits=50, free_credit_available=False)

    order_id = create_order(svc, user_id="u-demo-refund", model_id="nano-banana-pro")
    started = svc.start_order(order_id)
    assert started["result"] == "enqueued"
    assert started["wallet"]["paid_credits"] == 50

    svc.ingest_webhook(
        "nano_banana",
        event_id="evt-tech-demo-1",
        payload={"order_id": order_id, "event_type": "technical_failed"},
    )
    assert svc.get_balance("u-demo-refund")["paid_credits"] == 50
