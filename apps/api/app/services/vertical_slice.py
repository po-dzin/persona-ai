from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

from shared.contracts.status import BASE_GEN_USD, PACKAGE_CREDITS, PACKAGE_MARKUPS


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def package_price_usd(code: str) -> float:
    credits = PACKAGE_CREDITS[code]
    raw = credits * BASE_GEN_USD * PACKAGE_MARKUPS[code]
    pretty = {
        "S": 3.99,
        "M": 12.99,
        "L": 27.99,
    }
    return pretty.get(code, round(raw, 2))


@dataclass
class UserState:
    user_id: str
    free_credits_granted: bool = True
    free_credit_available: bool = True
    paid_credits: int = 0
    created_at: str = field(default_factory=now_iso)


@dataclass
class OrderState:
    order_id: str
    user_id: str
    style_code: str
    source_key: str
    status: str = "draft"
    credit_cost: int = 1
    is_free_credit_used: bool = False
    result_url: str | None = None
    fail_reason_code: str | None = None
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)


@dataclass
class JobState:
    job_id: str
    order_id: str
    provider: str = "replicate"
    status: str = "queued"
    provider_task_id: str | None = None
    attempts: int = 0
    updated_at: str = field(default_factory=now_iso)


class VerticalSliceService:
    """In-memory domain service for vertical-slice MVP.

    Keeps business rules deterministic for tests and API contract checks.
    Production persistence uses Postgres + schema.sql migrations.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self.users: dict[str, UserState] = {}
        self.orders: dict[str, OrderState] = {}
        self.jobs: dict[str, JobState] = {}
        self.webhook_events: set[tuple[str, str]] = set()
        self.payments: dict[str, dict[str, Any]] = {}

    def get_or_create_user(self, user_id: str) -> UserState:
        with self._lock:
            if user_id not in self.users:
                self.users[user_id] = UserState(user_id=user_id)
            return self.users[user_id]

    def list_packages(self) -> list[dict[str, Any]]:
        rows = []
        for code in ("S", "M", "L"):
            rows.append(
                {
                    "code": code,
                    "credits": PACKAGE_CREDITS[code],
                    "price_usd": package_price_usd(code),
                    "markup": PACKAGE_MARKUPS[code],
                }
            )
        return rows

    def register_upload(self, user_id: str, filename: str) -> dict[str, str]:
        _ = self.get_or_create_user(user_id)
        upload_id = str(uuid4())
        source_key = f"source/{user_id}/{upload_id}/{filename}"
        signed_put_url = f"https://r2.example/upload/{source_key}"
        return {
            "upload_id": upload_id,
            "source_key": source_key,
            "signed_put_url": signed_put_url,
        }

    def create_order(self, user_id: str, style_code: str, source_key: str) -> OrderState:
        _ = self.get_or_create_user(user_id)
        order = OrderState(
            order_id=str(uuid4()),
            user_id=user_id,
            style_code=style_code,
            source_key=source_key,
            status="awaiting_credit_or_payment",
        )
        with self._lock:
            self.orders[order.order_id] = order
        return order

    def start_order(self, order_id: str) -> dict[str, Any]:
        with self._lock:
            order = self.orders[order_id]
            user = self.users[order.user_id]

            if user.free_credit_available:
                user.free_credit_available = False
                order.is_free_credit_used = True
            elif user.paid_credits > 0:
                user.paid_credits -= 1
            else:
                order.status = "awaiting_credit_or_payment"
                order.updated_at = now_iso()
                return {
                    "result": "paywall_required",
                    "order": self._serialize_order(order),
                    "wallet": self._serialize_wallet(user),
                }

            order.status = "queued"
            order.updated_at = now_iso()

            job = JobState(job_id=str(uuid4()), order_id=order.order_id, status="queued")
            self.jobs[job.job_id] = job

            return {
                "result": "enqueued",
                "order": self._serialize_order(order),
                "job": self._serialize_job(job),
                "wallet": self._serialize_wallet(user),
            }

    def order_status(self, order_id: str) -> dict[str, Any]:
        with self._lock:
            order = self.orders[order_id]
            job = next((j for j in self.jobs.values() if j.order_id == order_id), None)
            return {
                "order": self._serialize_order(order),
                "job": self._serialize_job(job) if job else None,
            }

    def history(self, user_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return [
                self._serialize_order(o)
                for o in self.orders.values()
                if o.user_id == user_id
            ]

    def ingest_webhook(self, provider: str, event_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            key = (provider, event_id)
            if key in self.webhook_events:
                return {"deduplicated": True}
            self.webhook_events.add(key)

            if provider in {"replicate", "runway"}:
                order_id = payload.get("order_id")
                event_type = payload.get("event_type")
                if not order_id or order_id not in self.orders:
                    return {"deduplicated": False, "ignored": True}

                order = self.orders[order_id]
                job = next((j for j in self.jobs.values() if j.order_id == order_id), None)

                if event_type == "done":
                    order.status = "done"
                    order.result_url = payload.get(
                        "result_url",
                        f"https://r2.example/result/{order.user_id}/{order.order_id}.mp4",
                    )
                    if job:
                        job.status = "done"
                        job.updated_at = now_iso()
                elif event_type == "technical_failed":
                    order.status = "failed"
                    order.fail_reason_code = "technical_failed"
                    if job:
                        job.status = "failed"
                        job.updated_at = now_iso()
                    # auto-refund only for paid credit usage
                    user = self.users[order.user_id]
                    if not order.is_free_credit_used:
                        user.paid_credits += 1
                elif event_type == "policy_failed":
                    order.status = "failed"
                    order.fail_reason_code = "policy_failed"
                    if job:
                        job.status = "failed"
                        job.updated_at = now_iso()

                order.updated_at = now_iso()

            if provider in {"telegram", "stripe"}:
                payment_id = payload.get("payment_id", str(uuid4()))
                user_id = payload.get("user_id")
                package_code = payload.get("package_code")
                status = payload.get("status", "paid")
                self.payments[payment_id] = {
                    "payment_id": payment_id,
                    "provider": provider,
                    "status": status,
                    "package_code": package_code,
                    "user_id": user_id,
                    "created_at": now_iso(),
                }
                if status == "paid" and user_id and package_code in PACKAGE_CREDITS:
                    user = self.get_or_create_user(user_id)
                    user.paid_credits += PACKAGE_CREDITS[package_code]

            return {"deduplicated": False, "accepted": True}

    @staticmethod
    def _serialize_wallet(user: UserState) -> dict[str, Any]:
        return {
            "free_credit_available": user.free_credit_available,
            "paid_credits": user.paid_credits,
        }

    @staticmethod
    def _serialize_order(order: OrderState) -> dict[str, Any]:
        return {
            "order_id": order.order_id,
            "user_id": order.user_id,
            "style_code": order.style_code,
            "status": order.status,
            "credit_cost": order.credit_cost,
            "is_free_credit_used": order.is_free_credit_used,
            "result_url": order.result_url,
            "fail_reason_code": order.fail_reason_code,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
        }

    @staticmethod
    def _serialize_job(job: JobState) -> dict[str, Any]:
        return {
            "job_id": job.job_id,
            "order_id": job.order_id,
            "provider": job.provider,
            "status": job.status,
            "attempts": job.attempts,
            "provider_task_id": job.provider_task_id,
            "updated_at": job.updated_at,
        }
