-- Migration 0007: Strict RLS mode with FORCE ROW LEVEL SECURITY and app roles.
--
-- Changes from 0003 baseline:
--
--   1. app_rls_mode() default changes 'compat' → 'system'
--      Allowed values:
--        'enforce'  — user session, policies restrict to app_current_user_uuid()
--        'system'   — trusted internal session (workers, admin, webhooks); sees all rows
--        anything else → DENY (no rows visible)
--
--   2. All policy helper functions updated: compat fallback removed,
--      explicit 'system' check added.
--
--   3. FORCE ROW LEVEL SECURITY on all user-owned tables — applies policies
--      even to the table owner role (Render's postgres user is non-superuser).
--
--   4. Dedicated app roles created (NOLOGIN — activate via SET ROLE in app code,
--      or create LOGIN variants and update DATABASE_URL per deployment guide).
--
-- Idempotent: all DDL uses OR REPLACE / IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ── 1. Updated helper functions ──────────────────────────────────────────────

-- Default changes from 'compat' to 'system'.
-- 'system' = allow all (trusted internal path)
-- 'enforce' = restrict to current user UUID
-- anything else = deny
CREATE OR REPLACE FUNCTION public.app_rls_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.rls_mode', true), ''), 'system')
$$;

-- Kept for backward compatibility with 0003 callers.
CREATE OR REPLACE FUNCTION public.app_rls_is_enforced()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT public.app_rls_mode() = 'enforce'
$$;

CREATE OR REPLACE FUNCTION public.app_current_user_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_user_id', true)::uuid
        ELSE NULL
    END
$$;

-- UUID-based: system → allow all; enforce + match → allow; else → deny
CREATE OR REPLACE FUNCTION public.app_user_matches(candidate uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT public.app_rls_mode() = 'system'
        OR (public.app_rls_mode() = 'enforce'
            AND candidate = public.app_current_user_uuid())
$$;

-- Text-based (Telegram user_id string → UUID lookup):
-- system → allow all; enforce + match → allow; else → deny
CREATE OR REPLACE FUNCTION public.app_user_text_matches(candidate_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT public.app_rls_mode() = 'system'
        OR (public.app_rls_mode() = 'enforce'
            AND EXISTS (
                SELECT 1
                FROM users u
                WHERE u.user_id = candidate_user_id
                  AND u.id = public.app_current_user_uuid()
            ))
$$;

-- Stub kept for backward compatibility (jobs policy is defined via inline SQL below).
CREATE OR REPLACE FUNCTION public.app_order_matches(candidate_order_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT public.app_rls_mode() = 'system'
$$;

-- ── 2. FORCE ROW LEVEL SECURITY ──────────────────────────────────────────────
-- Applies RLS even when the table owner (Render's postgres role) queries the table.
-- Has no effect on true pg_superusers, but Render's default role is not a superuser.

ALTER TABLE users        FORCE ROW LEVEL SECURITY;
ALTER TABLE payments     FORCE ROW LEVEL SECURITY;
ALTER TABLE orders       FORCE ROW LEVEL SECURITY;
ALTER TABLE media_assets FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='jobs') THEN
        EXECUTE 'ALTER TABLE jobs FORCE ROW LEVEL SECURITY';
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallets') THEN
        EXECUTE 'ALTER TABLE wallets FORCE ROW LEVEL SECURITY';
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallet_transactions') THEN
        EXECUTE 'ALTER TABLE wallet_transactions FORCE ROW LEVEL SECURITY';
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='referrals') THEN
        EXECUTE 'ALTER TABLE referrals FORCE ROW LEVEL SECURITY';
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='gift_packages') THEN
        EXECUTE 'ALTER TABLE gift_packages FORCE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ── 3. Recreate policies with strict logic ───────────────────────────────────

-- users
DROP POLICY IF EXISTS users_self_access ON users;
CREATE POLICY users_self_access ON users
    USING (public.app_user_matches(id))
    WITH CHECK (public.app_user_matches(id));

-- orders
DROP POLICY IF EXISTS orders_user_access ON orders;
CREATE POLICY orders_user_access ON orders
    USING (public.app_user_text_matches(user_id))
    WITH CHECK (public.app_user_text_matches(user_id));

-- payments
DROP POLICY IF EXISTS payments_user_access ON payments;
CREATE POLICY payments_user_access ON payments
    USING (public.app_user_text_matches(user_id))
    WITH CHECK (public.app_user_text_matches(user_id));

-- media_assets
DROP POLICY IF EXISTS media_assets_user_access ON media_assets;
CREATE POLICY media_assets_user_access ON media_assets
    USING (public.app_user_text_matches(user_id))
    WITH CHECK (public.app_user_text_matches(user_id));

-- jobs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='jobs') THEN
        EXECUTE 'DROP POLICY IF EXISTS jobs_user_access ON jobs';
        EXECUTE $p$
            CREATE POLICY jobs_user_access ON jobs
                USING (
                    public.app_rls_mode() = 'system'
                    OR (public.app_rls_mode() = 'enforce'
                        AND EXISTS (
                            SELECT 1 FROM orders o
                            WHERE o.order_id = jobs.order_id
                              AND public.app_user_text_matches(o.user_id)
                        ))
                )
                WITH CHECK (
                    public.app_rls_mode() = 'system'
                    OR (public.app_rls_mode() = 'enforce'
                        AND EXISTS (
                            SELECT 1 FROM orders o
                            WHERE o.order_id = jobs.order_id
                              AND public.app_user_text_matches(o.user_id)
                        ))
                )
        $p$;
    END IF;
END $$;

-- wallets
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallets') THEN
        EXECUTE 'DROP POLICY IF EXISTS wallets_user_access ON wallets';
        EXECUTE $p$
            CREATE POLICY wallets_user_access ON wallets
                USING (public.app_user_matches(user_id))
                WITH CHECK (public.app_user_matches(user_id))
        $p$;
    END IF;
END $$;

-- wallet_transactions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallet_transactions') THEN
        EXECUTE 'DROP POLICY IF EXISTS wallet_transactions_user_access ON wallet_transactions';
        EXECUTE $p$
            CREATE POLICY wallet_transactions_user_access ON wallet_transactions
                USING (public.app_user_text_matches(user_id))
                WITH CHECK (public.app_user_text_matches(user_id))
        $p$;
    END IF;
END $$;

-- referrals
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='referrals') THEN
        EXECUTE 'DROP POLICY IF EXISTS referrals_participant_access ON referrals';
        EXECUTE $p$
            CREATE POLICY referrals_participant_access ON referrals
                USING (
                    public.app_rls_mode() = 'system'
                    OR (public.app_rls_mode() = 'enforce'
                        AND (referrer_user_id = public.app_current_user_uuid()
                             OR referred_user_id = public.app_current_user_uuid()))
                )
                WITH CHECK (
                    public.app_rls_mode() = 'system'
                    OR (public.app_rls_mode() = 'enforce'
                        AND (referrer_user_id = public.app_current_user_uuid()
                             OR referred_user_id = public.app_current_user_uuid()))
                )
        $p$;
    END IF;
