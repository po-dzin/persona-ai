-- Seed package matrix 5/20/50 for Stars + Stripe
-- Pricing anchor: base_gen_usd=0.25, markups S=3.0 M=2.6 L=2.2

INSERT INTO packages (code, title, credits, price_amount, currency, provider, sort_order)
VALUES
    ('S_STARS', 'Starter 5', 5, 399, 'XTR', 'telegram_stars', 10),
    ('M_STARS', 'Popular 20', 20, 1299, 'XTR', 'telegram_stars', 20),
    ('L_STARS', 'Pro 50', 50, 2799, 'XTR', 'telegram_stars', 30),
    ('S_STRIPE', 'Starter 5', 5, 399, 'USD', 'stripe', 10),
    ('M_STRIPE', 'Popular 20', 20, 1299, 'USD', 'stripe', 20),
    ('L_STRIPE', 'Pro 50', 50, 2799, 'USD', 'stripe', 30)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    credits = EXCLUDED.credits,
    price_amount = EXCLUDED.price_amount,
    currency = EXCLUDED.currency,
    provider = EXCLUDED.provider,
    sort_order = EXCLUDED.sort_order,
    is_active = true;
