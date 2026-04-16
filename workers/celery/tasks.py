from __future__ import annotations

import logging
from datetime import datetime, timezone

from workers.celery.celery_app import celery_app

logger = logging.getLogger(__name__)


# ── Generation dispatch / finalize ────────────────────────────────────────────
# Phase 1 MVP: generation goes through sync provider call in start_order().
# These tasks become real in Phase 1.1 when generation moves to async Celery pipeline.

@celery_app.task(name="generation.dispatch")
def generation_dispatch(order_id: str, model_id: str, provider: str) -> dict:
    """[Phase 1.1] Async provider dispatch — stub until Celery pipeline is wired."""
    return {
        "order_id": order_id,
        "model_id": model_id,
        "provider": provider,
        "status": "stub",
        "queued_at": datetime.now(timezone.utc).isoformat(),
    }


@celery_app.task(name="generation.finalize")
def generation_finalize(order_id: str, event_type: str, result_url: str | None = None) -> dict:
    """[Phase 1.1] Async result finalization — stub until Celery pipeline is wired."""
    return {
        "order_id": order_id,
        "event_type": event_type,
        "result_url": result_url,
        "status": "stub",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Credit refund ─────────────────────────────────────────────────────────────

@celery_app.task(name="credits.refund_technical_failure")
def refund_technical_failure(order_id: str) -> dict:
    """Delegate to runner — logic lives in workers/runner.py."""
    from workers.runner import refund_technical_failure as _run
    return _run(order_id)


# ── Reconciliation ────────────────────────────────────────────────────────────

@celery_app.task(name="reconciliation.stale_jobs")
def reconciliation_stale_jobs() -> dict:
    """Delegate to runner — logic lives in workers/runner.py."""
    from workers.runner import reconciliation_stale_jobs as _run
    return _run()


# ── Asset cleanup ─────────────────────────────────────────────────────────────

@celery_app.task(name="cleanup.expired_assets")
def cleanup_expired_assets() -> dict:
    """Delegate to runner — logic lives in workers/runner.py."""
    from workers.runner import cleanup_expired_assets as _run
    return _run()
