-- Seed package matrix 150/365/875/2300/6000 for Stars + Stripe
-- Photo-first v59 baseline (Starter/Basic/Popular/Pro/Ultra)

INSERT INTO packages (code, title, credits, price_amount, currency, provider, sort_order)
VALUES
    ('STARTER_STARS', 'Starter 150', 150, 230, 'XTR', 'telegram_stars', 10),
    ('BASIC_STARS', 'Basic 365', 365, 537, 'XTR', 'telegram_stars', 20),
    ('POPULAR_STARS', 'Popular 875', 875, 1227, 'XTR', 'telegram_stars', 30),
    ('PRO_STARS', 'Pro 2300', 2300, 3067, 'XTR', 'telegram_stars', 40),
    ('ULTRA_STARS', 'Ultra 6000', 6000, 7667, 'XTR', 'telegram_stars', 50),
    ('STARTER_STRIPE', 'Starter 150', 150, 230, 'USD', 'stripe', 10),
    ('BASIC_STRIPE', 'Basic 365', 365, 537, 'USD', 'stripe', 20),
    ('POPULAR_STRIPE', 'Popular 875', 875, 1227, 'USD', 'stripe', 30),
    ('PRO_STRIPE', 'Pro 2300', 2300, 3067, 'USD', 'stripe', 40),
    ('ULTRA_STRIPE', 'Ultra 6000', 6000, 7667, 'USD', 'stripe', 50)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    credits = EXCLUDED.credits,
    price_amount = EXCLUDED.price_amount,
    currency = EXCLUDED.currency,
    provider = EXCLUDED.provider,
    sort_order = EXCLUDED.sort_order,
    is_active = true;
