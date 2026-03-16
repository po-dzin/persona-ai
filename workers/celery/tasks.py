from __future__ import annotations

from datetime import datetime, timezone

from workers.celery.celery_app import celery_app


@celery_app.task(name="generation.dispatch")
def generation_dispatch(order_id: str) -> dict:
    """Queue entrypoint for generation dispatch.

    In mock-first mode this task returns accepted metadata.
    Real integration step swaps adapter internals without changing signature.
    """
    return {
        "order_id": order_id,
        "status": "submitted",
        "provider": "replicate",
        "queued_at": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="generation.finalize")
def generation_finalize(order_id: str, event_type: str) -> dict:
    """Finalize order result or failure from webhook/reconcile path."""
    return {
        "order_id": order_id,
        "event_type": event_type,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="credits.refund_technical_failure")
def refund_technical_failure(order_id: str) -> dict:
    """Auto-refund task for technical failures only."""
    return {
        "order_id": order_id,
        "refund_delta_credits": 1,
        "reason": "technical_failed",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="reconciliation.stale_jobs")
def reconciliation_stale_jobs() -> dict:
    """Periodic reconciliation task scheduled by Celery Beat."""
    return {
        "scan_started_at": datetime.now(timezone.utc).isoformat(),
        "status": "ok",
    }
