from __future__ import annotations

from app.adapters.flux import FluxAdapter
from app.adapters.nano_banana import NanoBananaAdapter
from app.adapters.openai_image import OpenAIImageAdapter
from app.adapters.provider_base import ImageProviderAdapter
from app.adapters.recraft import RecraftAdapter
from app.adapters.stable_diffusion import StableDiffusionAdapter
from app.core.settings import settings


def build_provider_registry() -> dict[str, ImageProviderAdapter]:
    providers: list[ImageProviderAdapter] = [
        NanoBananaAdapter(
            integration_mode=settings.integration_mode,
            real_calls_enabled=settings.provider_real_calls_enabled,
            api_key=settings.nano_banana_api_key,
            timeout_seconds=settings.provider_request_timeout_seconds,
        ),
        StableDiffusionAdapter(
            integration_mode=settings.integration_mode,
            real_calls_enabled=settings.provider_real_calls_enabled,
            api_key=settings.stability_api_key,
            api_url=settings.stability_api_url,
            timeout_seconds=settings.provider_request_timeout_seconds,
        ),
        FluxAdapter(
            integration_mode=settings.integration_mode,
            real_calls_enabled=settings.provider_real_calls_enabled,
            api_key=settings.bfl_api_key,
            api_base_url=settings.bfl_api_base_url,
            timeout_seconds=settings.provider_request_timeout_seconds,
        ),
        OpenAIImageAdapter(),
        RecraftAdapter(),
    ]
    return {provider.provider_id: provider for provider in providers}
