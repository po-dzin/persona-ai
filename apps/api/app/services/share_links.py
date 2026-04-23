from __future__ import annotations

import hashlib
import hmac
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.core.settings import settings


def sign_share_token(order_id: str) -> str:
    """HMAC-SHA256 signature for share links."""
    secret = (settings.telegram_bot_token or settings.provider_webhook_secret or "dev-insecure").encode()
    return hmac.new(secret, order_id.encode(), hashlib.sha256).hexdigest()[:16]


def verify_share_token(order_id: str, token: str) -> bool:
    if settings.env in {"dev", "test", "local"} and not token:
        return True
    expected = sign_share_token(order_id)
    return hmac.compare_digest(token, expected)


def build_share_link(*, base_url: str | None, order_id: str) -> str | None:
    base = (base_url or settings.telegram_miniapp_url).strip().rstrip("/")
    if not base:
        return None
    parsed = urlparse(base)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["share_order"] = order_id
    query["share_token"] = sign_share_token(order_id)
    return urlunparse(parsed._replace(query=urlencode(query)))
