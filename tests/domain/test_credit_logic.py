
from dataclasses import replace as dc_replace

from app.core.db import UserRow, get_session
import app.services.vertical_slice as vertical_slice_mod
from app.services.vertical_slice import VerticalSliceService

DEFAULT_MODEL = "nano-banana-v1"
WELCOME_COINS = 20  # coins granted to every new user on signup


def _seed_user(user_id: str, *, paid_credits: int = 0) -> None:
    """Directly set user balance via DB for test setup."""
    with get_session() as db:
        user = db.get(UserRow, user_id)
        if user is None:
            raise RuntimeError(f"User {user_id!r} not found — call svc.get_or_create_user first")
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


def test_new_user_gets_welcome_coins() -> None:
    """New users start with WELCOME_COINS paid credits."""
    svc = VerticalSliceService()
    svc.get_or_create_user("u-welcome")
    balance = svc.get_balance("u-welcome")
    assert balance["paid_credits"] == WELCOME_COINS


def test_paid_credit_spend_and_paywall() -> None:
    """User with 0 coins gets paywall_required."""
    svc = VerticalSliceService()
    svc.get_or_create_user("u1")
    _seed_user("u1", paid_credits=0)

    order_id = create_order(svc)
    result = svc.start_order(order_id)
    assert result["result"] == "paywall_required"


def test_paid_credit_spend_and_technical_refund() -> None:
    svc = VerticalSliceService()
    svc.get_or_create_user("u1")
    _seed_user("u1", paid_credits=50)

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
    _seed_user("u1", paid_credits=50)

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
    svc.get_or_create_user("u1")
    _seed_user("u1", paid_credits=50)
    order_id = create_order(svc, model_id="nano-banana-pro")
    started = svc.start_order(order_id)
    assert started["job"]["provider"] == "nano_banana"


def test_volume_bonus_credits_on_purchase() -> None:
    """Purchasing a package credits exactly package.credits coins (bonus already included)."""
    svc = VerticalSliceService()
    svc.get_or_create_user("u-bonus")

    # BASIC: 365 total coins (bonus already included in credits)
    before_basic = svc.get_balance("u-bonus")["paid_credits"]
    result = svc.purchase("u-bonus", "BASIC")
    assert result["wallet"]["paid_credits"] == before_basic + 365, (
        "Expected +365 coins for BASIC"
    )

    # POPULAR: 875 total coins
    before_popular = svc.get_balance("u-bonus")["paid_credits"]
    result2 = svc.purchase("u-bonus", "POPULAR")
    assert result2["wallet"]["paid_credits"] == before_popular + 875

    # STARTER: 150 coins (no bonus)
    svc.get_or_create_user("u-starter")
    before_starter = svc.get_balance("u-starter")["paid_credits"]
    res = svc.purchase("u-starter", "STARTER")
    assert res["wallet"]["paid_credits"] == before_starter + 150


def test_purchase_accepts_legacy_package_codes() -> None:
    svc = VerticalSliceService()
    svc.get_or_create_user("u-legacy")
    before = svc.get_balance("u-legacy")["paid_credits"]

    res = svc.purchase("u-legacy", "STARTER_STARS")
    assert res["wallet"]["paid_credits"] == before + 150


def test_demo_mode_test_package_gives_1000_credits(monkeypatch) -> None:
    patched_settings = dc_replace(vertical_slice_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vertical_slice_mod, "settings", patched_settings)

    svc = vertical_slice_mod.VerticalSliceService()
    svc.get_or_create_user("u-demo-test-package")
    before = svc.get_balance("u-demo-test-package")["paid_credits"]

    res = svc.purchase("u-demo-test-package", "TEST")
    assert res["wallet"]["paid_credits"] == before + 1000


def test_demo_mode_coins_spent_normally_refunded_on_failure(monkeypatch) -> None:
    """In demo mode coins are spent just like production; refund only on technical failure."""
    patched_settings = dc_replace(vertical_slice_mod.settings, free_demo_mode=True)
    monkeypatch.setattr(vertical_slice_mod, "settings", patched_settings)

    svc = vertical_slice_mod.VerticalSliceService()
    svc.get_or_create_user("u-demo-refund")
    _seed_user("u-demo-refund", paid_credits=50)

    order_id = create_order(svc, user_id="u-demo-refund", model_id="nano-banana-pro")
    started = svc.start_order(order_id)
    assert started["result"] == "enqueued"
    # Coins are deducted normally (50 cost for pro)
    assert started["wallet"]["paid_credits"] == 0

    # Technical failure → coins are refunded
    svc.ingest_webhook(
        "nano_banana",
        event_id="evt-tech-demo-1",
        payload={"order_id": order_id, "event_type": "technical_failed"},
    )
    assert svc.get_balance("u-demo-refund")["paid_credits"] == 50
