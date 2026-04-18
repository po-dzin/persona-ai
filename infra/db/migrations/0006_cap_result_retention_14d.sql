-- Migration 0006: cap result-asset expiry to 14 days from creation.
--
-- Old assets were created with a 30-day TTL. This backfill brings them
-- in line with the current 14-day policy (RESULT_RETENTION_DAYS=14).
-- Source assets (48h TTL) are unaffected.
-- Safe to run multiple times (idempotent).

UPDATE media_assets
SET expires_at = created_at + INTERVAL '14 days'
WHERE kind = 'result'
  AND expires_at > created_at + INTERVAL '14 days';
