from __future__ import annotations

import io
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4


class ProviderHTTPError(RuntimeError):
    """Raised when provider HTTP call fails."""


def post_json(
    *,
    url: str,
    headers: dict[str, str] | None,
    payload: dict[str, Any],
    timeout_seconds: int = 45,
) -> dict[str, Any]:
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
        raise ProviderHTTPError(f"http_{exc.code}: {details}") from exc
    except URLError as exc:
        raise ProviderHTTPError(f"network_error: {exc.reason}") from exc


def get_json(
    *,
    url: str,
    headers: dict[str, str] | None = None,
    timeout_seconds: int = 30,
) -> dict[str, Any]:
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
        raise ProviderHTTPError(f"http_{exc.code}: {details}") from exc
    except URLError as exc:
        raise ProviderHTTPError(f"network_error: {exc.reason}") from exc


def fetch_bytes(url: str, timeout_seconds: int = 30) -> bytes:
    """Download raw bytes from a URL (e.g. provider result image)."""
    req = Request(url, headers={"User-Agent": "PersonAI/1.0"})
    try:
        with urlopen(req, timeout=timeout_seconds) as resp:
            return resp.read()
    except (HTTPError, URLError) as exc:
        raise ProviderHTTPError(f"fetch_failed: {exc}") from exc


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
) -> bytes:
    """POST multipart/form-data and return raw response bytes."""
    body, content_type = _encode_multipart(fields, files)
    req_headers = {"Content-Type": content_type, **(headers or {})}
    req = Request(url=url, data=body, headers=req_headers, method="POST")

    try:
        with urlopen(req, timeout=timeout_seconds) as response:
            return response.read()
    except HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise ProviderHTTPError(f"http_{exc.code}: {details}") from exc
    except URLError as exc:
        raise ProviderHTTPError(f"network_error: {exc.reason}") from exc
