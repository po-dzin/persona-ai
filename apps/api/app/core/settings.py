from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    env: str = os.getenv("APP_ENV", "dev")
    api_port: int = int(os.getenv("API_PORT", "8000"))

    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/live_photo")

    r2_endpoint: str = os.getenv("R2_ENDPOINT", "https://example.r2.cloudflarestorage.com")
    r2_bucket: str = os.getenv("R2_BUCKET", "live-photo")

    sla_seconds_min: int = int(os.getenv("SLA_SECONDS_MIN", "40"))
    sla_seconds_max: int = int(os.getenv("SLA_SECONDS_MAX", "180"))

    source_retention_hours: int = int(os.getenv("SOURCE_RETENTION_HOURS", "48"))
    result_retention_days: int = int(os.getenv("RESULT_RETENTION_DAYS", "30"))

    base_gen_usd: float = float(os.getenv("BASE_GEN_USD", "0.25"))


settings = Settings()
