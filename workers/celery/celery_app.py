from celery import Celery

celery_app = Celery(
    "live_photo_worker",
    broker="${REDIS_URL}",
    backend="${REDIS_URL}",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
