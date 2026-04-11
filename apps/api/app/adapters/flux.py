from __future__ import annotations

import time

from app.adapters.http_client import ProviderHTTPError, fetch_bytes, get_json, post_json
from app.adapters.mock_provider import MockPhotoProvider
from app.adapters.provider_base import ProviderSubmitResult

# Catalogue model_id → BFL API endpoint slug
_BFL_ENDPOINT: dict[str, str] = {
    "flux2-pro-1k": "flux-2-pro",
    "flux2-pro-2k": "flux-2-pro",
    "flux2-pro-4k": "flux-2-pro",
    "flux2-max-1k": "flux-2-max",
    "flux2-max-2k": "flux-2-max",
    "flux2-max-4k": "flux-2-max",
}

_ASPECT_TO_WH: dict[str, tuple[int, int]] = {
    "1:1": (1024, 1024),
    "4:3": (1365, 1024),
    "3:4": (1024, 1365),
    "16:9": (1820, 1024),
    "9:16": (1024, 1820),
}

# BFL polling terminal statuses
_TERMINAL_OK = {"Ready"}
_TERMINAL_ERR = {"Error", "Failed", "Content Moderated", "Request Moderated"}

_QUALITY_MULTIPLIER = {
    "1k": 1.0,
    "2k": 2**0.5,
    "4k": 2.0,
}


class FluxAdapter(MockPhotoProvider):
    def __init__(
        self,
        *,
        integration_mode: str = "mock",
        real_calls_enabled: bool = False,
        api_key: str = "",
        api_base_url: str = "https://api.bfl.ai/v1",
        timeout_seconds: int = 120,
        poll_interval: float = 1.5,
        max_polls: int = 80,
    ) -> None:
        super().__init__(provider_id="flux")
        self.integration_mode = integration_mode
        self.real_calls_enabled = real_calls_enabled
        self.api_key = api_key
        self.api_base_url = api_base_url.strip().rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.poll_interval = poll_interval
        self.max_polls = max_polls

    def submit(
        self,
        *,
        order_id: str,
        model_id: str,
        source_key: str,
        source_image_url: str,
        prompt: str,
        aspect_ratio: str,
    ) -> ProviderSubmitResult:
        if not self._is_real():
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        endpoint_slug = _BFL_ENDPOINT.get(model_id, "flux-2-pro")
        url = f"{self.api_base_url}/{endpoint_slug}"
        headers = {"x-key": self.api_key}
        base_w, base_h = _ASPECT_TO_WH.get(aspect_ratio, (1024, 1024))
        w, h = _apply_quality_scale(model_id=model_id, width=base_w, height=base_h)

        payload: dict = {
            "prompt": prompt,
            "output_format": "jpeg",
            "width": w,
            "height": h,
        }
        # Keep img2img for supported BFL endpoints.
        if source_image_url:
            payload["input_image"] = source_image_url

        try:
            resp = post_json(url=url, headers=headers, payload=payload, timeout_seconds=30)
        except ProviderHTTPError:
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        task_id = resp.get("id")
        if not task_id:
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        # Synchronous poll (no worker) — blocks for ~10-60s
        bfl_url = self._poll(str(task_id), headers)
        if not bfl_url:
            return ProviderSubmitResult(
                provider_task_id=str(task_id),
                status="submitted",
            )

        # Download from BFL CDN and store permanently in R2
        result_url = self._store_to_r2(bfl_url, order_id)
        return ProviderSubmitResult(
            provider_task_id=str(task_id),
            status="done",
            result_url=result_url,
        )

    def _poll(self, task_id: str, headers: dict) -> str | None:
        poll_url = f"{self.api_base_url}/get_result?id={task_id}"
        for _ in range(self.max_polls):
            time.sleep(self.poll_interval)
            try:
                data = get_json(url=poll_url, headers=headers, timeout_seconds=15)
            except ProviderHTTPError:
                continue
            status = str(data.get("status", ""))
            if status in _TERMINAL_OK:
                result = data.get("result") or {}
                return result.get("sample")  # signed CDN URL
            if status in _TERMINAL_ERR:
                return None
        return None

    @staticmethod
    def _store_to_r2(bfl_url: str, order_id: str) -> str:
        from app.adapters.r2_client import upload_bytes

        img_bytes = fetch_bytes(bfl_url, timeout_seconds=30)
        key = f"results/flux/{order_id}.jpg"
        return upload_bytes(key, img_bytes, content_type="image/jpeg")

    def _is_real(self) -> bool:
        return (
            self.integration_mode == "real"
            and self.real_calls_enabled
            and bool(self.api_key)
        )


def _apply_quality_scale(*, model_id: str, width: int, height: int) -> tuple[int, int]:
    quality = _extract_quality(model_id)
    multiplier = _QUALITY_MULTIPLIER.get(quality, 1.0)
    scaled_w = max(512, int(round(width * multiplier)))
    scaled_h = max(512, int(round(height * multiplier)))
    return scaled_w, scaled_h


def _extract_quality(model_id: str) -> str:
    if model_id.endswith("-2k"):
        return "2k"
    if model_id.endswith("-4k"):
        return "4k"
    return "1k"
