from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import _is_sqlite
from app.core.db import JobRow, OrderRow, PaymentRow, UserRow
from app.services.lifecycle import mark_generation_succeeded, mark_payment_succeeded

logger = logging.getLogger(__name__)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _payload_hash(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()


class WebhookService:
    """Webhook ingestion with explicit idempotency and out-of-order guards."""

    def __init__(self, owner: Any):
        self._owner = owner

    def ingest(self, *, db: Session, provider: str, event_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        tg_notify: tuple[str, str, str] | None = None

        if provider in self._owner.provider_registry:
            prepared = self._prepare_generation_event(db=db, provider=provider, payload=payload)
            if prepared.get("ignored"):
                return prepared
            if not self._register_event(db=db, provider=provider, event_id=event_id, payload=payload):
                logger.info("webhook_deduplicated provider=%s event_id=%s", provider, event_id)
                return {"deduplicated": True}
            result = self._apply_generation_event(
                db=db,
                provider=provider,
                order=prepared["order"],
                event_type=prepared["event_type"],
                payload=payload,
            )
            tg_notify = result.get("tg_notify")

        if provider in {"telegram", "stripe"}:
            if not self._register_event(db=db, provider=provider, event_id=event_id, payload=payload):
                logger.info("webhook_deduplicated provider=%s event_id=%s", provider, event_id)
                return {"deduplicated": True}
            result = self._apply_payment_event(db=db, provider=provider, event_id=event_id, payload=payload)
            if result.get("deduplicated"):
                return result

        db.commit()

        if tg_notify:
            self._owner._notify_tg_generation_done(*tg_notify)

        return {"deduplicated": False, "accepted": True}

    def _register_event(self, *, db: Session, provider: str, event_id: str, payload: dict[str, Any]) -> bool:
        params = {
            "provider": provider,
            "event_id": event_id,
            "event_type": str(payload.get("event_type") or ""),
            "order_id": str(payload.get("order_id") or "") or None,
            "payment_id": str(
                payload.get("telegram_payment_charge_id")
                or payload.get("stripe_payment_intent_id")
                or payload.get("payment_id")
                or ""
            )
            or None,
            "payload_hash": _payload_hash(payload),
            "created_at": now_utc(),
        }
        if _is_sqlite:
            sql = text(
                """
                INSERT OR IGNORE INTO webhook_events
                (provider, event_id, event_type, order_id, payment_id, payload_hash, created_at)
                VALUES (:provider, :event_id, :event_type, :order_id, :payment_id, :payload_hash, :created_at)
                """
            )
        else:
            sql = text(
                """
                INSERT INTO webhook_events
                (provider, event_id, event_type, order_id, payment_id, payload_hash, created_at)
                VALUES (:provider, :event_id, :event_type, :order_id, :payment_id, :payload_hash, :created_at)
                ON CONFLICT (provider, event_id) DO NOTHING
                """
            )
        result = db.execute(sql, params)
        return (result.rowcount or 0) > 0

    def _prepare_generation_event(self, *, db: Session, provider: str, payload: dict[str, Any]) -> dict[str, Any]:
        order_id = str(payload.get("order_id", ""))
        event_type = str(payload.get("event_type", "done"))
        if not order_id:
            logger.warning("webhook_ignored_no_order_id provider=%s", provider)
            return {"deduplicated": False, "ignored": True}

        order = db.get(OrderRow, order_id)
        if not order:
            logger.warning("webhook_ignored_order_not_found provider=%s order_id=%s", provider, order_id)
            return {"deduplicated": False, "ignored": True}
        return {"order": order, "event_type": event_type}

    def _apply_generation_event(
        self,
        *,
        db: Session,
        provider: str,
        order: OrderRow,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        order_id = order.order_id

        # Out-of-order guard: terminal states are immutable.
        if order.status in {"done", "failed"}:
            logger.info(
                "webhook_out_of_order_ignored provider=%s order_id=%s event_type=%s status=%s",
                provider,
                order_id,
                event_type,
                order.status,
            )
            return {"tg_notify": None}

        job = (
            db.query(JobRow)
            .filter(JobRow.order_id == order_id)
            .order_by(JobRow.updated_at.desc())
            .first()
        )

        tg_notify: tuple[str, str, str] | None = None
        if event_type == "done":
            order.status = "done"
            order.result_url = payload.get("result_url")
            if job:
                job.status = "done"
                job.updated_at = now_utc()
            user = db.get(UserRow, order.user_id)
            if user and order.result_url:
                mark_generation_succeeded(db, user, order_id=order.order_id)
                tg_notify = (order.user_id, order.result_url, order.order_id)
                self._owner._record_result_asset(
                    user_id=order.user_id,
                    order_id=order.order_id,
                    result_url=order.result_url,
                )
            logger.info("webhook_generation_done provider=%s order_id=%s user_id=%s", provider, order_id, order.user_id)
        elif event_type == "processing":
            order.status = "processing"
            if job:
                job.status = "processing"
                job.updated_at = now_utc()
            logger.info("webhook_generation_processing provider=%s order_id=%s", provider, order_id)
        elif event_type == "technical_failed":
            order.status = "failed"
            order.fail_reason_code = "technical_failed"
            if job:
                job.status = "failed"
                job.updated_at = now_utc()
            user = db.get(UserRow, order.user_id)
            if user:
                user.paid_credits += order.credit_cost
            logger.info("webhook_generation_failed_refund provider=%s order_id=%s user_id=%s", provider, order_id, order.user_id)
        elif event_type == "policy_failed":
            order.status = "failed"
            order.fail_reason_code = "policy_failed"
            if job:
                job.status = "failed"
                job.updated_at = now_utc()
            logger.info("webhook_generation_policy_failed provider=%s order_id=%s user_id=%s", provider, order_id, order.user_id)
        else:
            logger.warning("webhook_unknown_event_type provider=%s event_type=%s order_id=%s", provider, event_type, order_id)

        order.updated_at = now_utc()
        return {"tg_notify": tg_notify}

    def _apply_payment_event(
        self,
        *,
        db: Session,
        provider: str,
        event_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        if provider == "telegram":
            payment_id = str(payload.get("telegram_payment_charge_id") or event_id)
        elif provider == "stripe":
            payment_id = str(payload.get("stripe_payment_intent_id") or event_id)
        else:
            payment_id = event_id

        dup = db.query(PaymentRow).filter(PaymentRow.payment_id == payment_id).first()
        if dup:
            return {"deduplicated": True}

        user_id = payload.get("user_id")
        package_code_raw = str(payload.get("package_code", ""))
        package_code = self._owner._normalize_package_code(package_code_raw)
        status = str(payload.get("status", "paid"))
        package = self._owner._resolve_package(package_code)
        amount = int(payload.get("amount", package["stars_price"] if package else 0))

        payment = PaymentRow(
            payment_id=payment_id,
            provider=provider,
            status=status,
            package_code=package_code,
            user_id=str(user_id) if user_id else None,
            amount=amount,
            created_at=now_utc(),
        )
        db.add(payment)

        if status == "paid" and user_id and package:
            uid = str(user_id)
            user = (
                db.query(UserRow)
                .filter(UserRow.user_id == uid)
                .with_for_update()
                .first()
            )
            if not user:
                user = UserRow(
                    user_id=uid,
                    paid_credits=0,
                    max_paid_topup_credits=0,
                    lifecycle_state="S0",
                    lifecycle_state_updated_at=now_utc(),
                    created_at=now_utc(),
                )
                db.add(user)
            base_credits = package["credits"]
            bonus_credits = package["bonus_coins"]
            topup_credits = int(base_credits) + int(bonus_credits)
            user.paid_credits += topup_credits
            mark_payment_succeeded(db, user, payment_id=payment_id, topup_credits=topup_credits)
            logger.info(
                "payment_credited user_id=%s package=%s credits=%d+%d total_now=%d",
                uid,
                package_code,
                base_credits,
                bonus_credits,
                user.paid_credits,
            )
        else:
            logger.warning(
                "payment_skipped_credit status=%s user_id=%s package=%s",
                status,
                user_id,
                package_code,
            )

        return {"accepted": True}
