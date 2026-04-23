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

CREATE INDEX IF NOT EXISTS idx_webhook_events_created
    ON webhook_events(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id
    ON webhook_events(order_id);
