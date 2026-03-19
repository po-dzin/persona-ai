-- Seed package matrix 150/350/800/2000/5000 for Stars + Stripe
-- Photo-first v59 baseline (Starter/Basic/Popular/Pro/Ultra)

INSERT INTO packages (code, title, credits, price_amount, currency, provider, sort_order)
VALUES
    ('STARTER_STARS', 'Starter 150', 150, 199, 'XTR', 'telegram_stars', 10),
    ('BASIC_STARS', 'Basic 350', 350, 399, 'XTR', 'telegram_stars', 20),
    ('POPULAR_STARS', 'Popular 800', 800, 799, 'XTR', 'telegram_stars', 30),
    ('PRO_STARS', 'Pro 2000', 2000, 1599, 'XTR', 'telegram_stars', 40),
    ('ULTRA_STARS', 'Ultra 5000', 5000, 2999, 'XTR', 'telegram_stars', 50),
    ('STARTER_STRIPE', 'Starter 150', 150, 199, 'USD', 'stripe', 10),
    ('BASIC_STRIPE', 'Basic 350', 350, 399, 'USD', 'stripe', 20),
    ('POPULAR_STRIPE', 'Popular 800', 800, 799, 'USD', 'stripe', 30),
    ('PRO_STRIPE', 'Pro 2000', 2000, 1599, 'USD', 'stripe', 40),
    ('ULTRA_STRIPE', 'Ultra 5000', 5000, 2999, 'USD', 'stripe', 50)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    credits = EXCLUDED.credits,
    price_amount = EXCLUDED.price_amount,
    currency = EXCLUDED.currency,
    provider = EXCLUDED.provider,
    sort_order = EXCLUDED.sort_order,
    is_active = true;
