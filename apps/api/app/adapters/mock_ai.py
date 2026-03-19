from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4


@dataclass
class MockAIResult:
    provider_task_id: str
    status: str
    result_url: str | None = None
    error_code: str | None = None


class MockAIAdapter:
    """Mock-first image adapter with webhook-compatible payloads."""

    provider = "replicate"

    def submit(self, order_id: str, style_code: str, source_key: str) -> MockAIResult:
        _ = style_code, source_key
        return MockAIResult(
            provider_task_id=str(uuid4()),
            status="submitted",
            result_url=f"https://r2.example/result/{order_id}.jpg",
        )
