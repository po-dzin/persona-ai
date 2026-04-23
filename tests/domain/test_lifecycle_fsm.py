from __future__ import annotations

from datetime import timedelta

from app.core.db import PaymentRow, UserRow, get_session
from app.services.lifecycle import low_balance_threshold, now_utc, recompute_user_state


def _mk_user(user_id: str, credits: int = 20) -> UserRow:
    return UserRow(
        user_id=user_id,
        paid_credits=credits,
        lifecycle_state="S0",
        created_at=now_utc(),
    )


def test_low_balance_threshold_formula() -> None:
    assert low_balance_threshold(0) == 0
    assert low_balance_threshold(150) == 15
    assert low_balance_threshold(151) == 16


def test_recompute_state_s5_zero_balance_has_max_priority() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-1", credits=0)
        user.last_payment_at = now_utc()
        user.last_success_generation_at = now_utc() - timedelta(days=9)
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "S5"


def test_recompute_state_s4_for_paid_user_on_dynamic_threshold() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-2", credits=37)  # BASIC max top-up 370 -> threshold 37
        user.last_payment_at = now_utc()
        db.add(user)
        db.flush()
        db.add(
            PaymentRow(
                payment_id="pay-fsm-basic",
                provider="telegram",
                status="paid",
                package_code="BASIC",
                user_id=user.user_id,
                amount=537,
                created_at=now_utc(),
            )
        )
        db.flush()
        state = recompute_user_state(db, user)
        assert state == "S4"


def test_recompute_state_s3_after_3_days_without_success_for_paid() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-3", credits=200)
        user.last_payment_at = now_utc() - timedelta(days=10)
        user.last_success_generation_at = now_utc() - timedelta(days=3)
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "S3"


def test_recompute_state_s2_for_paid_active_user() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-4", credits=200)
        user.last_payment_at = now_utc()
        user.last_success_generation_at = now_utc()
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "S2"


def test_recompute_state_s1_for_miniapp_opened_without_payment() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-5", credits=20)
        user.first_miniapp_opened_at = now_utc()
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "S1"


def test_dynamic_threshold_uses_max_topup_package() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-6", credits=89)  # max top-up is POPULAR=880 => threshold=88
        user.last_payment_at = now_utc()
        db.add(user)
        db.flush()
        db.add(
            PaymentRow(
                payment_id="pay-fsm-starter",
                provider="telegram",
                status="paid",
                package_code="STARTER",
                user_id=user.user_id,
                amount=230,
                created_at=now_utc(),
            )
        )
        db.add(
            PaymentRow(
                payment_id="pay-fsm-popular",
                provider="telegram",
                status="paid",
                package_code="POPULAR",
                user_id=user.user_id,
                amount=1227,
                created_at=now_utc(),
            )
        )
        db.flush()
        state = recompute_user_state(db, user)
        assert state == "S2"

        user.paid_credits = 88
        state = recompute_user_state(db, user)
        assert state == "S4"
