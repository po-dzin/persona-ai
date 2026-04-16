from __future__ import annotations

import io
import json
import time
import logging
from typing import Any, Callable, TypeVar
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

logger = logging.getLogger(__name__)

T = TypeVar("T")

# HTTP status codes that are transient and safe to retry.
_RETRYABLE_HTTP_CODES = {429, 500, 502, 503, 504}


class ProviderHTTPError(RuntimeError):
    """Raised when provider HTTP call fails."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _with_retry(
    fn: Callable[[], T],
    *,
    max_attempts: int = 3,
    base_delay: float = 1.0,
    retryable_codes: frozenset[int] = frozenset(_RETRYABLE_HTTP_CODES),
) -> T:
    """Call fn() with exponential backoff on retryable ProviderHTTPErrors.

    Retries on:
    - HTTP 429, 500, 502, 503, 504
    - Network errors (URLError / timeout)

    Does NOT retry on 400, 401, 403, 404, 422 — these are caller errors.
    Raises the last exception after max_attempts exhausted.
    """
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except ProviderHTTPError as exc:
            code = exc.status_code
            if code is not None and code not in retryable_codes:
                raise  # non-retryable — fail immediately
            last_exc = exc
            if attempt < max_attempts:
                delay = base_delay * (2 ** (attempt - 1))
                logger.warning(
                    "provider request failed (attempt %d/%d, status=%s), retrying in %.1fs: %s",
                    attempt, max_attempts, code, delay, exc,
                )
                time.sleep(delay)
        except Exception as exc:
            # Network / timeout errors are always retryable
            last_exc = exc
            if attempt < max_attempts:
                delay = base_delay * (2 ** (attempt - 1))
                logger.warning(
                    "provider request network error (attempt %d/%d), retrying in %.1fs: %s",
                    attempt, max_attempts, delay, exc,
                )
                time.sleep(delay)

    raise last_exc  # type: ignore[misc]


def post_json(
    *,
    url: str,
    headers: dict[str, str] | None,
    payload: dict[str, Any],
    timeout_seconds: int = 45,
    max_attempts: int = 3,
) -> dict[str, Any]:
    def _call() -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req_headers = {"Content-Type": "application/json", **(headers or {})}
        req = Request(url=url, data=body, headers=req_headers, method="POST")
        try:
            with urlopen(req, timeout=timeout_seconds) as response:
                raw = response.read().decode("utf-8")
                if not raw:
                    return {}
                decoded = json.loads(raw)
                return decoded if isinstance(decoded, dict) else {"raw": decoded}
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise ProviderHTTPError(f"http_{exc.code}: {details}", status_code=exc.code) from exc
        except URLError as exc:
            raise ProviderHTTPError(f"network_error: {exc.reason}") from exc

    return _with_retry(_call, max_attempts=max_attempts)


def get_json(
    *,
    url: str,
    headers: dict[str, str] | None = None,
    timeout_seconds: int = 30,
    max_attempts: int = 3,
) -> dict[str, Any]:
    def _call() -> dict[str, Any]:
        req = Request(url=url, headers=(headers or {}), method="GET")
        try:
            with urlopen(req, timeout=timeout_seconds) as response:
                raw = response.read().decode("utf-8")
                if not raw:
                    return {}
                decoded = json.loads(raw)
                return decoded if isinstance(decoded, dict) else {"raw": decoded}
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise ProviderHTTPError(f"http_{exc.code}: {details}", status_code=exc.code) from exc
        except URLError as exc:
            raise ProviderHTTPError(f"network_error: {exc.reason}") from exc

    return _with_retry(_call, max_attempts=max_attempts)


def fetch_bytes(url: str, timeout_seconds: int = 30, max_attempts: int = 3) -> bytes:
    """Download raw bytes from a URL (e.g. provider result image)."""
    def _call() -> bytes:
        req = Request(url, headers={"User-Agent": "PersonAI/1.0"})
        try:
            with urlopen(req, timeout=timeout_seconds) as resp:
                return resp.read()
        except HTTPError as exc:
            raise ProviderHTTPError(f"fetch_failed: http_{exc.code}", status_code=exc.code) from exc
        except URLError as exc:
            raise ProviderHTTPError(f"fetch_failed: {exc}") from exc

    return _with_retry(_call, max_attempts=max_attempts)


def _encode_multipart(
    fields: dict[str, str],
    files: dict[str, tuple[str, bytes, str]],
) -> tuple[bytes, str]:
    """Encode fields + files as multipart/form-data. Returns (body, content_type)."""
    boundary = uuid4().hex
    buf = io.BytesIO()

    for name, value in fields.items():
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        buf.write(value.encode("utf-8") + b"\r\n")

    for name, (filename, data, content_type) in files.items():
        buf.write(f"--{boundary}\r\n".encode())
        buf.write(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        buf.write(f"Content-Type: {content_type}\r\n\r\n".encode())
        buf.write(data + b"\r\n")

    buf.write(f"--{boundary}--\r\n".encode())
    return buf.getvalue(), f"multipart/form-data; boundary={boundary}"


def post_multipart_bytes(
    *,
    url: str,
    headers: dict[str, str] | None,
    fields: dict[str, str],
    files: dict[str, tuple[str, bytes, str]],
    timeout_seconds: int = 60,
    max_attempts: int = 3,
) -> bytes:
    """POST multipart/form-data and return raw response bytes."""
    def _call() -> bytes:
        body, content_type = _encode_multipart(fields, files)
        req_headers = {"Content-Type": content_type, **(headers or {})}
        req = Request(url=url, data=body, headers=req_headers, method="POST")
        try:
            with urlopen(req, timeout=timeout_seconds) as response:
                return response.read()
        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise ProviderHTTPError(f"http_{exc.code}: {details}", status_code=exc.code) from exc
        except URLError as exc:
            raise ProviderHTTPError(f"network_error: {exc.reason}") from exc

    return _with_retry(_call, max_attempts=max_attempts)
