from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


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
