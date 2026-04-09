from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import logging

from app.adapters.http_client import ProviderHTTPError
from app.adapters.provider_registry import build_provider_registry
from app.core.db import JobRow, OrderRow, PaymentRow, UserRow, get_session
import math

from app.core.settings import settings
from app.services.package_codes import normalize_package_code

logger = logging.getLogger(__name__)

from shared.contracts.status import (
    MODEL_BY_ID,
    MODEL_CATALOG,
    PACKAGE_BONUS_PERCENT,
    PACKAGE_CREDITS,
    PACKAGE_MATRIX,
    PACKAGE_STARS_PRICES,
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# Backward-compat alias used internally — returns datetime object now
now_iso = now_utc


def _to_iso(val: Any) -> str:
    """Convert datetime or ISO string to ISO-8601 string."""
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


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
        "id": "glamour-90s",
        "name": "Гламур 90-х",
        "category": "Тренды",
        "gradient": "linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
        "prompt_template": "90s glamour portrait, glossy style, magazine lighting",
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
        "name": "Бизнес-портрет",
        "category": "Бизнес и карьера",
        "gradient": "linear-gradient(145deg, #1E2040, #2E3870, #4A58A0)",
        "prompt_template": "Professional business headshot, neutral background, sharp focus",
    },
    {
        "id": "linkedin",
        "name": "LinkedIn",
        "category": "Бизнес и карьера",
        "gradient": "linear-gradient(145deg, #1E3A4A, #2E6890, #4A98C4)",
        "prompt_template": "LinkedIn profile portrait, business casual, clean studio setup",
    },
    {
        "id": "ceo-style",
        "name": "CEO-стиль",
        "category": "Бизнес и карьера",
        "gradient": "linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
        "prompt_template": "Executive ceo portrait, premium editorial look, confident pose",
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
    {
        "id": "nature",
        "name": "Природа",
        "category": "Лайфстайл",
        "gradient": "linear-gradient(145deg, #1E3D2A, #2E6B48, #4A9B70)",
        "prompt_template": "Natural lifestyle portrait outdoors, soft sunlight, fresh colors",
    },
    {
        "id": "vintage",
        "name": "Винтаж",
        "category": "Лайфстайл",
        "gradient": "linear-gradient(145deg, #3D3020, #6B5530, #A08050)",
        "prompt_template": "Vintage portrait session, film grain, retro wardrobe",
    },
    {
        "id": "travel",
        "name": "Путешествие",
        "category": "Лайфстайл",
        "gradient": "linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
        "prompt_template": "Travel portrait near landmarks, bright daylight, candid mood",
    },
    {
        "id": "cozy-evening",
        "name": "Уютный вечер",
        "category": "Лайфстайл",
        "gradient": "linear-gradient(145deg, #3D1E3A, #6B2E64, #9B4A90)",
        "prompt_template": "Cozy evening portrait, warm ambient lights, soft atmosphere",
        "is_new": True,
    },
    {
        "id": "oil-paint",
        "name": "Масло",
        "category": "Арт и креатив",
        "gradient": "linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
        "prompt_template": "Oil painting portrait, rich brush texture, gallery style",
    },
    {
        "id": "comic",
        "name": "Комикс",
        "category": "Арт и креатив",
        "gradient": "linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
        "prompt_template": "Comic book portrait, bold outlines, high contrast colors",
    },
    {
        "id": "wedding",
        "name": "Свадьба",
        "category": "Особый повод",
        "gradient": "linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
        "prompt_template": "Wedding portrait, elegant white tones, romantic cinematic lighting",
    },
    {
        "id": "birthday",
        "name": "День рождения",
        "category": "Особый повод",
        "gradient": "linear-gradient(145deg, #1E3D2A, #2E6B48, #4A9B70)",
        "prompt_template": "Birthday celebration portrait, festive mood, colorful decorations",
    },
    {
        "id": "graduation",
        "name": "Выпускной",
        "category": "Особый повод",
        "gradient": "linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
        "prompt_template": "Graduation portrait, academic robe, celebratory style",
    },
)

