from __future__ import annotations

import os

from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "live_photo_worker",
    broker=redis_url,
    backend=redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        # Удаление протухших медиа-ассетов из R2 и БД
        # Source TTL: 48h, Result TTL: 30d (settings.source_retention_hours / result_retention_days)
        "cleanup-expired-assets-every-6h": {
            "task": "cleanup.expired_assets",
            "schedule": 6 * 60 * 60,  # каждые 6 часов
        },
        # Сверка зависших джобов (submitted → no webhook after SLA timeout)
        "reconcile-stale-jobs-every-1h": {
            "task": "reconciliation.stale_jobs",
            "schedule": 60 * 60,  # каждый час
        },
    },
)
