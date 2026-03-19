from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class ProviderSubmitResult:
    provider_task_id: str
    status: str
    result_url: str | None = None


class ImageProviderAdapter(Protocol):
    provider_id: str

    def submit(
        self,
        *,
        order_id: str,
        model_id: str,
        source_key: str,
        source_image_url: str,
        prompt: str,
        aspect_ratio: str,
    ) -> ProviderSubmitResult: ...
