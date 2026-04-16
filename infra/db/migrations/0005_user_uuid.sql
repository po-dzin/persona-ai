-- Migration 0005: superseded by 0003_rls_baseline.sql (rewritten 2026-04-14).
--
-- The UUID column, backfill, unique constraint, app_user_text_matches() function,
-- and corrected RLS policies were merged into 0003 so that fresh installs apply
-- everything in one idempotent file.
--
-- This file is kept as a no-op placeholder so migration runners that track
-- applied files by name do not error on a gap between 0004 and 0006.

SELECT 1; -- no-op
