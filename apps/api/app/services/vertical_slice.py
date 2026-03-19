from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

from app.adapters.provider_registry import build_provider_registry
from app.core.settings import settings
from shared.contracts.status import (
    MODEL_BY_ID,
    MODEL_CATALOG,
    PACKAGE_ALIASES,
    PACKAGE_CREDITS,
    PACKAGE_MATRIX,
    PACKAGE_STARS_PRICES,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


STYLE_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "id": "hollywood",
        "name": "Голливуд",
        "category": "Тренды",
        "gradient": "linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
        "prompt_template": "Cinematic hollywood portrait, dramatic lighting, premium retouch",
        "is_trending": True,
    },
    {
        "id": "cyberpunk",
        "name": "Киберпанк",
        "category": "Тренды",
        "gradient": "linear-gradient(145deg, #1E3A4A, #2E6890, #4A98C4)",
        "prompt_template": "Cyberpunk portrait, neon accents, glossy editorial mood",
        "is_new": True,
    },
    {
        "id": "business",
        "name": "Бизнес",
        "category": "Бизнес и карьера",
        "gradient": "linear-gradient(145deg, #1E2040, #2E3870, #4A58A0)",
        "prompt_template": "Professional business headshot, neutral background, sharp focus",
    },
    {
        "id": "k-pop",
        "name": "K-pop",
        "category": "Тренды",
        "gradient": "linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
        "prompt_template": "K-pop idol concept portrait, pastel palette, studio lighting",
    },
    {
        "id": "anime",
        "name": "Аниме",
        "category": "Арт и креатив",
        "gradient": "linear-gradient(145deg, #3D1E3A, #6B2E64, #9B4A90)",
        "prompt_template": "Anime inspired portrait, cel shading, expressive eyes",
        "is_new": True,
    },
)

STYLE_BY_ID = {style["id"]: style for style in STYLE_CATALOG}
GENERATION_PROVIDER_ALIASES = {
    "replicate": "stable_diffusion",
    "runway": "stable_diffusion",
}


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
    model_id: str
    prompt: str
    aspect_ratio: str
    status: str = "draft"
    credit_cost: int = 10
    is_free_credit_used: bool = False
    result_url: str | None = None
    fail_reason_code: str | None = None
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)


@dataclass
class JobState:
    job_id: str
    order_id: str
    provider: str
    status: str = "queued"
    provider_task_id: str | None = None
    attempts: int = 0
    updated_at: str = field(default_factory=now_iso)


