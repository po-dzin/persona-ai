-- Seed canonical package matrix for Telegram Stars provider.
-- Total delivered coins: 150/370/880/2300/6000 (base + bonus).
--
-- This file is responsible for both creating and seeding the packages table.
-- 0001_schema.sql (aspirational UUID-PK schema) is skipped by migrate.py so
-- the ORM manages all other tables; packages is the one table not in the ORM.

CREATE TABLE IF NOT EXISTS packages (
    code         TEXT    NOT NULL PRIMARY KEY,
    title        TEXT    NOT NULL,
    credits      INTEGER NOT NULL CHECK (credits > 0),
    price_amount INTEGER NOT NULL CHECK (price_amount > 0),
    currency     TEXT    NOT NULL,
    provider     TEXT    NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    sort_order   INTEGER NOT NULL DEFAULT 100
);

INSERT INTO packages (code, title, credits, price_amount, currency, provider, sort_order)
VALUES
    ('STARTER', 'Starter 150', 150, 230, 'XTR', 'telegram_stars', 10),
    ('BASIC',   'Basic 370',   350, 537, 'XTR', 'telegram_stars', 20),
    ('POPULAR', 'Popular 880', 800, 1227, 'XTR', 'telegram_stars', 30),
    ('PRO',     'Pro 2300',   2000, 3067, 'XTR', 'telegram_stars', 40),
    ('ULTRA',   'Ultra 6000', 5000, 7667, 'XTR', 'telegram_stars', 50)
ON CONFLICT (code) DO UPDATE SET
    title        = EXCLUDED.title,
    credits      = EXCLUDED.credits,
    price_amount = EXCLUDED.price_amount,
    currency     = EXCLUDED.currency,
    provider     = EXCLUDED.provider,
    sort_order   = EXCLUDED.sort_order,
    is_active    = true;
