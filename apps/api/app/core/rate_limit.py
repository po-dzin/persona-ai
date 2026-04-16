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


class RedisRateLimiter:
    """
    Fixed-window rate limiter backed by Redis INCR + EXPIRE.

    Falls back to the companion InMemoryRateLimiter if Redis is unavailable,
    so the app keeps running in degraded mode rather than crashing.

    Test-compatibility shims:
      - ``limiter.calls = N`` propagates to the fallback so test overrides work.
      - ``limiter._windows`` proxies to ``fallback._windows`` for state reset.
    """

    def __init__(
        self,
        calls: int,
        period: int,
        key_prefix: str = "",
        fallback: InMemoryRateLimiter | None = None,
    ) -> None:
        self._calls = calls
        self._period = period        # seconds (Redis TTL window)
        self.key_prefix = key_prefix
        self.fallback = fallback
        self._redis: object | None = None
        self._redis_retry_after: float = 0.0  # monotonic timestamp; 0 = try immediately

    # ── Test-compatibility shims ──────────────────────────────────────────────

    @property
    def calls(self) -> int:
        return self._calls

    @calls.setter
    def calls(self, value: int) -> None:
        self._calls = value
        if self.fallback is not None:
            self.fallback.calls = value  # sync so fallback enforces same limit in tests

    @property
    def period(self) -> int:
        return self._period

    @period.setter
    def period(self, value: int) -> None:
        self._period = value
        if self.fallback is not None:
            self.fallback.period = value

    @property
    def _windows(self) -> dict:  # type: ignore[type-arg]
        """Proxy to fallback windows so tests can call ``limiter._windows.clear()``."""
        if self.fallback is not None:
            return self.fallback._windows
        return {}

    _REDIS_RETRY_INTERVAL = 30.0  # seconds before retrying a broken Redis connection

    def _get_redis(self) -> object | None:
        import time

        now = time.monotonic()
        # Still in backoff window — don't hammer a down Redis on every request
        if self._redis_retry_after and now < self._redis_retry_after:
            return None
        if self._redis is not None:
            return self._redis
        try:
            from app.core.settings import settings
            import redis as redis_lib

            client = redis_lib.Redis.from_url(
                settings.redis_url,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                decode_responses=True,
            )
            client.ping()
            self._redis = client
            self._redis_retry_after = 0.0  # clear backoff on successful connect
            return client
        except Exception:
            self._redis = None
            self._redis_retry_after = now + self._REDIS_RETRY_INTERVAL
            return None

    def _get_key(self, request: Request, use_user_id: bool = False) -> str:
        if use_user_id:
            user_id = getattr(request.state, "user_id", None)
            if user_id:
                return f"rl:{self.key_prefix}u:{user_id}"
        forwarded = request.headers.get("X-Forwarded-For", "")
        ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )
        return f"rl:{self.key_prefix}ip:{ip}"

    def check(self, request: Request, use_user_id: bool = False) -> None:
        r = self._get_redis()
        if r is None:
            if self.fallback:
                self.fallback.check(request, use_user_id)
            return  # no fallback → allow (fail open, prefer availability)

        key = self._get_key(request, use_user_id)
        try:
            pipe = r.pipeline()  # type: ignore[attr-defined]
            pipe.incr(key)
            pipe.expire(key, self.period)
            count, _ = pipe.execute()
            if count > self.calls:
                raise HTTPException(
                    status_code=429,
                    detail="rate_limit_exceeded",
                    headers={"Retry-After": str(self.period)},
                )
        except HTTPException:
            raise
        except Exception:
            # Redis error mid-request — fall back rather than 500
            if self.fallback:
                self.fallback.check(request, use_user_id)


def _make_limiter(calls: int, period: int, key_prefix: str) -> RedisRateLimiter:
    """
    Create a Redis-backed limiter with an in-memory fallback.
    The in-memory instance is intentionally more permissive (3× calls)
    so a Redis outage doesn't cause false 429s at normal traffic.
    """
    mem = InMemoryRateLimiter(calls=calls * 3, period=period, key_prefix=key_prefix)
    return RedisRateLimiter(calls=calls, period=period, key_prefix=key_prefix, fallback=mem)


# 10 generations per minute per user
generate_limiter = _make_limiter(calls=10, period=60, key_prefix="gen:")

# 300 Telegram webhook calls per minute per IP (Telegram can be chatty)
tg_webhook_limiter = _make_limiter(calls=300, period=60, key_prefix="tgwh:")

# 30 file uploads per minute per user
upload_limiter = _make_limiter(calls=30, period=60, key_prefix="upl:")

# 120 admin API calls per minute per IP
admin_limiter = _make_limiter(calls=120, period=60, key_prefix="adm:")