class VerticalSliceService:
    """In-memory domain service for photo-first vertical-slice MVP."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.provider_registry = build_provider_registry()
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

    def list_styles(self) -> list[dict[str, Any]]:
        return [dict(style) for style in STYLE_CATALOG]

    def list_models(self) -> list[dict[str, Any]]:
        return [
            {
                "id": model["id"],
                "name": model["name"],
                "provider": model["provider"],
                "coins": model["coins"],
                "is_active": model["is_active"],
                "official_only": model["official_only"],
            }
            for model in MODEL_CATALOG
            if model["is_active"]
        ]

    def list_packages(self) -> list[dict[str, Any]]:
        return [
            {
                "code": pkg["code"],
                "title": pkg["title"],
                "credits": pkg["credits"],
                "price_stars": pkg["stars_price"],
                "provider": "telegram_stars",
                "sort_order": pkg["sort_order"],
            }
            for pkg in PACKAGE_MATRIX
        ]

    def get_balance(self, user_id: str) -> dict[str, Any]:
        user = self.get_or_create_user(user_id)
        return self._serialize_wallet(user)

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

    def create_order(
        self,
        user_id: str,
        style_code: str,
        source_key: str,
        *,
        model_id: str | None = None,
        prompt: str | None = None,
        aspect_ratio: str = "1:1",
    ) -> OrderState:
        _ = self.get_or_create_user(user_id)
        model = self._resolve_model(model_id)
        style = STYLE_BY_ID.get(style_code)
        prompt_value = (prompt or style["prompt_template"] if style else prompt or "").strip()
        order = OrderState(
            order_id=str(uuid4()),
            user_id=user_id,
            style_code=style_code,
            source_key=source_key,
            model_id=model["id"],
            prompt=prompt_value,
            aspect_ratio=aspect_ratio,
            status="awaiting_credit_or_payment",
            credit_cost=model["coins"],
        )
        with self._lock:
            self.orders[order.order_id] = order
        return order

    def generate(
        self,
        *,
        user_id: str,
        source_key: str,
        model_id: str,
        style_code: str = "hollywood",
        prompt: str | None = None,
        aspect_ratio: str = "1:1",
    ) -> dict[str, Any]:
        order = self.create_order(
            user_id,
            style_code,
            source_key,
            model_id=model_id,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
        )
        return self.start_order(order.order_id)

    def start_order(self, order_id: str) -> dict[str, Any]:
        with self._lock:
            order = self.orders[order_id]
            user = self.users[order.user_id]

            if user.free_credit_available:
                user.free_credit_available = False
                order.is_free_credit_used = True
            elif user.paid_credits >= order.credit_cost:
                user.paid_credits -= order.credit_cost
            else:
                order.status = "awaiting_credit_or_payment"
                order.updated_at = now_iso()
                return {
                    "result": "paywall_required",
                    "order": self._serialize_order(order),
                    "wallet": self._serialize_wallet(user),
                }

            provider_id = MODEL_BY_ID[order.model_id]["provider"]
            provider = self.provider_registry[provider_id]
            job = JobState(job_id=str(uuid4()), order_id=order.order_id, provider=provider_id)
            self.jobs[job.job_id] = job

            submit = provider.submit(
                order_id=order.order_id,
                model_id=order.model_id,
                source_key=order.source_key,
                source_image_url=self._build_source_image_url(order.source_key),
                prompt=order.prompt,
                aspect_ratio=order.aspect_ratio,
            )

            job.status = "submitted"
            job.provider_task_id = submit.provider_task_id
            job.updated_at = now_iso()

            order.status = "processing"
            order.updated_at = now_iso()

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
            rows = [self._serialize_order(o) for o in self.orders.values() if o.user_id == user_id]
        rows.sort(key=lambda item: item["created_at"], reverse=True)
        return rows

    def photos(self, user_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = [
                {
                    "order_id": order.order_id,
                    "style_code": order.style_code,
                    "model_id": order.model_id,
                    "status": order.status,
                    "result_url": order.result_url,
                    "created_at": order.created_at,
                    "updated_at": order.updated_at,
                }
                for order in self.orders.values()
                if order.user_id == user_id
            ]
        rows.sort(key=lambda item: item["created_at"], reverse=True)
        return rows

    def purchase(self, user_id: str, package_code: str, provider: str = "telegram") -> dict[str, Any]:
        _ = self.get_or_create_user(user_id)
        canonical_code = self._normalize_package_code(package_code)
        if canonical_code not in PACKAGE_CREDITS:
            raise ValueError("package_not_found")

        payment_id = str(uuid4())
        event_id = f"purchase-{payment_id}"
        payload = {
            "payment_id": payment_id,
            "user_id": user_id,
            "package_code": canonical_code,
            "status": "paid",
            "amount": PACKAGE_STARS_PRICES[canonical_code],
        }
        result = self.ingest_webhook(provider, event_id, payload)
        return {
            "payment_id": payment_id,
            "provider": provider,
            "package_code": canonical_code,
            "result": result,
            "wallet": self._serialize_wallet(self.users[user_id]),
        }

    def ingest_webhook(self, provider: str, event_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            provider = GENERATION_PROVIDER_ALIASES.get(provider, provider)
            key = (provider, event_id)
            if key in self.webhook_events:
                return {"deduplicated": True}
            self.webhook_events.add(key)

            if provider in self.provider_registry:
                order_id = str(payload.get("order_id", ""))
                event_type = str(payload.get("event_type", "done"))
                if not order_id or order_id not in self.orders:
                    return {"deduplicated": False, "ignored": True}

                order = self.orders[order_id]
                job = next((j for j in self.jobs.values() if j.order_id == order_id), None)

                if event_type == "done":
                    order.status = "done"
                    order.result_url = payload.get(
                        "result_url",
                        f"https://r2.example/result/{order.user_id}/{order.order_id}.jpg",
                    )
                    if job:
                        job.status = "done"
                        job.updated_at = now_iso()
                elif event_type == "processing":
                    order.status = "processing"
                    if job:
                        job.status = "processing"
                        job.updated_at = now_iso()
                elif event_type == "technical_failed":
                    order.status = "failed"
                    order.fail_reason_code = "technical_failed"
                    if job:
                        job.status = "failed"
                        job.updated_at = now_iso()
                    user = self.users[order.user_id]
                    if not order.is_free_credit_used:
                        user.paid_credits += order.credit_cost
                elif event_type == "policy_failed":
                    order.status = "failed"
                    order.fail_reason_code = "policy_failed"
                    if job:
                        job.status = "failed"
                        job.updated_at = now_iso()

                order.updated_at = now_iso()

            if provider in {"telegram", "stripe"}:
                payment_id = str(payload.get("payment_id", uuid4()))
                user_id = payload.get("user_id")
                package_code_raw = str(payload.get("package_code", ""))
                package_code = self._normalize_package_code(package_code_raw)
                status = payload.get("status", "paid")
                amount = payload.get("amount", PACKAGE_STARS_PRICES.get(package_code, 0))
                self.payments[payment_id] = {
                    "payment_id": payment_id,
                    "provider": provider,
                    "status": status,
                    "package_code": package_code,
                    "user_id": user_id,
                    "amount": amount,
                    "created_at": now_iso(),
                }
                if status == "paid" and user_id and package_code in PACKAGE_CREDITS:
                    uid = str(user_id)
                    if uid not in self.users:
                        self.users[uid] = UserState(user_id=uid)
                    user = self.users[uid]
                    user.paid_credits += PACKAGE_CREDITS[package_code]

            return {"deduplicated": False, "accepted": True}

    def _resolve_model(self, model_id: str | None) -> dict[str, Any]:
        if not model_id:
            return dict(MODEL_CATALOG[0])
        try:
            return dict(MODEL_BY_ID[model_id])
        except KeyError as exc:
            raise ValueError("model_not_found") from exc

    @staticmethod
    def _build_source_image_url(source_key: str) -> str:
        base = settings.r2_public_base_url.strip().rstrip("/")
        if base:
            return f"{base}/{source_key.lstrip('/')}"
        return f"https://r2.example/{source_key.lstrip('/')}"

    @staticmethod
    def _normalize_package_code(package_code: str) -> str:
        normalized = package_code.strip().upper()
        return PACKAGE_ALIASES.get(normalized, normalized)

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
            "source_key": order.source_key,
            "model_id": order.model_id,
            "prompt": order.prompt,
            "aspect_ratio": order.aspect_ratio,
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
