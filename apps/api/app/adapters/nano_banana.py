from __future__ import annotations

import base64

from app.adapters.http_client import ProviderHTTPError, post_json
from app.adapters.mock_provider import MockPhotoProvider
from app.adapters.provider_base import ProviderSubmitResult

# Google AI Studio (Imagen 3) — text-to-image (cheapest tier)
_IMAGEN_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_IMAGEN_MODEL = "imagen-3.0-generate-002"

# Imagen 3 accepts these aspect ratios
_VALID_AR = {"1:1", "3:4", "4:3", "9:16", "16:9"}


class NanoBananaAdapter(MockPhotoProvider):
    """
    Nano Banana = Google Imagen 3 via AI Studio API.

    Text-to-image only (cheapest tier, 10 coins).
    Source photo is ignored by the model; style is conveyed via prompt.
    Result: base64 PNG → stored in R2.
    """

    def __init__(
        self,
        *,
        integration_mode: str = "mock",
        real_calls_enabled: bool = False,
        api_key: str = "",
        timeout_seconds: int = 45,
    ) -> None:
        super().__init__(provider_id="nano_banana")
        self.integration_mode = integration_mode
        self.real_calls_enabled = real_calls_enabled
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

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

        ar = aspect_ratio if aspect_ratio in _VALID_AR else "1:1"
        url = f"{_IMAGEN_BASE}/{_IMAGEN_MODEL}:predict?key={self.api_key}"

        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": ar,
                "outputMimeType": "image/jpeg",
            },
        }

        try:
            resp = post_json(url=url, headers={}, payload=payload, timeout_seconds=self.timeout_seconds)
        except ProviderHTTPError:
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        predictions = resp.get("predictions") or []
        if not predictions:
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        b64 = predictions[0].get("bytesBase64Encoded", "")
        if not b64:
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        img_bytes = base64.b64decode(b64)
        result_url = self._store_to_r2(img_bytes, order_id)
        return ProviderSubmitResult(
            provider_task_id=f"imagen-{order_id}",
            status="done",
            result_url=result_url,
        )

    @staticmethod
    def _store_to_r2(img_bytes: bytes, order_id: str) -> str:
        from app.adapters.r2_client import upload_bytes

        key = f"results/nano/{order_id}.jpg"
        return upload_bytes(key, img_bytes, content_type="image/jpeg")

    def _is_real(self) -> bool:
        return (
            self.integration_mode == "real"
            and self.real_calls_enabled
            and bool(self.api_key)
        )
