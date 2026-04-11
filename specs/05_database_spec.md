# 05 · Database Spec (Persona — Coin Economy)

## 1) Design goals

- Coin-ledger модель для прозрачного учёта монет
- Каталог стилей и AI-моделей в БД (управляемый через API)
- Все состояния заказов и генераций только в БД
- Идемпотентность через уникальные ключи и event-log подход

## 2) Core entities

- `users` — профиль (telegram_id, username, avatar, flags)
- `style_categories` — категории стилей (Тренды, Бизнес, Лайфстайл, Арт, Особый повод)
- `styles` — стили (name, category_id, gradient_class, prompt_template, tag, sort_order)
- `ai_models` — AI модели (name, price_coins, is_active)
- `wallets` — агрегированный баланс монет
- `wallet_transactions` — неизменяемый журнал начислений/списаний в монетах
- `coin_packages` — пакеты монет (name, coins, price_stars, bonus_percent)
- `orders` — пользовательские заказы на генерацию
- `generation_jobs` — жизненный цикл генерации
- `payments` — платежи Telegram Stars
- `media_assets` — source/result файлы

## 3) Optional entities (Phase 1.1)

- `referrals`, `referral_rewards`
- `gift_packages`, `gift_redemptions`
- `user_favorites` — избранные фото

## 4) Status contracts

### orders.status
`draft` → `queued` → `processing` → `done` → `failed` → `canceled`

### generation_jobs.status
`queued` → `submitted` → `processing` → `done` → `failed` → `timeout`

### payments.status
`pending` → `paid` → `failed` → `refunded`

## 5) Ledger rules

- Любое изменение баланса только через `wallet_transactions`
- `wallets.balance_coins` = сумма подтвержденных транзакций
- Списание монет при старте генерации (atomically) — количество = `ai_models.price_coins`
- Refund монет при technical failure — отдельная транзакция
- Покупка пакета: base coins + bonus coins (ceil(coins * bonus_percent / 100))

## 6) AI model pricing

| Model | ID | Provider | Price (🪙) |
|-------|-------|----------|--------:|
| Nano Banana 2 · 1k | `nb2-1k` | nano_banana | 10 |
| Nano Banana 2 · 2k | `nb2-2k` | nano_banana | 15 |
| Nano Banana 2 · 4k | `nb2-4k` | nano_banana | 22 |
| Nano Banana Pro · 2k | `nb-pro-2k` | nano_banana | 20 |
| Nano Banana Pro · 4k | `nb-pro-4k` | nano_banana | 35 |
| FLUX.2 Pro · 1k | `flux2-pro-1k` | flux | 7 |
| FLUX.2 Pro · 2k | `flux2-pro-2k` | flux | 14 |
| FLUX.2 Pro · 4k | `flux2-pro-4k` | flux | 27 |
| FLUX.2 Max · 1k | `flux2-max-1k` | flux | 12 |
| FLUX.2 Max · 2k | `flux2-max-2k` | flux | 22 |
| FLUX.2 Max · 4k | `flux2-max-4k` | flux | 42 |

- MVP model families: `Nano Banana 2`, `Nano Banana Pro`, `FLUX.2 Pro`, `FLUX.2 Max`
- Quality tiers: `1k / 2k / 4k`
- Styles flow default: `nb2-1k` (fixed, hidden from user)

## 7) Coin packages

| Package | Coins | Price (⭐) | Bonus |
|---------|------:|---------:|------:|
| Starter | 150 | 230 | — |
| Basic | 350 +20 | 537 | +5% |
| Popular | 800 +80 | 1 227 | +10% |
| Pro | 2 000 +300 | 3 067 | +15% |
| Ultra | 5 000 +1000 | 7 667 | +20% |

## 8) Retention

- Source media TTL: 48 часов
- Result media TTL: 30 дней
- Метаданные заказов и платежей — длительное хранение
