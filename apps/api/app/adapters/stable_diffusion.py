from __future__ import annotations

from app.adapters.http_client import ProviderHTTPError, post_json
from app.adapters.mock_provider import MockPhotoProvider
from app.adapters.provider_base import ProviderSubmitResult

class StableDiffusionAdapter(MockPhotoProvider):
    def __init__(
        self,
        *,
        integration_mode: str = "mock",
        real_calls_enabled: bool = False,
        api_key: str = "",
        api_url: str = "",
        timeout_seconds: int = 45,
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
        if not self._is_real_mode_enabled():
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        payload = {
            "model": model_id,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "source_image_url": source_image_url,
            "order_id": order_id,
            "output_format": "jpeg",
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            response = post_json(
                url=self.api_url,
                headers=headers,
                payload=payload,
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

        provider_task_id = str(
            response.get("id")
            or response.get("generation_id")
            or response.get("task_id")
            or f"stable-diffusion-{order_id}"
        )
        result_url = response.get("result_url")
        return ProviderSubmitResult(
            provider_task_id=provider_task_id,
            status="submitted",
            result_url=result_url if isinstance(result_url, str) else None,
        )

    def _is_real_mode_enabled(self) -> bool:
        return (
            self.integration_mode == "real"
            and self.real_calls_enabled
            and bool(self.api_key)
            and bool(self.api_url)
        )
