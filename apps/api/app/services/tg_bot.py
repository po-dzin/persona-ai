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
    except URLError:
        return {}


async def send_start_message(chat_id: int | str) -> None:
    """Send welcome message with 'Open App' button."""
    miniapp_url = settings.telegram_miniapp_url
    _tg_api(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": (
                "👋 Привет! Я PersonAI — превращаю твои фото в арт.\n\n"
                "Нажми кнопку ниже, чтобы открыть приложение 👇"
            ),
            "reply_markup": {
                "inline_keyboard": [
                    [{"text": "🎨 Открыть PersonAI", "web_app": {"url": miniapp_url}}]
                ]
            },
        },
    )


async def answer_pre_checkout(pre_checkout_query_id: str) -> None:
    """Auto-approve all Stars pre-checkout queries."""
    _tg_api(
        "answerPreCheckoutQuery",
        {"pre_checkout_query_id": pre_checkout_query_id, "ok": True},
    )


def create_invoice_link(package_code: str) -> str:
    """Create a Telegram Stars invoice link for the given package."""
    from shared.contracts.status import PACKAGE_CREDITS, PACKAGE_STARS_PRICES, PACKAGE_TITLES
    package_code = normalize_package_code(package_code)

    if package_code in PACKAGE_CREDITS:
        stars = PACKAGE_STARS_PRICES[package_code]
        credits = PACKAGE_CREDITS[package_code]
        title = PACKAGE_TITLES.get(package_code, package_code)
    elif settings.free_demo_mode and package_code == "TEST":
        # Demo/test package: 1 Star, credited then refunded automatically
        from app.services.vertical_slice import _DEMO_TEST_PACKAGE
        stars = _DEMO_TEST_PACKAGE["stars_price"]      # 1 Star
        credits = _DEMO_TEST_PACKAGE["credits"]
        title = "Тест"
    else:
        raise ValueError(f"package_not_found: {package_code}")

    resp = _tg_api(
        "createInvoiceLink",
        {
            "title": f"{title} — {credits} монет",
            "description": f"Пополнение баланса PersonAI на {credits} монет",
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

    from uuid import uuid4
    event_id = f"tg-stars-{user_id}-{stars}-{uuid4()}"
    logger.info("payment_crediting user_id=%s package=%s stars=%s event_id=%s", user_id, package_code, stars, event_id)
    svc.ingest_webhook(
        "telegram",
        event_id,
        {
            "payment_id": event_id,
            "user_id": user_id,
            "package_code": package_code,
            "status": "paid",
            "amount": stars,
        },
    )
    if settings.free_demo_mode and telegram_payment_charge_id:
        # Demo transactions: credit coins, then refund Stars to user.
        refund_star_payment(
            user_id=user_id,
            telegram_payment_charge_id=telegram_payment_charge_id,
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


def send_photo_to_user(chat_id: str, photo_url: str) -> dict[str, Any]:
    """Send a generated photo back to the user via Telegram bot."""
    return _tg_api(
        "sendPhoto",
        {
            "chat_id": chat_id,
            "photo": photo_url,
            "caption": "Ваше фото из Persona ✨",
        },
    )


def register_webhook(webhook_url: str, secret: str) -> dict[str, Any]:
    """Call once to register bot webhook with Telegram."""
    return _tg_api(
        "setWebhook",
        {
            "url": webhook_url,
            "secret_token": secret,
            "allowed_updates": ["message", "pre_checkout_query"],
            "drop_pending_updates": True,
        },
    )
