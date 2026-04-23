from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.db import UserRow
from app.services.tg_bot import send_text_message

_STATE_TEMPLATES: dict[str, tuple[str, ...]] = {
    "S1": (
        "Готово к старту 😏 Пополни баланс и запусти первую генерацию — результат будет через минуту.",
        "Выбери стиль, пополни баланс и получи свое первое AI-фото уже сейчас ✨",
    ),
    "S2": (
        "Новый стиль уже в приложении ✨ [название стиля] — попробуй первым!",
        "Сейчас в тренде [название стиля] 🔥 Сделай свой кадр в этом образе.",
        "Тебе может зайти [похожий стиль] 🎨 Зайди и создай новую генерацию.",
    ),
    "S3": (
        "Давно не виделись 👀 Заходи, тебя ждут новые стили и свежие образы.",
        "Твои монеты на месте — время сделать новую генерацию ⚡ Выбери стиль и продолжай.",
    ),
    "S4": (
        "Монет почти не осталось ⚡ Пополни баланс, чтобы не прерывать генерации.",
        "Осталось мало монет — пополни сейчас и продолжай делать фото в любимых стилях.",
    ),
    "S5": (
        "Монеты на нуле 🚨 Пополни баланс и вернись к созданию AI-фото.",
        "Баланс = 0. Пополни сейчас, чтобы снова запускать генерации без ограничений.",
    ),
}

_STATE_COOLDOWN = timedelta(days=1)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _has_state_cooldown(user: UserRow, state: str, now: datetime) -> bool:
    if user.lifecycle_last_message_state != state:
        return False
    if not user.lifecycle_last_message_at:
        return False
    ts = user.lifecycle_last_message_at
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return (now - ts) < _STATE_COOLDOWN


def _is_due(user: UserRow, state: str, now: datetime) -> bool:
    if _has_state_cooldown(user, state, now):
        return False
    if state == "S1":
        if not user.first_miniapp_opened_at:
            return False
        return now - user.first_miniapp_opened_at >= timedelta(hours=24)
    return state in _STATE_TEMPLATES


def _pick_template(user_id: str, state: str, now: datetime) -> str:
    variants = _STATE_TEMPLATES[state]
    day_bucket = int(now.timestamp() // 86400)
    idx = (day_bucket + sum(ord(ch) for ch in user_id)) % len(variants)
    return variants[idx]


def maybe_send_lifecycle_message(
    db: Session,
    user: UserRow,
    *,
    now: datetime | None = None,
) -> bool:
    _ = db
    now = now or _now_utc()
    state = user.lifecycle_state or "S0"
    if state not in _STATE_TEMPLATES:
        return False
    if not _is_due(user, state, now):
        return False

    text = _pick_template(user.user_id, state, now)
    if not send_text_message(user.user_id, text):
        return False

    user.lifecycle_last_message_state = state
    user.lifecycle_last_message_at = now
    return True
