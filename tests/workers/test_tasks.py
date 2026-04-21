"""
Tests for worker task implementations (workers/runner.py).

Imports from workers.runner — no Celery broker required.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.db import JobRow, MediaAssetRow, OrderRow, SessionLocal, UserRow
from workers.runner import (
    cleanup_expired_assets,
    reconciliation_stale_jobs,
    refund_technical_failure,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_user(db, user_id: str = "u1", credits: int = 100) -> UserRow:
    user = UserRow(
        user_id=user_id,
        paid_credits=credits,
        lifecycle_state="S2",
        created_at=_now(),
    )
    db.add(user)
    # Ensure parent row exists before dependent rows are added in the same tx.
    db.flush()
    return user


def _seed_order(
    db,
    order_id: str = "ord1",
    user_id: str = "u1",
    status: str = "processing",
    credit_cost: int = 10,
    fail_reason: str | None = None,
) -> OrderRow:
    order = OrderRow(
        order_id=order_id,
        user_id=user_id,
        style_code="hollywood",
        source_key="source/u1/x.jpg",
        model_id="nb2-1k",
        prompt="test",
        aspect_ratio="1:1",
        status=status,
        credit_cost=credit_cost,
        fail_reason_code=fail_reason,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(order)
    # Parent for JobRow(order_id) must exist before dependent insert.
    db.flush()
    return order


def _seed_job(
    db,
    job_id: str = "job1",
    order_id: str = "ord1",
    status: str = "submitted",
    age_seconds: int = 700,  # older than default 600s timeout
) -> JobRow:
    old_ts = _now() - timedelta(seconds=age_seconds)
    job = JobRow(
        job_id=job_id,
        order_id=order_id,
        provider="nanobanna",
        status=status,
        attempts=1,
        updated_at=old_ts,
    )
    db.add(job)
    db.flush()
    return job


# ── reconciliation_stale_jobs ─────────────────────────────────────────────────

class TestReconciliationStaleJobs:
    def test_times_out_stale_submitted_job(self):
        db = SessionLocal()
        _seed_user(db, credits=90)
        _seed_order(db, status="processing", credit_cost=10)
        _seed_job(db, status="submitted", age_seconds=700)
        db.commit()
        db.close()

        result = reconciliation_stale_jobs()

        assert result["timed_out"] == 1
        assert result["errors"] == 0
        assert result["status"] == "ok"

        db = SessionLocal()
        job = db.get(JobRow, "job1")
        order = db.get(OrderRow, "ord1")
        user = db.get(UserRow, "u1")
        db.close()

        assert job.status == "timeout"
        assert order.status == "failed"
        assert order.fail_reason_code == "technical_failed"
        assert user.paid_credits == 100  # 90 + 10 refunded

    def test_times_out_stale_processing_job(self):
        db = SessionLocal()
        _seed_user(db, credits=80)
        _seed_order(db, status="processing", credit_cost=20)
        _seed_job(db, status="processing", age_seconds=1200)
        db.commit()
        db.close()

        result = reconciliation_stale_jobs()

        assert result["timed_out"] == 1
        db = SessionLocal()
        user = db.get(UserRow, "u1")
        db.close()
        assert user.paid_credits == 100  # 80 + 20 refunded

    def test_skips_fresh_jobs(self):
        db = SessionLocal()
        _seed_user(db)
        _seed_order(db, status="processing", credit_cost=10)
        _seed_job(db, status="submitted", age_seconds=30)  # fresh — under timeout
        db.commit()
        db.close()

        result = reconciliation_stale_jobs()

        assert result["timed_out"] == 0
        db = SessionLocal()
        job = db.get(JobRow, "job1")
        db.close()
        assert job.status == "submitted"  # untouched

    def test_skips_already_done_order(self):
        """Webhook arrived between cron runs — job stale but order already done."""
        db = SessionLocal()
        _seed_user(db)
        _seed_order(db, status="done", credit_cost=10)
        _seed_job(db, status="submitted", age_seconds=700)
        db.commit()
        db.close()

        result = reconciliation_stale_jobs()

        assert result["already_done"] == 1
        assert result["timed_out"] == 0
        db = SessionLocal()
        order = db.get(OrderRow, "ord1")
        db.close()
        assert order.status == "done"  # not overwritten

    def test_idempotent_on_multiple_runs(self):
        """Running reconciliation twice for the same stale job is safe."""
        db = SessionLocal()
        _seed_user(db, credits=90)
        _seed_order(db, status="processing", credit_cost=10)
        _seed_job(db, status="submitted", age_seconds=700)
        db.commit()
        db.close()

        reconciliation_stale_jobs()
        result2 = reconciliation_stale_jobs()

        # Second run: job is now "timeout" (not submitted/processing) → 0 processed
        assert result2["timed_out"] == 0
        db = SessionLocal()
        user = db.get(UserRow, "u1")
        db.close()
        assert user.paid_credits == 100  # refunded exactly once

    def test_empty_run_returns_ok(self):
        result = reconciliation_stale_jobs()
        assert result["timed_out"] == 0
        assert result["status"] == "ok"


# ── refund_technical_failure ──────────────────────────────────────────────────

class TestRefundTechnicalFailure:
    def test_refunds_credits_for_technical_failure(self):
        db = SessionLocal()
        _seed_user(db, credits=90)
        _seed_order(db, status="failed", credit_cost=10, fail_reason="technical_failed")
        db.commit()
        db.close()

        result = refund_technical_failure("ord1")

        assert result["status"] == "refunded"
        assert result["refunded_credits"] == 10
        db = SessionLocal()
        user = db.get(UserRow, "u1")
        db.close()
        assert user.paid_credits == 100

    def test_skips_policy_failed_orders(self):
        db = SessionLocal()
        _seed_user(db, credits=90)
        _seed_order(db, status="failed", credit_cost=10, fail_reason="policy_failed")
        db.commit()
        db.close()

        result = refund_technical_failure("ord1")

        assert result["status"] == "skipped"
        db = SessionLocal()
        user = db.get(UserRow, "u1")
        db.close()
        assert user.paid_credits == 90  # unchanged

    def test_returns_not_found_for_missing_order(self):
        result = refund_technical_failure("nonexistent")
        assert result["status"] == "not_found"

    def test_idempotent_double_refund(self):
        """Second refund call after credit_cost zeroed is a no-op."""
        db = SessionLocal()
        _seed_user(db, credits=90)
        _seed_order(db, status="failed", credit_cost=10, fail_reason="technical_failed")
        db.commit()
        db.close()

        refund_technical_failure("ord1")
        result2 = refund_technical_failure("ord1")

        assert result2["status"] == "skipped"
        db = SessionLocal()
        user = db.get(UserRow, "u1")
        db.close()
        assert user.paid_credits == 100  # refunded exactly once


# ── cleanup_expired_assets ────────────────────────────────────────────────────

class TestCleanupExpiredAssets:
    def test_empty_run_returns_ok(self):
        result = cleanup_expired_assets()
        assert result["status"] == "ok"
        assert result["deleted"] == 0

    def test_deletes_expired_asset(self, monkeypatch):
        import app.adapters.r2_client as r2_mod
        monkeypatch.setattr(r2_mod, "delete_object", lambda key: True)

        db = SessionLocal()
        _seed_user(db, user_id="u1")
        db.add(MediaAssetRow(
            id="asset1",
            user_id="u1",
            order_id=None,
            kind="source",
            storage_bucket="test",
            storage_key="source/u1/old.jpg",
            expires_at=_now() - timedelta(hours=1),
            created_at=_now() - timedelta(hours=50),
        ))
        db.commit()
        db.close()

        result = cleanup_expired_assets()

        assert result["deleted"] == 1
        assert result["status"] == "ok"
        db = SessionLocal()
        assert db.get(MediaAssetRow, "asset1") is None
        db.close()

    def test_keeps_row_when_r2_delete_fails(self, monkeypatch):
        import app.adapters.r2_client as r2_mod
        monkeypatch.setattr(r2_mod, "delete_object", lambda key: False)

        db = SessionLocal()
        _seed_user(db, user_id="u1")
        db.add(MediaAssetRow(
            id="asset2",
            user_id="u1",
            order_id=None,
            kind="source",
            storage_bucket="test",
            storage_key="source/u1/stuck.jpg",
            expires_at=_now() - timedelta(hours=1),
            created_at=_now() - timedelta(hours=50),
        ))
        db.commit()
        db.close()

        result = cleanup_expired_assets()

        assert result["deleted"] == 0
        assert result["errors"] == 1
        assert result["status"] == "partial"
        db = SessionLocal()
        assert db.get(MediaAssetRow, "asset2") is not None  # row kept for retry
        db.close()
