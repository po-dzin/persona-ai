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
| Nano Banana | `nano-banana-v1` | nano_banana | 10 |
| Stable Diffusion 3.5 Turbo | `sd-3.5-turbo` | stable_diffusion | 15 |
| Recraft V4 | `recraft-v4` | recraft | 25 |
| OpenAI GPT-image-1.5 | `gpt-image-1.5` | openai_image | 30 |
| FLUX.1 Kontext [pro] | `flux-kontxt-pro` | flux | 40 |

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
