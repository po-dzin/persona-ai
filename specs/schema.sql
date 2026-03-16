-- Live Photo App unified schema (PostgreSQL)
-- Version: v1.0

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'draft',
        'awaiting_credit_or_payment',
        'queued',
        'processing',
        'done',
        'failed',
        'canceled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM (
        'queued',
        'submitted',
        'processing',
        'done',
        'failed',
        'timeout'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',
        'paid',
        'failed',
        'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE wallet_tx_type AS ENUM (
        'trial_grant',
        'package_purchase',
        'debit_generation',
        'refund_generation',
        'manual_adjustment',
        'gift_grant',
        'referral_reward'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE media_kind AS ENUM (
        'source',
        'result',
        'preview'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id bigint UNIQUE,
    web_user_external_id text UNIQUE,
    username text,
    first_name text,
    avatar_url text,
    locale text DEFAULT 'ru',
    free_credits_granted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (telegram_user_id IS NOT NULL OR web_user_external_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance_credits integer NOT NULL DEFAULT 0 CHECK (balance_credits >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    title text NOT NULL,
    credits integer NOT NULL CHECK (credits > 0),
    price_amount integer NOT NULL CHECK (price_amount > 0),
    currency text NOT NULL,
    provider text NOT NULL CHECK (provider IN ('telegram_stars', 'stripe')),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id uuid REFERENCES packages(id),
    provider text NOT NULL CHECK (provider IN ('telegram_stars', 'stripe')),
    external_charge_id text NOT NULL,
    amount integer NOT NULL CHECK (amount > 0),
    currency text NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    raw_payload jsonb,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, external_charge_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    style_code text NOT NULL,
    status order_status NOT NULL DEFAULT 'draft',
    credit_cost integer NOT NULL DEFAULT 1 CHECK (credit_cost > 0),
    is_free_credit_used boolean NOT NULL DEFAULT false,
    source_asset_id uuid,
    result_asset_id uuid,
    fail_reason_code text,
    fail_reason_message text,
    idempotency_key text UNIQUE,
    requested_at timestamptz NOT NULL DEFAULT now(),
    queued_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generation_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_task_id text,
    status job_status NOT NULL DEFAULT 'queued',
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    error_code text,
    error_message text,
    submitted_at timestamptz,
    started_at timestamptz,
    finished_at timestamptz,
    last_heartbeat_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_task_id)
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_updated
    ON generation_jobs(status, updated_at);

CREATE TABLE IF NOT EXISTS media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    kind media_kind NOT NULL,
    storage_bucket text NOT NULL,
    storage_key text NOT NULL,
    mime_type text,
    size_bytes bigint,
    width integer,
    height integer,
    duration_seconds numeric(10,3),
    checksum_sha256 text,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (storage_bucket, storage_key)
);

DO $$ BEGIN
    ALTER TABLE orders
        ADD CONSTRAINT fk_orders_source_asset
        FOREIGN KEY (source_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE orders
        ADD CONSTRAINT fk_orders_result_asset
        FOREIGN KEY (result_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
    tx_type wallet_tx_type NOT NULL,
    delta_credits integer NOT NULL CHECK (delta_credits <> 0),
    reason text,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
    ON wallet_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    event_id text NOT NULL,
    event_type text,
    payload jsonb NOT NULL,
    processing_status text NOT NULL DEFAULT 'received',
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    UNIQUE (provider, event_id)
);

-- Phase 1.1 tables
CREATE TABLE IF NOT EXISTS referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    referral_code text NOT NULL,
    reward_percent numeric(5,2) NOT NULL DEFAULT 10.00,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gift_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    package_id uuid NOT NULL REFERENCES packages(id),
    gift_token text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'expired', 'canceled')),
    redeemed_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
