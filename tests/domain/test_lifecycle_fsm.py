from __future__ import annotations

from datetime import timedelta

from app.core.db import OrderRow, PaymentRow, UserRow, get_session
from app.services.lifecycle import low_balance_threshold, now_utc, recompute_user_state


def _mk_user(user_id: str, credits: int = 20) -> UserRow:
    return UserRow(
        user_id=user_id,
        paid_credits=credits,
        lifecycle_state="S0",
        created_at=now_utc(),
    )


def test_low_balance_threshold_formula() -> None:
    assert low_balance_threshold(10) == 20
    assert low_balance_threshold(50) == 100


def test_recompute_state_priority_inactive_over_s6() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-1", credits=0)
        user.zero_balance_since = now_utc() - timedelta(days=31)
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "INACTIVE_30D"


def test_recompute_state_s5_low_balance_before_paid_states() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-2", credits=19)
        user.last_payment_at = now_utc()
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "S5"


def test_recompute_state_s4_after_7_days_without_success() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-3", credits=120)
        user.last_payment_at = now_utc() - timedelta(days=10)
        user.last_success_generation_at = now_utc() - timedelta(days=8)
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "S4"


def test_recompute_state_s2_for_successful_generation_without_payment() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-4", credits=40)
        user.last_success_generation_at = now_utc()
        db.add(user)
        state = recompute_user_state(db, user)
        assert state == "S2"


def test_last_model_cost_affects_low_balance_threshold() -> None:
    with get_session() as db:
        user = _mk_user("u-fsm-5", credits=90)
        user.last_payment_at = now_utc()
        user.last_success_generation_at = now_utc()
        db.add(user)
        # Flush parent first so FK checks for dependent rows are deterministic.
        db.flush()
        db.add(
            OrderRow(
                order_id="ord-fsm-cost",
                user_id=user.user_id,
                style_code="hollywood",
                source_key="source/key",
                model_id="nb-pro-2k",
                prompt="p",
                aspect_ratio="1:1",
                status="done",
                credit_cost=50,
                result_url="https://example.com/r.jpg",
                created_at=now_utc(),
                updated_at=now_utc(),
            )
        )
        db.add(
            PaymentRow(
                payment_id="pay-fsm-cost",
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
        assert state == "S5"
