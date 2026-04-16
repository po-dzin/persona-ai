-- Migration 0004: create media_assets table and supporting indexes.
-- Safe to run multiple times (IF NOT EXISTS).
--
-- Note: this project uses ORM-managed schema (init_db / create_all).
-- This migration is provided for clean-DB bootstrap and manual tooling
-- (e.g. psql, Flyway). Running it on a DB that was already bootstrapped
-- by the app is safe — all statements are idempotent.

CREATE TABLE IF NOT EXISTS media_assets (
    id              TEXT        PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    order_id        TEXT,
    kind            TEXT        NOT NULL,
    storage_bucket  TEXT        NOT NULL,
    storage_key     TEXT        NOT NULL,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_media_assets_storage_key UNIQUE (storage_key)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_expires_at
    ON media_assets(expires_at);

CREATE INDEX IF NOT EXISTS idx_media_assets_order_id
    ON media_assets(order_id);
