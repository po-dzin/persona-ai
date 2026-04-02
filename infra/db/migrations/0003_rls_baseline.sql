-- Baseline staged RLS rollout for user-owned tables.
--
-- Default mode is compatibility:
--   - RLS is enabled.
--   - Policies allow access until the session explicitly opts into enforcement.
--
-- To enforce per-user isolation for a transaction:
--   SET LOCAL app.rls_mode = 'enforce';
--   SET LOCAL app.current_user_id = '<users.id uuid>';
--
-- This keeps current app/dev flows working while allowing incremental rollout.

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

CREATE OR REPLACE FUNCTION public.app_user_matches(candidate uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT NOT public.app_rls_is_enforced()
        OR candidate = public.app_current_user_uuid()
$$;

CREATE OR REPLACE FUNCTION public.app_order_matches(candidate_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT NOT public.app_rls_is_enforced()
        OR EXISTS (
            SELECT 1
            FROM orders o
            WHERE o.id = candidate_order_id
              AND o.user_id = public.app_current_user_uuid()
        )
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_packages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND policyname = 'users_self_access'
    ) THEN
        CREATE POLICY users_self_access
            ON users
            USING (public.app_user_matches(id))
            WITH CHECK (public.app_user_matches(id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'wallets'
          AND policyname = 'wallets_user_access'
    ) THEN
        CREATE POLICY wallets_user_access
            ON wallets
            USING (public.app_user_matches(user_id))
            WITH CHECK (public.app_user_matches(user_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'payments'
          AND policyname = 'payments_user_access'
    ) THEN
        CREATE POLICY payments_user_access
            ON payments
            USING (public.app_user_matches(user_id))
            WITH CHECK (public.app_user_matches(user_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'orders'
          AND policyname = 'orders_user_access'
    ) THEN
        CREATE POLICY orders_user_access
            ON orders
            USING (public.app_user_matches(user_id))
            WITH CHECK (public.app_user_matches(user_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'generation_jobs'
          AND policyname = 'generation_jobs_user_access'
    ) THEN
        CREATE POLICY generation_jobs_user_access
            ON generation_jobs
            USING (public.app_order_matches(order_id))
            WITH CHECK (public.app_order_matches(order_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'media_assets'
          AND policyname = 'media_assets_user_access'
    ) THEN
        CREATE POLICY media_assets_user_access
            ON media_assets
            USING (public.app_user_matches(user_id))
            WITH CHECK (public.app_user_matches(user_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'wallet_transactions'
          AND policyname = 'wallet_transactions_user_access'
    ) THEN
        CREATE POLICY wallet_transactions_user_access
            ON wallet_transactions
            USING (public.app_user_matches(user_id))
            WITH CHECK (public.app_user_matches(user_id));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'referrals'
          AND policyname = 'referrals_participant_access'
    ) THEN
        CREATE POLICY referrals_participant_access
            ON referrals
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
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'gift_packages'
          AND policyname = 'gift_packages_participant_access'
    ) THEN
        CREATE POLICY gift_packages_participant_access
            ON gift_packages
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
