from __future__ import annotations

"""
Minimal Telegram Bot helpers.
All Telegram API calls use plain urllib (no SDK dependency).
"""

import json
import logging
from typing import TYPE_CHECKING, Any
from urllib.request import Request, urlopen
from urllib.error import URLError

logger = logging.getLogger(__name__)

from app.services.package_codes import normalize_package_code
from app.core.settings import settings
from shared.contracts.status import PACKAGE_CREDITS, PACKAGE_STARS_PRICES

if TYPE_CHECKING:
    from app.services.vertical_slice import VerticalSliceService


def _tg_api(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    token = settings.telegram_bot_token
    url = f"https://api.telegram.org/bot{token}/{method}"
    body = json.dumps(payload).encode("utf-8")
    req = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception:
        return {}


def send_text_message(chat_id: int | str, text: str) -> bool:
    resp = _tg_api(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
        },
    )
    return bool(resp.get("ok"))


async def send_start_message(chat_id: int | str) -> None:
    """Send welcome message with 'Open App' button."""
    miniapp_url = settings.telegram_miniapp_url
    _tg_api(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": (
                "👋 Привет! Я превращаю обычные фото в 🔥 AI-портреты.\n"
                "Я уже начислил тебе 20 монет 🎁 — открывай приложение и попробуй!\n\n"
                "Нажми кнопку ниже, чтобы открыть PersonAI 👇"
            ),
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "🎨 Открыть PersonAI", "web_app": {"url": miniapp_url}}]
                ]
            },
        },
    )


async def answer_pre_checkout(pre_checkout_query_id: str) -> None:
    """Auto-approve all Stars pre-checkout queries.

    Uses asyncio.to_thread so the synchronous urllib call does not block
    the event loop — Telegram requires a reply within 10 seconds.
    """
    import asyncio
    await asyncio.to_thread(
        _tg_api,
        "answerPreCheckoutQuery",
        {"pre_checkout_query_id": pre_checkout_query_id, "ok": True},
    )


def create_invoice_link(package_code: str) -> str:
    """Create a Telegram Stars invoice link for the given package."""
    from shared.contracts.status import (
        PACKAGE_BONUS_COINS,
        PACKAGE_CREDITS,
        PACKAGE_STARS_PRICES,
        PACKAGE_TITLES,
    )
    package_code = normalize_package_code(package_code)

    if package_code in PACKAGE_CREDITS:
        stars = PACKAGE_STARS_PRICES[package_code]
        credits = PACKAGE_CREDITS[package_code]
        bonus = PACKAGE_BONUS_COINS.get(package_code, 0)
        total_credits = credits + bonus
        title = PACKAGE_TITLES.get(package_code, package_code)
    elif settings.free_demo_mode and package_code == "TEST":
        # Demo/test package: 1 Star, credited then refunded automatically
        from app.services.vertical_slice import _DEMO_TEST_PACKAGE
        stars = _DEMO_TEST_PACKAGE["stars_price"]      # 1 Star
        total_credits = _DEMO_TEST_PACKAGE["credits"]
        title = "Тест"
    else:
        raise ValueError(f"package_not_found: {package_code}")

    resp = _tg_api(
        "createInvoiceLink",
        {
            "title": f"{title} — {total_credits} монет",
            "description": f"Пополнение баланса PersonAI на {total_credits} монет",
            "payload": f"PACKAGE_{package_code}",
            "currency": "XTR",
            "prices": [{"label": "Монеты", "amount": stars}],
        },
    )
    return resp.get("result", "")


def refund_star_payment(*, user_id: str | int, telegram_payment_charge_id: str) -> bool:
    """Refund Telegram Stars payment back to user."""
    if not telegram_payment_charge_id:
        return False
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return False
    resp = _tg_api(
        "refundStarPayment",
        {
            "user_id": uid,
            "telegram_payment_charge_id": telegram_payment_charge_id,
        },
    )
    return bool(resp.get("ok") and resp.get("result") is True)