END $$;

-- gift_packages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='gift_packages') THEN
        EXECUTE 'DROP POLICY IF EXISTS gift_packages_participant_access ON gift_packages';
        EXECUTE $p$
            CREATE POLICY gift_packages_participant_access ON gift_packages
                USING (
                    public.app_rls_mode() = 'system'
                    OR (public.app_rls_mode() = 'enforce'
                        AND (sender_user_id = public.app_current_user_uuid()
                             OR receiver_user_id = public.app_current_user_uuid()))
                )
                WITH CHECK (
                    public.app_rls_mode() = 'system'
                    OR (public.app_rls_mode() = 'enforce'
                        AND (sender_user_id = public.app_current_user_uuid()
                             OR receiver_user_id = public.app_current_user_uuid()))
                )
        $p$;
    END IF;
END $$;

-- ── 4. App roles ──────────────────────────────────────────────────────────────
-- NOLOGIN roles — for SET ROLE usage from a superuser connection, or create
-- LOGIN variants manually and update DATABASE_URL / WORKER_DATABASE_URL.
--
-- app_api    — API server; must SET LOCAL app.rls_mode to 'enforce' or 'system'
-- app_worker — Background workers and cron; always runs as 'system'

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
        CREATE ROLE app_api NOLOGIN;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
        CREATE ROLE app_worker NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_api, app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api, app_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_api, app_worker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_api, app_worker;
