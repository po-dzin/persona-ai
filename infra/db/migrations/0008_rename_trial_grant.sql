-- Migration 0008: rename wallet_tx_type enum value 'trial_grant' → 'onboarding_bonus'.
--
-- Canonical name is 'onboarding_bonus' per specs/schema.sql.
-- The original 0001_schema.sql used 'trial_grant'; this aligns prod with the spec.
--
-- Idempotent: skips if the value is already named 'onboarding_bonus'.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'wallet_tx_type'
          AND e.enumlabel = 'trial_grant'
    ) THEN
        ALTER TYPE wallet_tx_type RENAME VALUE 'trial_grant' TO 'onboarding_bonus';
    END IF;
END $$;