def handle_successful_payment(
    *,
    user_id: str,
    payload: str,
    stars: int,
    telegram_payment_charge_id: str = "",
    svc: "VerticalSliceService",
) -> None:
    """
    Credit user after successful Stars payment.
    invoice_payload format: "PACKAGE_{CODE}" e.g. "PACKAGE_STARTER"
    Falls back to matching by stars amount if payload is unrecognised.
    """
    package_code = _resolve_package(payload, stars)
    if not package_code:
        logger.error("payment_package_not_resolved user_id=%s payload=%s stars=%s", user_id, payload, stars)
        return

    # Use the Telegram charge ID as the stable idempotency key so Telegram
    # retries of the same payment are deduplicated correctly.  Fall back to a
    # deterministic (content-addressed) key when the charge ID is absent so
    # even mocked/test retries are deduplicated correctly.
    event_id = telegram_payment_charge_id or f"tg-stars-{user_id}-{stars}-{payload}"
    logger.info("payment_crediting user_id=%s package=%s stars=%s event_id=%s", user_id, package_code, stars, event_id)
    try:
        svc.ingest_webhook(
            "telegram",
            event_id,
            {
                "telegram_payment_charge_id": telegram_payment_charge_id,
                "user_id": user_id,
                "package_code": package_code,
                "status": "paid",
                "amount": stars,
            },
        )
    except Exception:
        # Re-raise so the webhook handler returns 5xx to Telegram.
        # Telegram will retry the delivery, and our stable event_id
        # (telegram_payment_charge_id) ensures the retry is idempotent.
        logger.error(
            "payment_ingest_failed user_id=%s package=%s event_id=%s",
            user_id, package_code, event_id, exc_info=True,
        )
        raise
    # Refund only for the TEST demo package so real purchases are never
    # auto-refunded even when FREE_DEMO_MODE is enabled in production.
    if settings.free_demo_mode and package_code == "TEST" and telegram_payment_charge_id:
        ok = refund_star_payment(
            user_id=user_id,
            telegram_payment_charge_id=telegram_payment_charge_id,
        )
        if not ok:
            logger.error(
                "demo_refund_failed user_id=%s charge_id=%s",
                user_id, telegram_payment_charge_id,
            )


def _resolve_package(payload: str, stars: int) -> str | None:
    # Try payload first: expected format is "PACKAGE_STARTER" etc.
    if payload.startswith("PACKAGE_"):
        code = normalize_package_code(payload)
        if code in PACKAGE_CREDITS:
            return code
        # Demo TEST package lives outside PACKAGE_CREDITS
        if settings.free_demo_mode and code == "TEST":
            return "TEST"

    # Fallback: match by stars price (nearest)
    best = min(PACKAGE_STARS_PRICES.items(), key=lambda kv: abs(kv[1] - stars), default=None)
    if best and abs(best[1] - stars) <= 10:
        return best[0]

    return None


def send_photo_to_user(chat_id: str, photo_url: str, app_link: str | None = None) -> dict[str, Any]:
    """Send a generated photo back to the user via Telegram bot."""
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "photo": photo_url,
        "caption": "Ваше фото из PersonAI ✨\nНажмите «Открыть в PersonAI», чтобы повторить стиль на своем фото.",
    }
    if app_link:
        payload["reply_markup"] = {
            "inline_keyboard": [
                [{"text": "🎨 Открыть в PersonAI", "web_app": {"url": app_link}}],
            ],
        }
    return _tg_api(
        "sendPhoto",
        payload,
    )


def register_webhook(webhook_url: str, secret: str) -> dict[str, Any]:
    """Register (or re-register) the bot webhook with Telegram.

    Always calls setWebhook so that a rotated TELEGRAM_WEBHOOK_SECRET is
    applied immediately — getWebhookInfo does not expose the current secret,
    so a URL-only equality check would silently skip secret updates and cause
    every subsequent webhook request to be rejected with 403.

    drop_pending_updates is intentionally omitted so successful_payment events
    that queued during a deploy restart are not silently discarded.
    """
    logger.info("tg_webhook_registering url=%s", webhook_url)
    return _tg_api(
        "setWebhook",
        {
            "url": webhook_url,
            "secret_token": secret,
            "allowed_updates": ["message", "pre_checkout_query"],
            # drop_pending_updates intentionally omitted.
        },
    )
