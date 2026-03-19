from __future__ import annotations

from datetime import datetime, timezone

from workers.celery.celery_app import celery_app


@celery_app.task(name="generation.dispatch")
def generation_dispatch(order_id: str, model_id: str, provider: str) -> dict:
    """Queue entrypoint for photo generation dispatch."""
    return {
        "order_id": order_id,
        "model_id": model_id,
        "provider": provider,
        "status": "submitted",
        "queued_at": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="generation.finalize")
def generation_finalize(order_id: str, event_type: str, result_url: str | None = None) -> dict:
    """Finalize order result or failure from webhook/reconcile path."""
    return {
        "order_id": order_id,
        "event_type": event_type,
        "result_url": result_url,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="credits.refund_technical_failure")
def refund_technical_failure(order_id: str, credit_cost: int) -> dict:
    """Auto-refund task for technical failures only."""
    return {
        "order_id": order_id,
        "refund_delta_credits": credit_cost,
        "reason": "technical_failed",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="reconciliation.stale_jobs")
def reconciliation_stale_jobs() -> dict:
    """Periodic reconciliation task scheduled by Celery Beat."""
    return {
        "scan_started_at": datetime.now(timezone.utc).isoformat(),
        "status": "ok",
        "scope": "photo-jobs",
    }
