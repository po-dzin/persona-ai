from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Literal


IntegrationMode = Literal["mock", "real"]


def _bool_env(name: str, default: bool = True) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    env: str = os.getenv("APP_ENV", "dev")
    integration_mode: IntegrationMode = os.getenv("INTEGRATION_MODE", "mock").lower()  # type: ignore[assignment]
    api_port: int = int(os.getenv("API_PORT", "8000"))

    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/live_photo")

    r2_endpoint: str = os.getenv("R2_ENDPOINT", "https://example.r2.cloudflarestorage.com")
    r2_bucket: str = os.getenv("R2_BUCKET", "live-photo")
    r2_access_key_id: str = os.getenv("R2_ACCESS_KEY_ID", "")
    r2_secret_access_key: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    r2_public_base_url: str = os.getenv("R2_PUBLIC_BASE_URL", "")

    nano_banana_api_key: str = os.getenv("NANO_BANANA_API_KEY", "")
    stability_api_key: str = os.getenv("STABILITY_API_KEY", "")
    bfl_api_key: str = os.getenv("BFL_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    recraft_api_key: str = os.getenv("RECRAFT_API_KEY", "")

    provider_webhook_secret: str = os.getenv("PROVIDER_WEBHOOK_SECRET", "")
    provider_real_calls_enabled: bool = _bool_env("PROVIDER_REAL_CALLS_ENABLED", False)
    provider_request_timeout_seconds: int = int(os.getenv("PROVIDER_REQUEST_TIMEOUT_SECONDS", "45"))

    nano_banana_api_url: str = os.getenv("NANO_BANANA_API_URL", "")
    stability_api_url: str = os.getenv("STABILITY_API_URL", "")

    model_enabled_nano_banana: bool = _bool_env("MODEL_ENABLED_NANO_BANANA", True)
    model_enabled_stable_diffusion: bool = _bool_env("MODEL_ENABLED_STABLE_DIFFUSION", True)
    model_enabled_flux: bool = _bool_env("MODEL_ENABLED_FLUX", True)
    model_enabled_openai_image: bool = _bool_env("MODEL_ENABLED_OPENAI_IMAGE", True)
    model_enabled_recraft: bool = _bool_env("MODEL_ENABLED_RECRAFT", True)

    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_webhook_secret: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    telegram_stars_provider_token: str = os.getenv("TELEGRAM_STARS_PROVIDER_TOKEN", "")
    telegram_miniapp_url: str = os.getenv("TELEGRAM_MINIAPP_URL", "")

    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    stripe_price_id_starter: str = os.getenv("STRIPE_PRICE_ID_STARTER", "")
    stripe_price_id_basic: str = os.getenv("STRIPE_PRICE_ID_BASIC", "")
    stripe_price_id_popular: str = os.getenv("STRIPE_PRICE_ID_POPULAR", "")
    stripe_price_id_pro: str = os.getenv("STRIPE_PRICE_ID_PRO", "")
    stripe_price_id_ultra: str = os.getenv("STRIPE_PRICE_ID_ULTRA", "")

    sla_seconds_min: int = int(os.getenv("SLA_SECONDS_MIN", "30"))
    sla_seconds_max: int = int(os.getenv("SLA_SECONDS_MAX", "120"))

    source_retention_hours: int = int(os.getenv("SOURCE_RETENTION_HOURS", "48"))
    result_retention_days: int = int(os.getenv("RESULT_RETENTION_DAYS", "30"))

    base_gen_usd: float = float(os.getenv("BASE_GEN_USD", "0.25"))


settings = Settings()


def required_env_for_mode(mode: str) -> dict[str, list[str]]:
    mode = mode.lower().strip()
    common = [
        "DATABASE_URL",
        "REDIS_URL",
        "R2_ENDPOINT",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
    ]
    provider_keys = [
        "NANO_BANANA_API_KEY",
        "STABILITY_API_KEY",
        "BFL_API_KEY",
        "OPENAI_API_KEY",
        "RECRAFT_API_KEY",
        "PROVIDER_WEBHOOK_SECRET",
        "NANO_BANANA_API_URL",
        "STABILITY_API_URL",
    ]
    payment_keys = [
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_WEBHOOK_SECRET",
        "TELEGRAM_STARS_PROVIDER_TOKEN",
    ]
    stripe_optional_bundle = [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_ID_STARTER",
        "STRIPE_PRICE_ID_BASIC",
        "STRIPE_PRICE_ID_POPULAR",
        "STRIPE_PRICE_ID_PRO",
        "STRIPE_PRICE_ID_ULTRA",
    ]
    if mode == "real":
        return {"required": common + provider_keys + payment_keys, "optional_bundle": stripe_optional_bundle}
    return {"required": common, "optional_bundle": stripe_optional_bundle}
