from __future__ import annotations

import hashlib
import hmac
import json
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException

from app.core.settings import settings

_DEV_MODES = {"dev", "test", "local"}


def _verify_init_data(init_data: str) -> dict | None:
    """
    Validate Telegram WebApp initData string.
    Returns parsed user dict or None if invalid.
    """
    try:
        pairs = dict(parse_qsl(init_data, strict_parsing=True))
    except Exception:
        return None

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None

    data_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(
        b"WebAppData",
        settings.telegram_bot_token.encode(),
        hashlib.sha256,
    ).digest()
    expected = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(received_hash, expected):
        return None

    user_json = pairs.get("user", "{}")
    try:
        return json.loads(user_json)
    except Exception:
        return None


def require_user(
    x_telegram_init_data: str = Header(default=""),
) -> str:
    """
    FastAPI dependency: validates Telegram initData, returns user_id str.

    In dev/test mode accepts any non-empty user_id from header
    X-Dev-User-Id as fallback (no auth check).
    """
    if init_data := x_telegram_init_data.strip():
        user = _verify_init_data(init_data)
        if user and user.get("id"):
            return str(user["id"])
        # Invalid data provided — always reject regardless of env
        raise HTTPException(status_code=401, detail="invalid_telegram_init_data")

    # No init_data: allow only in non-prod
    if settings.env not in _DEV_MODES:
        raise HTTPException(status_code=401, detail="missing_telegram_init_data")

    return "demo-user"
