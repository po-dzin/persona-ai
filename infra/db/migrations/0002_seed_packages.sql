-- Seed canonical package matrix for Telegram Stars provider.
-- Total delivered coins: 150/370/880/2300/6000 (base + bonus).

INSERT INTO packages (code, title, credits, price_amount, currency, provider, sort_order)
VALUES
    ('STARTER', 'Starter 150', 150, 230, 'XTR', 'telegram_stars', 10),
    ('BASIC', 'Basic 370', 350, 537, 'XTR', 'telegram_stars', 20),
    ('POPULAR', 'Popular 880', 800, 1227, 'XTR', 'telegram_stars', 30),
    ('PRO', 'Pro 2300', 2000, 3067, 'XTR', 'telegram_stars', 40),
    ('ULTRA', 'Ultra 6000', 5000, 7667, 'XTR', 'telegram_stars', 50)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    credits = EXCLUDED.credits,
    price_amount = EXCLUDED.price_amount,
    currency = EXCLUDED.currency,
    provider = EXCLUDED.provider,
    sort_order = EXCLUDED.sort_order,
    is_active = true;
