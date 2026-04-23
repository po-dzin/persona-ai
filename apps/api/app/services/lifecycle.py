from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.db import (
    AppMetaRow,
    LifecycleAdminActionRow,
    LifecycleTransitionRow,
    PaymentRow,
    UserRow,
)
from app.services.package_codes import normalize_package_code
from shared.contracts.status import PACKAGE_BONUS_COINS, PACKAGE_CREDITS

LIFECYCLE_STATES = ("S0", "S1", "S2", "S3", "S4", "S5")
BACKFILL_META_KEY = "lifecycle_backfill_v2"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def low_balance_threshold(max_topup_credits: int) -> int:
    if max_topup_credits <= 0:
        return 0
    return max(1, math.ceil(max_topup_credits * 0.1))


@dataclass(frozen=True)
class LifecycleComputeResult:
    state: str
    reason: str
    low_balance_threshold: int
    max_topup_credits: int


def _serialize_meta(metadata: dict[str, Any] | None) -> str | None:
    if not metadata:
        return None
    return json.dumps(metadata, ensure_ascii=True, separators=(",", ":"))


def _days_since(ts: datetime | None, now: datetime) -> int:
    if not ts:
        return 0
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return max(0, int((now - ts).total_seconds() // 86400))


def _max_paid_topup_credits(db: Session, user_id: str) -> int:
    user = db.get(UserRow, user_id)
    if user and int(user.max_paid_topup_credits or 0) > 0:
        return int(user.max_paid_topup_credits)
    payments = (
        db.query(PaymentRow.package_code)
        .filter(PaymentRow.user_id == user_id, PaymentRow.status == "paid")
        .all()
    )
    max_topup = 0
    for package_code, in payments:
        if not package_code:
            continue
        code = normalize_package_code(package_code)
        base_credits = PACKAGE_CREDITS.get(code, 0)
        bonus_credits = PACKAGE_BONUS_COINS.get(code, 0)
        max_topup = max(max_topup, base_credits + bonus_credits)
    if user and max_topup > int(user.max_paid_topup_credits or 0):
        user.max_paid_topup_credits = max_topup
    return max_topup


def _has_paid_payment(db: Session, user_id: str) -> bool:
    return (
        db.query(PaymentRow)
        .filter(PaymentRow.user_id == user_id, PaymentRow.status == "paid")
        .first()
        is not None
    )


def _compute_state(db: Session, user: UserRow, now: datetime) -> LifecycleComputeResult:
    max_topup_credits = _max_paid_topup_credits(db, user.user_id)
    threshold = low_balance_threshold(max_topup_credits)
    has_payment = _has_paid_payment(db, user.user_id) or bool(user.last_payment_at)
    is_paid_user = has_payment
    is_low_balance = (
        is_paid_user
        and user.paid_credits > 0
        and threshold > 0
        and user.paid_credits <= threshold
    )

    if user.paid_credits == 0:
        return LifecycleComputeResult(
            state="S5",
            reason="zero_balance",
            low_balance_threshold=threshold,
            max_topup_credits=max_topup_credits,
        )
    if is_low_balance:
        return LifecycleComputeResult(
            state="S4",
            reason="low_balance_10pct_max_topup",
            low_balance_threshold=threshold,
            max_topup_credits=max_topup_credits,
        )
    if (
        is_paid_user
        and user.last_success_generation_at
        and _days_since(user.last_success_generation_at, now) >= 3
    ):
        return LifecycleComputeResult(
            state="S3",
            reason="paid_sleeping_3d",
            low_balance_threshold=threshold,
            max_topup_credits=max_topup_credits,
        )
    if is_paid_user:
        return LifecycleComputeResult(
            state="S2",
            reason="paid_active",
            low_balance_threshold=threshold,
            max_topup_credits=max_topup_credits,
        )
    if user.first_miniapp_opened_at:
        return LifecycleComputeResult(
            state="S1",
            reason="miniapp_opened",
            low_balance_threshold=threshold,
            max_topup_credits=max_topup_credits,
        )
    return LifecycleComputeResult(
        state="S0",
        reason="bot_started_or_default",
        low_balance_threshold=threshold,
        max_topup_credits=max_topup_credits,
    )


def _append_transition(
    db: Session,
    *,
    user_id: str,
    from_state: str | None,
    to_state: str,
    reason: str,
    source: str,
    actor: str | None = None,
    metadata: dict[str, Any] | None = None,
    ts: datetime | None = None,
) -> None:
    db.add(
        LifecycleTransitionRow(
            user_id=user_id,
            from_state=from_state,
            to_state=to_state,
            reason=reason,
            source=source,
            actor=actor,
            metadata_json=_serialize_meta(metadata),
            created_at=ts or now_utc(),
        )
    )


def _append_admin_action(
    db: Session,
    *,
    user_id: str,
    action_type: str,
    actor: str,
    reason: str,
    from_state: str | None = None,
    to_state: str | None = None,
    metadata: dict[str, Any] | None = None,
    ts: datetime | None = None,
) -> None:
    db.add(
        LifecycleAdminActionRow(
            user_id=user_id,
            action_type=action_type,
            actor=actor,
            reason=reason,
            from_state=from_state,
            to_state=to_state,
            metadata_json=_serialize_meta(metadata),
            created_at=ts or now_utc(),
        )
    )


def recompute_user_state(
    db: Session,
    user: UserRow,
    *,
    source: str = "system",
    reason: str = "recompute",
    actor: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    now = now_utc()

    if user.paid_credits == 0 and user.zero_balance_since is None:
        user.zero_balance_since = now
    elif user.paid_credits > 0 and user.zero_balance_since is not None:
        user.zero_balance_since = None

    if user.lifecycle_locked:
        return user.lifecycle_state or "S0"

    result = _compute_state(db, user, now)
    current_state = user.lifecycle_state or "S0"
    if current_state != result.state:
        user.lifecycle_state = result.state
        user.lifecycle_state_updated_at = now
        _append_transition(
            db,
            user_id=user.user_id,
            from_state=current_state,
            to_state=result.state,
            reason=reason or result.reason,
            source=source,
            actor=actor,
            metadata={
                "computed_reason": result.reason,
                "low_balance_threshold": result.low_balance_threshold,
                "max_topup_credits": result.max_topup_credits,
                **(metadata or {}),
            },
            ts=now,
        )
    elif user.lifecycle_state_updated_at is None:
        user.lifecycle_state_updated_at = now

    return user.lifecycle_state or "S0"


def mark_bot_started(db: Session, user: UserRow) -> None:
    now = now_utc()
    if user.bot_started_at is None:
        user.bot_started_at = now
    recompute_user_state(db, user, source="system", reason="bot_started")


def mark_miniapp_opened(db: Session, user: UserRow) -> None:
    now = now_utc()
    if user.first_miniapp_opened_at is None:
        user.first_miniapp_opened_at = now
    user.last_miniapp_opened_at = now
    recompute_user_state(db, user, source="system", reason="miniapp_opened")
    from app.services.lifecycle_messaging import maybe_send_lifecycle_message
    maybe_send_lifecycle_message(db, user, now=now)


def mark_generation_succeeded(db: Session, user: UserRow, *, order_id: str | None = None) -> None:
    user.last_success_generation_at = now_utc()
    now = user.last_success_generation_at
    recompute_user_state(
        db,
        user,
        source="system",
        reason="generation_succeeded",
        metadata={"order_id": order_id} if order_id else None,
    )
    from app.services.lifecycle_messaging import maybe_send_lifecycle_message
    maybe_send_lifecycle_message(db, user, now=now)


def mark_payment_succeeded(
    db: Session,
    user: UserRow,
    *,
    payment_id: str | None = None,
    topup_credits: int | None = None,
) -> None:
    if isinstance(topup_credits, int) and topup_credits > 0:
        user.max_paid_topup_credits = max(int(user.max_paid_topup_credits or 0), int(topup_credits))
    user.last_payment_at = now_utc()
    now = user.last_payment_at
    recompute_user_state(
        db,
        user,
        source="system",
        reason="payment_succeeded",
        metadata={"payment_id": payment_id} if payment_id else None,
    )
    from app.services.lifecycle_messaging import maybe_send_lifecycle_message
    maybe_send_lifecycle_message(db, user, now=now)


def admin_force_transition(
    db: Session,
    user: UserRow,
    *,
    to_state: str,
    actor: str,
    reason: str,
) -> str:
    if to_state not in LIFECYCLE_STATES:
        raise ValueError("invalid_lifecycle_state")
    now = now_utc()
    from_state = user.lifecycle_state or "S0"
    user.lifecycle_state = to_state
    user.lifecycle_state_updated_at = now
    _append_transition(
        db,
        user_id=user.user_id,
        from_state=from_state,
        to_state=to_state,
        reason=reason,
        source="admin",
        actor=actor,
        ts=now,
    )
    _append_admin_action(
        db,
        user_id=user.user_id,
        action_type="force_transition",
        actor=actor,
        reason=reason,
        from_state=from_state,
        to_state=to_state,
        ts=now,
    )
    return to_state


def admin_lock_state(db: Session, user: UserRow, *, actor: str, reason: str) -> None:
    now = now_utc()
    user.lifecycle_locked = True
    user.lifecycle_lock_by = actor
    user.lifecycle_lock_reason = reason
    user.lifecycle_lock_at = now
    _append_admin_action(
        db,
        user_id=user.user_id,
        action_type="lock",
        actor=actor,
        reason=reason,
        from_state=user.lifecycle_state,
        to_state=user.lifecycle_state,
        ts=now,
    )


def admin_unlock_state(db: Session, user: UserRow, *, actor: str, reason: str) -> str:
    now = now_utc()
    user.lifecycle_locked = False
    user.lifecycle_lock_by = None
    user.lifecycle_lock_reason = None
    user.lifecycle_lock_at = None
    _append_admin_action(
        db,
        user_id=user.user_id,
        action_type="unlock",
        actor=actor,
        reason=reason,
        from_state=user.lifecycle_state,
        to_state=user.lifecycle_state,
        ts=now,
    )
    return recompute_user_state(db, user, source="admin", reason="admin_unlock_recompute", actor=actor)


def admin_recompute_state(db: Session, user: UserRow, *, actor: str, reason: str) -> str:
    _append_admin_action(
        db,
        user_id=user.user_id,
        action_type="recompute",
        actor=actor,
        reason=reason,
        from_state=user.lifecycle_state,
        to_state=user.lifecycle_state,
    )
    return recompute_user_state(db, user, source="admin", reason=reason, actor=actor)


def backfill_all_users(db: Session) -> int:
    users = db.query(UserRow).all()
    for user in users:
        recompute_user_state(db, user, source="migration", reason="initial_backfill")
    return len(users)


def run_backfill_once(db: Session) -> tuple[bool, int]:
    marker = db.get(AppMetaRow, BACKFILL_META_KEY)
    if marker is not None:
        return False, 0

    users_count = backfill_all_users(db)
    db.add(
        AppMetaRow(
            key=BACKFILL_META_KEY,
            value=json.dumps({"users_count": users_count}, ensure_ascii=True),
            updated_at=now_utc(),
        )
    )
    return True, users_count
