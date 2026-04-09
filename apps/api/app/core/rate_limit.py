from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter. Thread-safe, no Redis required."""

    def __init__(self, calls: int, period: float, key_prefix: str = "") -> None:
        self.calls = calls
        self.period = period
        self.key_prefix = key_prefix
        self._lock = threading.Lock()
        self._windows: dict[str, deque[float]] = defaultdict(deque)

    def _get_key(self, request: Request, use_user_id: bool = False) -> str:
        if use_user_id:
            # Prefer authenticated user ID over IP (set by require_user)
            user_id = getattr(request.state, "user_id", None)
            if user_id:
                return f"{self.key_prefix}u:{user_id}"
        forwarded = request.headers.get("X-Forwarded-For", "")
        ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )
        return f"{self.key_prefix}ip:{ip}"

    def check(self, request: Request, use_user_id: bool = False) -> None:
        key = self._get_key(request, use_user_id)
        now = time.monotonic()
        cutoff = now - self.period
        with self._lock:
            window = self._windows[key]
            while window and window[0] < cutoff:
                window.popleft()
            if len(window) >= self.calls:
                raise HTTPException(
                    status_code=429,
                    detail="rate_limit_exceeded",
                    headers={"Retry-After": str(int(self.period))},
                )
            window.append(now)


# 10 generations per minute per user
generate_limiter = InMemoryRateLimiter(calls=10, period=60, key_prefix="gen:")

# 300 Telegram webhook calls per minute per IP (Telegram can be chatty)
tg_webhook_limiter = InMemoryRateLimiter(calls=300, period=60, key_prefix="tgwh:")

# 30 file uploads per minute per user
upload_limiter = InMemoryRateLimiter(calls=30, period=60, key_prefix="upl:")

# 120 admin API calls per minute per IP
admin_limiter = InMemoryRateLimiter(calls=120, period=60, key_prefix="adm:")
