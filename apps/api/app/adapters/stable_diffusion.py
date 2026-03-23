from __future__ import annotations

from app.adapters.http_client import (
    ProviderHTTPError,
    fetch_bytes,
    post_multipart_bytes,
)
from app.adapters.mock_provider import MockPhotoProvider
from app.adapters.provider_base import ProviderSubmitResult

# model_id → Stability AI model string
_SD_MODEL_MAP: dict[str, str] = {
    "sd-3.5-turbo": "sd3.5-large-turbo",
    "sd-3.5-large": "sd3.5-large",
    "sd-3.5-medium": "sd3.5-medium",
}

# Stability AI supports aspect_ratio directly
_VALID_ASPECT_RATIOS = {"1:1", "16:9", "9:16", "3:4", "4:3", "21:9", "5:4", "2:3"}


class StableDiffusionAdapter(MockPhotoProvider):
    """
    Real Stability AI SD 3.5 adapter.

    Endpoint: POST /v2beta/stable-image/generate/sd3
    Mode: image-to-image (source photo + prompt → styled result)
    Returns image bytes → uploaded to R2.
    """

    def __init__(
        self,
        *,
        integration_mode: str = "mock",
        real_calls_enabled: bool = False,
        api_key: str = "",
        api_url: str = "https://api.stability.ai/v2beta/stable-image/generate/sd3",
        timeout_seconds: int = 60,
    ) -> None:
        super().__init__(provider_id="stable_diffusion")
        self.integration_mode = integration_mode
        self.real_calls_enabled = real_calls_enabled
        self.api_key = api_key
        self.api_url = api_url.strip()
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

        sd_model = _SD_MODEL_MAP.get(model_id, "sd3.5-large-turbo")
        ar = aspect_ratio if aspect_ratio in _VALID_ASPECT_RATIOS else "1:1"

        # Download the source image to send as multipart file
        try:
            source_bytes = fetch_bytes(source_image_url, timeout_seconds=20)
        except ProviderHTTPError:
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        fields = {
            "prompt": prompt,
            "model": sd_model,
            "mode": "image-to-image",
            "strength": "0.65",
            "aspect_ratio": ar,
            "output_format": "jpeg",
        }
        files = {
            "image": ("source.jpg", source_bytes, "image/jpeg"),
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "image/*",
        }

        try:
            img_bytes = post_multipart_bytes(
                url=self.api_url,
                headers=headers,
                fields=fields,
                files=files,
                timeout_seconds=self.timeout_seconds,
            )
        except ProviderHTTPError:
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        result_url = self._store_to_r2(img_bytes, order_id)
        return ProviderSubmitResult(
            provider_task_id=f"sd-{order_id}",
            status="done",
            result_url=result_url,
        )

    @staticmethod
    def _store_to_r2(img_bytes: bytes, order_id: str) -> str:
        from app.adapters.r2_client import upload_bytes

        key = f"results/sd/{order_id}.jpg"
        return upload_bytes(key, img_bytes, content_type="image/jpeg")

    def _is_real(self) -> bool:
        return (
            self.integration_mode == "real"
            and self.real_calls_enabled
            and bool(self.api_key)
            and bool(self.api_url)
        )
