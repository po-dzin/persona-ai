# 05 · Database Spec

## 1) Design goals

- Состояния заказов и генераций храним только в БД.
- Кредитная модель и платежи полностью трассируемы.
- Идемпотентность обеспечивается уникальными ключами и event-log подходом.

## 2) Core entities

- `users` — профиль и флаги trial/free.
- `packages` — тарифные пакеты генераций.
- `wallets` — агрегированный баланс кредитов.
- `wallet_transactions` — неизменяемый журнал начислений/списаний.
- `orders` — пользовательские заказы на генерацию.
- `generation_jobs` — жизненный цикл генерации и provider links.
- `payments` — платежи Stars/Stripe.
- `media_assets` — source/result файлы.

## 3) Optional entities (Phase 1.1)

- `gift_packages`, `gift_redemptions`.
- `referrals`, `referral_rewards`.

## 4) Status contracts

### orders.status

- `draft`
- `awaiting_credit_or_payment`
- `queued`
- `processing`
- `done`
- `failed`
- `canceled`

### generation_jobs.status

- `queued`
- `submitted`
- `processing`
- `done`
- `failed`
- `timeout`

### payments.status

- `pending`
- `paid`
- `failed`
- `refunded`

## 5) Ledger rules

- Любое изменение баланса только через `wallet_transactions`.
- `wallets.balance_credits` = сумма подтвержденных транзакций.
- Списание кредита происходит при старте generation (atomically).
- Refund кредита при technical failure фиксируется отдельной транзакцией.

## 6) Idempotency rules

- `payments.external_charge_id` уникален per provider.
- `generation_jobs.provider_task_id` уникален per provider.
- Для webhook event используем только таблицу `webhook_events` с уникальным `(provider, event_id)`.

## 7) Retention (baseline)

- `source` media TTL: 48 часов.
- `result` media TTL: 30 дней (MVP default; дальше параметризуется тарифом).
- Метаданные заказов и платежей храним дольше для аналитики и support.

## 8) Tariff pricing basis

- Базовая цена генерации (`base_gen_usd`) определяется как медиана по базовым провайдерам (Luma/Runway/Kling).
- Если один провайдер временно без верифицированного прайса, baseline считается по доступным провайдерам.
- Цена пакетов рассчитывается от `base_gen_usd` через мультипликатор `x2..x3` на кредит.
- Формула: `package_price = credits * base_gen_usd * markup_multiplier`.
- Locked baseline: `base_gen_usd = 0.25`.
- Locked multipliers: `S=x3.0`, `M=x2.6`, `L=x2.2`.
- Пакеты в системе: `5/20/50`, где `price_per_credit(S) > price_per_credit(M) > price_per_credit(L)`.
