from __future__ import annotations

from uuid import uuid4

from app.adapters.provider_base import ProviderSubmitResult


class MockPhotoProvider:
    """Mock adapter that mirrors provider-specific routing while remaining deterministic."""

    def __init__(self, provider_id: str) -> None:
        self.provider_id = provider_id

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
        _ = source_key, source_image_url, prompt, aspect_ratio
        slug = model_id.replace("/", "-")
        return ProviderSubmitResult(
            provider_task_id=f"{self.provider_id}-{uuid4()}",
            status="submitted",
            result_url=f"https://r2.example/result/{self.provider_id}/{slug}/{order_id}.jpg",
        )
