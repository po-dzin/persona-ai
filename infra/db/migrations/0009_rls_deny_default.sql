-- Migration 0009: Change app_rls_mode() default from 'system' to 'deny'.
--                 Upgrade app_api / app_worker roles to LOGIN.
--
-- After this migration, any DB session that does not explicitly set
-- app.rls_mode = 'system' or 'enforce' sees an empty result-set.
--
-- Prerequisites (deploy order matters):
--   1. All system paths in the application use get_system_session()
--      (sets app.rls_mode = 'system' explicitly).
--   2. All user paths call activate_rls() before opening get_session()
--      (sets app.rls_mode = 'enforce' with the user UUID).
--   3. Run this migration only after verifying the above in staging.
--
-- Operator steps after this migration:
--   ALTER ROLE app_api  PASSWORD '<strong-password>';
--   ALTER ROLE app_worker PASSWORD '<strong-password>';
--   Set APP_DATABASE_URL=postgresql://app_api:<pwd>@<host>/<db> in Render
--   Set WORKER_DATABASE_URL=postgresql://app_worker:<pwd>@<host>/<db> in Render

-- ── 1. Roles: enable LOGIN ────────────────────────────────────────────────────
-- Roles were created NOLOGIN in 0007. Upgrade them for dedicated connection strings.
-- Password must be set manually (ALTER ROLE ... PASSWORD '...') — never in migrations.

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
        ALTER ROLE app_api LOGIN;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
        ALTER ROLE app_worker LOGIN;
    END IF;
END $$;

-- ── 2. Default mode: 'system' → 'deny' ───────────────────────────────────────
-- Any session that forgets to set app.rls_mode now gets an empty result-set
-- instead of seeing all rows.

CREATE OR REPLACE FUNCTION public.app_rls_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.rls_mode', true), ''), 'deny')
$$;
