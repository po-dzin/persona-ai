"""
Worker task implementations — pure Python, no Celery dependency.

All business logic lives here so it can be:
  - imported and tested without a Celery broker
  - called directly from Render Cron Jobs
  - wrapped by Celery tasks in tasks.py (Phase 1.1+)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def reconciliation_stale_jobs() -> dict:
    """
    Find jobs stuck in submitted/processing past the timeout window and fail them.

    Handles the case where the provider never sends a webhook (network loss, crash, etc.).
    Timeout window: JOB_TIMEOUT_SECONDS (default 600s = 10 min).

    Safe to run frequently — idempotent, skips already-failed jobs.
    """
    from app.core.db import JobRow, OrderRow, UserRow, SessionLocal
    from app.core.settings import settings

    started_at = _now()
    cutoff = started_at - timedelta(seconds=settings.job_timeout_seconds)

    timed_out = 0
    already_done = 0
    errors = 0

    db = SessionLocal()
    try:
        stale_jobs = (
            db.query(JobRow)
            .filter(
                JobRow.status.in_(["submitted", "processing"]),
                JobRow.updated_at <= cutoff,
            )
            .all()
        )

        for job in stale_jobs:
            try:
                order = db.get(OrderRow, job.order_id)

                # Order already in terminal state (webhook arrived between cron runs)
                if order and order.status in ("done", "failed"):
                    job.status = "failed"
                    job.updated_at = _now()
                    already_done += 1
                    continue

                # Mark job timed out
                job.status = "timeout"
                job.updated_at = _now()

                if order and order.status not in ("done", "failed"):
                    order.status = "failed"
                    order.fail_reason_code = "technical_failed"
                    order.updated_at = _now()

                    # Refund credits inline — idempotent (zeroes credit_cost after refund)
                    if order.credit_cost > 0:
                        user = db.get(UserRow, order.user_id)
                        if user:
                            refunded = order.credit_cost
                            user.paid_credits += refunded
                            order.credit_cost = 0
                            logger.info(
                                "reconciliation: refunded %d credits to user %s (order %s timed out)",
                                refunded,
                                order.user_id,
                                order.order_id,
                            )

                timed_out += 1
            except Exception as exc:
                logger.error(
                    "reconciliation_stale_jobs: error processing job %s: %s",
                    job.job_id,
                    exc,
                )
                errors += 1

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("reconciliation_stale_jobs: DB error: %s", exc)
        raise
    finally:
        db.close()

    result = {
        "started_at": started_at.isoformat(),
        "cutoff": cutoff.isoformat(),
        "timed_out": timed_out,
        "already_done": already_done,
        "errors": errors,
        "status": "ok" if errors == 0 else "partial",
    }
    logger.info("reconciliation_stale_jobs: %s", result)
    return result


def refund_technical_failure(order_id: str) -> dict:
    """
    Refund credits for a technical failure.

    Idempotent: zeroes credit_cost after refunding so double-calls are safe.
    Only refunds orders with fail_reason_code == 'technical_failed'.
    """
    from app.core.db import OrderRow, UserRow, SessionLocal

    db = SessionLocal()
    try:
        order = db.get(OrderRow, order_id)
        if not order:
            logger.warning("refund_technical_failure: order %s not found", order_id)
            return {"order_id": order_id, "status": "not_found"}

        if order.fail_reason_code != "technical_failed":
            return {"order_id": order_id, "status": "skipped", "reason": order.fail_reason_code}

        if order.credit_cost <= 0:
            return {"order_id": order_id, "status": "skipped", "reason": "zero_cost"}

        user = db.get(UserRow, order.user_id)
        if not user:
            logger.error(
                "refund_technical_failure: user %s not found for order %s",
                order.user_id,
                order_id,
            )
            return {"order_id": order_id, "status": "user_not_found"}

        refunded = order.credit_cost
        user.paid_credits += refunded
        order.credit_cost = 0
        db.commit()

        logger.info(
            "refund_technical_failure: refunded %d credits to user %s for order %s",
            refunded,
            user.user_id,
            order_id,
        )
        return {
            "order_id": order_id,
            "user_id": user.user_id,
            "refunded_credits": refunded,
            "status": "refunded",
        }
    except Exception as exc:
        db.rollback()
        logger.error("refund_technical_failure: DB error for order %s: %s", order_id, exc)
        raise
    finally:
        db.close()


def cleanup_expired_assets() -> dict:
    """
    Delete expired media assets from R2 and the database, and null out
    stale result_url values on old done orders.

    Source assets: 48h TTL (SOURCE_RETENTION_HOURS)
    Result assets: 14d TTL (RESULT_RETENTION_DAYS)

    R2 delete failures keep the DB row for retry on next run.
    Result URLs point to provider CDNs (not our R2), so we only clear the
    DB reference — no R2 delete needed for them.
    """
    from app.core.db import MediaAssetRow, OrderRow, SessionLocal
    from app.adapters.r2_client import delete_object
    from app.core.settings import settings

    started_at = _now()
    deleted_count = 0
    cleared_result_urls = 0
    error_count = 0

    # ── Step 1: delete expired R2 source assets ──────────────────────────────
    db = SessionLocal()
    try:
        expired = (
            db.query(MediaAssetRow)
            .filter(MediaAssetRow.expires_at <= started_at)
            .all()
        )

        for asset in expired:
            try:
                ok = delete_object(asset.storage_key)
                if ok:
                    db.delete(asset)
                    deleted_count += 1
                else:
                    logger.warning(
                        "cleanup_expired_assets: R2 delete failed for %s, keeping DB row",
                        asset.storage_key,
                    )
                    error_count += 1
            except Exception as exc:
                logger.error(
                    "cleanup_expired_assets: unexpected error for asset %s: %s",
                    asset.storage_key,
                    exc,
                )
                error_count += 1

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("cleanup_expired_assets: DB error (R2 phase): %s", exc)
        raise
    finally:
        db.close()

    # ── Step 2: null out result_url on done orders past retention window ──────
    # Provider CDN links (NanoBanana/BFL) expire after ~14 days. Clear the
    # stale reference so the API never returns a broken URL.
    result_cutoff = started_at - timedelta(days=settings.result_retention_days)
    db = SessionLocal()
    try:
        stale_orders = (
            db.query(OrderRow)
            .filter(
                OrderRow.status == "done",
                OrderRow.result_url.isnot(None),
                OrderRow.created_at <= result_cutoff,
            )
            .all()
        )

        for order in stale_orders:
            order.result_url = None
            order.updated_at = started_at
            cleared_result_urls += 1

        db.commit()
        if cleared_result_urls:
            logger.info(
                "cleanup_expired_assets: cleared result_url on %d expired orders",
                cleared_result_urls,
            )
    except Exception as exc:
        db.rollback()
        logger.error("cleanup_expired_assets: DB error (result_url phase): %s", exc)
        raise
    finally:
        db.close()

    result = {
        "started_at": started_at.isoformat(),
        "deleted": deleted_count,
        "cleared_result_urls": cleared_result_urls,
        "errors": error_count,
        "status": "ok" if error_count == 0 else "partial",
    }
    logger.info("cleanup_expired_assets: %s", result)
    return result
