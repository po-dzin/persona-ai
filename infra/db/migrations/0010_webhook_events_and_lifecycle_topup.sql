-- Migration 0010: webhook idempotency ledger + lifecycle aggregate topup

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS max_paid_topup_credits INTEGER NOT NULL DEFAULT 0;

-- Ensure default/not-null contract even when column was created earlier by ORM.
ALTER TABLE users
    ALTER COLUMN max_paid_topup_credits SET DEFAULT 0;

UPDATE users
SET max_paid_topup_credits = 0
WHERE max_paid_topup_credits IS NULL;

ALTER TABLE users
    ALTER COLUMN max_paid_topup_credits SET NOT NULL;

CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NULL,
    order_id TEXT NULL,
    payment_id TEXT NULL,
    payload_hash TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_webhook_events_provider_event UNIQUE (provider, event_id)
);

-- Legacy-compat path:
-- Some environments may already have webhook_events from 0001_schema.sql with
-- different shape (received_at/payload/processing_status, no order_id/payment_id/payload_hash/created_at).
-- Normalize those installs before relying on the new columns.
ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS order_id TEXT;

ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS payment_id TEXT;

ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS payload_hash TEXT;

ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'webhook_events'
          AND column_name = 'received_at'
    ) THEN
        EXECUTE
            'UPDATE webhook_events
             SET created_at = COALESCE(created_at, received_at, NOW())
             WHERE created_at IS NULL';
    ELSE
        EXECUTE
            'UPDATE webhook_events
             SET created_at = COALESCE(created_at, NOW())
             WHERE created_at IS NULL';
    END IF;
END $$;

ALTER TABLE webhook_events
    ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE webhook_events
    ALTER COLUMN created_at SET NOT NULL;

-- Keep uniqueness enforced even if legacy install used a different constraint name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event
    ON webhook_events(provider, event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_created
    ON webhook_events(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id
    ON webhook_events(order_id);