STYLE_BY_ID = {style["id"]: style for style in STYLE_CATALOG}
GENERATION_PROVIDER_ALIASES = {
    "replicate": "stable_diffusion",
    "runway": "stable_diffusion",
}

_VALID_ASPECT_RATIOS = frozenset({"1:1", "16:9", "9:16", "3:4", "4:3", "21:9", "5:4", "2:3"})
_DEMO_TEST_PACKAGE = {
    "code": "TEST",
    "title": "Test",
    "credits": 1000,
    "stars_price": 1,
    "bonus_percent": 0,
    "sort_order": 1,
}


class VerticalSliceService:
    """Domain service backed by PostgreSQL."""

    def __init__(self) -> None:
        self.provider_registry = build_provider_registry()

    # ------------------------------------------------------------------ users

    def get_or_create_user(
        self,
        user_id: str,
        first_name: str | None = None,
        username: str | None = None,
    ) -> UserRow:
        with get_session() as db:
            user = db.get(UserRow, user_id)
            if not user:
                user = UserRow(
                    user_id=user_id,
                    first_name=first_name,
                    username=username,
                    paid_credits=20,
                    created_at=now_iso(),
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                # Update display info when TG provides it (names can change)
                changed = False
                if first_name and user.first_name != first_name:
                    user.first_name = first_name
                    changed = True
                if username is not None and user.username != username:
                    user.username = username
                    changed = True
                if changed:
                    db.commit()
                    db.refresh(user)
            return user

    def get_balance(self, user_id: str) -> dict[str, Any]:
        user = self.get_or_create_user(user_id)
        return self._serialize_wallet(user)

    def get_profile(
        self,
        user_id: str,
        first_name: str | None = None,
        username: str | None = None,
    ) -> dict[str, Any]:
        user = self.get_or_create_user(user_id, first_name=first_name, username=username)
        with get_session() as db:
            generations_count = (
                db.query(OrderRow)
                .filter(OrderRow.user_id == user_id)
                .count()
            )
        return {
            "user_id": user_id,
            "first_name": user.first_name,
            "username": user.username,
            "paid_credits": user.paid_credits,
            "generations_count": generations_count,
            "referrals_count": 0,
            "is_admin": user_id in settings.admin_user_ids,
        }

    # ---------------------------------------------------------------- catalog

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
        package_matrix = list(PACKAGE_MATRIX)
        if settings.free_demo_mode:
            package_matrix = [_DEMO_TEST_PACKAGE, *package_matrix]
        return [
            {
                "code": pkg["code"],
                "title": pkg["title"],
                "credits": pkg["credits"],
                "price_stars": pkg["stars_price"],
                "bonus_percent": pkg["bonus_percent"],
                "provider": "telegram_stars",
                "sort_order": pkg["sort_order"],
            }
            for pkg in package_matrix
        ]

    # --------------------------------------------------------------- uploads

    def upload_source_file(self, user_id: str, filename: str, content: bytes) -> str:
        """Upload raw bytes server-side to R2, return the source_key."""
        self.get_or_create_user(user_id)
        upload_id = str(uuid4())
        source_key = f"source/{user_id}/{upload_id}/{filename}"
        try:
            from app.adapters.r2_client import upload_bytes
            upload_bytes(source_key, content, content_type="image/jpeg")
        except Exception:
            pass  # R2 not configured; source_key still usable for generate
        return source_key

    def register_upload(self, user_id: str, filename: str) -> dict[str, str]:
        self.get_or_create_user(user_id)
        upload_id = str(uuid4())
        source_key = f"source/{user_id}/{upload_id}/{filename}"
        signed_put_url = self._presigned_upload_url(source_key)
        return {
            "upload_id": upload_id,
            "source_key": source_key,
            "signed_put_url": signed_put_url,
        }

    @staticmethod
    def _presigned_upload_url(source_key: str) -> str:
        if not settings.r2_access_key_id:
            return f"https://r2.example/upload/{source_key}"
        try:
            from app.adapters.r2_client import presigned_put_url

            return presigned_put_url(source_key, content_type="image/jpeg")
        except Exception:
            return f"https://r2.example/upload/{source_key}"

    # --------------------------------------------------------------- orders

    def create_order(
        self,
        user_id: str,
        style_code: str,
        source_key: str,
        *,
        model_id: str | None = None,
        prompt: str | None = None,
        aspect_ratio: str = "1:1",
    ) -> OrderRow:
        self.get_or_create_user(user_id)
        model = self._resolve_model(model_id)
        style = STYLE_BY_ID.get(style_code)
        prompt_value = (prompt or (style["prompt_template"] if style else "") or "").strip()
        if aspect_ratio not in _VALID_ASPECT_RATIOS:
            aspect_ratio = "1:1"
        order = OrderRow(
            order_id=str(uuid4()),
            user_id=user_id,
            style_code=style_code,
            source_key=source_key,
            model_id=model["id"],
            prompt=prompt_value,
            aspect_ratio=aspect_ratio,
            status="awaiting_credit_or_payment",
            credit_cost=model["coins"],
            created_at=now_iso(),
            updated_at=now_iso(),
        )
        with get_session() as db:
            db.add(order)
            db.commit()
            db.refresh(order)
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

    def start_order(self, order_id: str, requesting_user_id: str | None = None) -> dict[str, Any]:
        with get_session() as db:
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            if requesting_user_id and order.user_id != requesting_user_id:
                raise ValueError("forbidden")

            # SELECT FOR UPDATE — prevents concurrent double-spend
            user = (
                db.query(UserRow)
                .filter(UserRow.user_id == order.user_id)
                .with_for_update()
                .first()
            )
            if not user:
                raise ValueError("user_not_found")

            # Debit credits
            if user.paid_credits >= order.credit_cost:
                user.paid_credits -= order.credit_cost
            else:
                order.status = "awaiting_credit_or_payment"
                order.updated_at = now_iso()
                db.commit()
                return {
                    "result": "paywall_required",
                    "order": self._serialize_order(order),
                    "wallet": self._serialize_wallet(user),
                }

            # Submit to provider
            provider_id = MODEL_BY_ID[order.model_id]["provider"]

            job = JobRow(
                job_id=str(uuid4()),
                order_id=order.order_id,
                provider=provider_id,
                status="queued",
                attempts=0,
                updated_at=now_iso(),
            )
            db.add(job)

            try:
                provider = self.provider_registry[provider_id]
                submit = provider.submit(
                    order_id=order.order_id,
                    model_id=order.model_id,
                    source_key=order.source_key,
                    source_image_url=self._build_source_image_url(order.source_key),
                    prompt=order.prompt,
                    aspect_ratio=order.aspect_ratio,
                )
            except Exception as exc:
                job.status = "failed"
                job.updated_at = now_iso()
                order.status = "failed"
                order.fail_reason_code = "technical_failed"
                order.updated_at = now_iso()
                user.paid_credits += order.credit_cost
                db.commit()
                raise ValueError(f"provider_error: {exc}") from exc

            job.status = "submitted"
            job.provider_task_id = submit.provider_task_id
            job.updated_at = now_iso()

            # Save result immediately for synchronous providers (NanoBanana/Imagen 4, etc.)
            # that return result_url inline. Async providers return status="submitted"
            # and result arrives later via webhook.
            if submit.result_url and submit.status == "done":
                order.status = "done"
                order.result_url = submit.result_url
                job.status = "done"
                job.updated_at = now_iso()
            else:
                order.status = "processing"

            order.updated_at = now_iso()
            db.commit()

            return {
                "result": "enqueued",
                "order": self._serialize_order(order),
                "job": self._serialize_job(job),
                "wallet": self._serialize_wallet(user),
            }

    def order_status(self, order_id: str) -> dict[str, Any]:
        with get_session() as db:
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            job = (
                db.query(JobRow)
                .filter(JobRow.order_id == order_id)
                .order_by(JobRow.updated_at.desc())
                .first()
            )
            return {
                "order": self._serialize_order(order),
                "job": self._serialize_job(job) if job else None,
            }

    def history(self, user_id: str) -> list[dict[str, Any]]:
        with get_session() as db:
            orders = (
                db.query(OrderRow)
                .filter(OrderRow.user_id == user_id)
                .order_by(OrderRow.created_at.desc())
                .all()
            )
            return [self._serialize_order(o) for o in orders]

    def photos(self, user_id: str) -> list[dict[str, Any]]:
        with get_session() as db:
            orders = (
                db.query(OrderRow)
                .filter(OrderRow.user_id == user_id)
                .order_by(OrderRow.created_at.desc())
                .all()
            )
            return [
                {
                    "order_id": o.order_id,
                    "style_code": o.style_code,
                    "model_id": o.model_id,
                    "status": o.status,
                    "prompt": o.prompt,
                    "result_url": o.result_url,
                    "is_favorite": bool(o.is_favorite),
                    "created_at": _to_iso(o.created_at),
                    "updated_at": _to_iso(o.updated_at),
                }
                for o in orders
            ]

    def toggle_favorite(self, user_id: str, order_id: str) -> dict[str, Any]:
        with get_session() as db:
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            if order.user_id != user_id:
                raise ValueError("forbidden")
            order.is_favorite = not bool(order.is_favorite)
            order.updated_at = now_iso()
            db.commit()
            return {"order_id": order_id, "is_favorite": order.is_favorite}

    def delete_photo(self, user_id: str, order_id: str) -> dict[str, Any]:
        with get_session() as db:
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            if order.user_id != user_id:
                raise ValueError("forbidden")

            db.query(JobRow).filter(JobRow.order_id == order_id).delete()
            db.delete(order)
            db.commit()
            return {"order_id": order_id, "deleted": True}

    # -------------------------------------------------------------- payments

    def purchase(self, user_id: str, package_code: str, provider: str = "telegram") -> dict[str, Any]:
        self.get_or_create_user(user_id)
        canonical_code = self._normalize_package_code(package_code)
        package = self._resolve_package(canonical_code)
        if package is None:
            raise ValueError("package_not_found")

        payment_id = str(uuid4())
        event_id = f"purchase-{payment_id}"
        payload = {
            "payment_id": payment_id,
            "user_id": user_id,
            "package_code": canonical_code,
            "status": "paid",
            "amount": package["stars_price"],
        }
        result = self.ingest_webhook(provider, event_id, payload)
        with get_session() as db:
            user = db.get(UserRow, user_id)
            return {
                "payment_id": payment_id,
                "provider": provider,
                "package_code": canonical_code,
                "result": result,
                "wallet": self._serialize_wallet(user),
            }

    def ingest_webhook(self, provider: str, event_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        provider = GENERATION_PROVIDER_ALIASES.get(provider, provider)

        with get_session() as db:
            # Idempotency: check if this event was already processed
            existing = (
                db.query(PaymentRow)
                .filter(PaymentRow.payment_id == event_id)
                .first()
            )
            if existing:
                return {"deduplicated": True}

            # Provider generation webhook (result/failure callback)
            if provider in self.provider_registry:
                order_id = str(payload.get("order_id", ""))
                event_type = str(payload.get("event_type", "done"))
                if not order_id:
                    return {"deduplicated": False, "ignored": True}

                order = db.get(OrderRow, order_id)
                if not order:
                    return {"deduplicated": False, "ignored": True}

                job = (
                    db.query(JobRow)
                    .filter(JobRow.order_id == order_id)
                    .order_by(JobRow.updated_at.desc())
                    .first()
                )

                if event_type == "done":
                    order.status = "done"
                    order.result_url = payload.get("result_url")
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
                    user = db.get(UserRow, order.user_id)
                    if user:
                        user.paid_credits += order.credit_cost
                elif event_type == "policy_failed":
                    order.status = "failed"
                    order.fail_reason_code = "policy_failed"
                    if job:
                        job.status = "failed"
                        job.updated_at = now_iso()

                order.updated_at = now_iso()
                db.commit()

            # Payment webhook (Stars / Stripe)
            if provider in {"telegram", "stripe"}:
                payment_id = event_id
                user_id = payload.get("user_id")
                package_code_raw = str(payload.get("package_code", ""))
                package_code = self._normalize_package_code(package_code_raw)
                status = str(payload.get("status", "paid"))
                package = self._resolve_package(package_code)
                amount = int(payload.get("amount", package["stars_price"] if package else 0))

                payment = PaymentRow(
                    payment_id=payment_id,
                    provider=provider,
                    status=status,
                    package_code=package_code,
                    user_id=str(user_id) if user_id else None,
                    amount=amount,
                    created_at=now_iso(),
                )
                db.add(payment)

                if status == "paid" and user_id and package:
                    uid = str(user_id)
                    # SELECT FOR UPDATE prevents double-credit on duplicate webhooks
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
                            created_at=now_iso(),
                        )
                        db.add(user)
                    base_credits = package["credits"]
                    bonus_pct = package["bonus_percent"]
                    bonus_credits = math.ceil(base_credits * bonus_pct / 100) if bonus_pct else 0
                    user.paid_credits += base_credits + bonus_credits
                    logger.info(
                        "payment_credited user_id=%s package=%s credits=%d+%d total_now=%d",
                        uid, package_code, base_credits, bonus_credits, user.paid_credits,
                    )
                else:
                    logger.warning(
                        "payment_skipped_credit status=%s user_id=%s package=%s",
                        status, user_id, package_code,
                    )

                db.commit()

        return {"deduplicated": False, "accepted": True}

    # ------------------------------------------------------------ helpers

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
        return normalize_package_code(package_code)

    @staticmethod
    def _resolve_package(package_code: str) -> dict[str, Any] | None:
        if package_code in PACKAGE_CREDITS:
            return {
                "code": package_code,
                "credits": PACKAGE_CREDITS[package_code],
                "stars_price": PACKAGE_STARS_PRICES[package_code],
                "bonus_percent": PACKAGE_BONUS_PERCENT.get(package_code, 0),
            }
        if settings.free_demo_mode and package_code == "TEST":
            return {
                "code": "TEST",
                "credits": _DEMO_TEST_PACKAGE["credits"],
                "stars_price": _DEMO_TEST_PACKAGE["stars_price"],
                "bonus_percent": _DEMO_TEST_PACKAGE["bonus_percent"],
            }
        return None

    @staticmethod
    def _serialize_wallet(user: UserRow) -> dict[str, Any]:
        return {
            "paid_credits": user.paid_credits,
        }

    @staticmethod
    def _serialize_order(order: OrderRow) -> dict[str, Any]:
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
            "result_url": order.result_url,
            "fail_reason_code": order.fail_reason_code,
            "created_at": _to_iso(order.created_at),
            "updated_at": _to_iso(order.updated_at),
        }

    @staticmethod
    def _serialize_job(job: JobRow) -> dict[str, Any]:
        return {
            "job_id": job.job_id,
            "order_id": job.order_id,
            "provider": job.provider,
            "status": job.status,
            "attempts": job.attempts,
            "provider_task_id": job.provider_task_id,
            "updated_at": _to_iso(job.updated_at),
        }
