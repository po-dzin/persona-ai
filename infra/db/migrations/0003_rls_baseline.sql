-- RLS baseline + UUID column for users.
--
-- This file was rewritten 2026-04-14 to be the canonical fresh-install version.
-- On prod it was originally applied as a combined inline script (functions +
-- UUID column + correct policies in one transaction) because the original stub
-- version of this file referenced non-existent columns.
--
-- Applying this file on a fresh DB is idempotent: all DDL uses IF NOT EXISTS /
-- OR REPLACE / IF NOT EXISTS constraint checks.
-- Applying it on prod (where the inline script already ran) is also idempotent.
--
-- Enforcement model (compat by default):
--   SET LOCAL app.rls_mode = 'enforce';
--   SET LOCAL app.current_user_id = '<users.id uuid>';
--
-- Only vertical_slice code paths that call set_rls_context() activate enforcement.

-- ── Helper functions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.app_rls_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.rls_mode', true), ''), 'compat')
$$;

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

-- UUID-based matcher (used for users.id UUID column directly)
CREATE OR REPLACE FUNCTION public.app_user_matches(candidate uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT NOT public.app_rls_is_enforced()
        OR candidate = public.app_current_user_uuid()
$$;

-- Text-based matcher (resolves Telegram user_id string → UUID via sub-select).
-- Used for tables where user_id is TEXT (orders, payments, media_assets, jobs).
CREATE OR REPLACE FUNCTION public.app_user_text_matches(candidate_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT NOT public.app_rls_is_enforced()
        OR EXISTS (
            SELECT 1
            FROM users u
            WHERE u.user_id = candidate_user_id
              AND u.id = public.app_current_user_uuid()
        )
$$;

-- Stub kept for backward compatibility; jobs policy is defined below.
CREATE OR REPLACE FUNCTION public.app_order_matches(candidate_order_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT NOT public.app_rls_is_enforced()
$$;

-- ── UUID column on users (required before users_self_access policy) ────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS id UUID;
UPDATE users SET id = gen_random_uuid() WHERE id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_id_unique' AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_id_unique UNIQUE (id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid ON users(id);

-- ── Enable RLS ────────────────────────────────────────────────────────────────

ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='jobs') THEN
        EXECUTE 'ALTER TABLE jobs ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- Phase 2+ tables — skip if not yet created
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallets') THEN
        EXECUTE 'ALTER TABLE wallets ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallet_transactions') THEN
        EXECUTE 'ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='referrals') THEN
        EXECUTE 'ALTER TABLE referrals ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='gift_packages') THEN
        EXECUTE 'ALTER TABLE gift_packages ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- ── Policies ──────────────────────────────────────────────────────────────────

-- users: id is UUID
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename='users'
                   AND policyname='users_self_access') THEN
        CREATE POLICY users_self_access ON users
            USING (public.app_user_matches(id))
            WITH CHECK (public.app_user_matches(id));
    END IF;
END $$;

-- orders: user_id is TEXT
DROP POLICY IF EXISTS orders_user_access ON orders;
CREATE POLICY orders_user_access ON orders
    USING (public.app_user_text_matches(user_id))
    WITH CHECK (public.app_user_text_matches(user_id));

-- payments: user_id is TEXT
DROP POLICY IF EXISTS payments_user_access ON payments;
CREATE POLICY payments_user_access ON payments
    USING (public.app_user_text_matches(user_id))
    WITH CHECK (public.app_user_text_matches(user_id));

-- media_assets: user_id is TEXT
DROP POLICY IF EXISTS media_assets_user_access ON media_assets;
CREATE POLICY media_assets_user_access ON media_assets
    USING (public.app_user_text_matches(user_id))
    WITH CHECK (public.app_user_text_matches(user_id));

-- jobs: scoped through orders.user_id (TEXT)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='jobs') THEN
        EXECUTE 'DROP POLICY IF EXISTS jobs_user_access ON jobs';
        EXECUTE $p$
            CREATE POLICY jobs_user_access ON jobs
                USING (
                    NOT public.app_rls_is_enforced()
                    OR EXISTS (
                        SELECT 1 FROM orders o
                        WHERE o.order_id = jobs.order_id
                          AND public.app_user_text_matches(o.user_id)
                    )
                )
                WITH CHECK (
                    NOT public.app_rls_is_enforced()
                    OR EXISTS (
                        SELECT 1 FROM orders o
                        WHERE o.order_id = jobs.order_id
                          AND public.app_user_text_matches(o.user_id)
                    )
                )
        $p$;
    END IF;
END $$;

-- Phase 2+ tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallets')
    AND NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname='public' AND tablename='wallets'
                    AND policyname='wallets_user_access') THEN
        CREATE POLICY wallets_user_access ON wallets
            USING (public.app_user_matches(user_id))
            WITH CHECK (public.app_user_matches(user_id));
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='wallet_transactions')
    AND NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname='public' AND tablename='wallet_transactions'
                    AND policyname='wallet_transactions_user_access') THEN
        CREATE POLICY wallet_transactions_user_access ON wallet_transactions
            USING (public.app_user_text_matches(user_id))
            WITH CHECK (public.app_user_text_matches(user_id));
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='referrals')
    AND NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname='public' AND tablename='referrals'
                    AND policyname='referrals_participant_access') THEN
        CREATE POLICY referrals_participant_access ON referrals
            USING (
                NOT public.app_rls_is_enforced()
                OR referrer_user_id = public.app_current_user_uuid()
                OR referred_user_id = public.app_current_user_uuid()
            )
            WITH CHECK (
                NOT public.app_rls_is_enforced()
                OR referrer_user_id = public.app_current_user_uuid()
                OR referred_user_id = public.app_current_user_uuid()
            );
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name='gift_packages')
    AND NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname='public' AND tablename='gift_packages'
                    AND policyname='gift_packages_participant_access') THEN
        CREATE POLICY gift_packages_participant_access ON gift_packages
            USING (
                NOT public.app_rls_is_enforced()
                OR sender_user_id = public.app_current_user_uuid()
                OR receiver_user_id = public.app_current_user_uuid()
            )
            WITH CHECK (
                NOT public.app_rls_is_enforced()
                OR sender_user_id = public.app_current_user_uuid()
                OR receiver_user_id = public.app_current_user_uuid()
            );
    END IF;
END $$;
