# 08 · Tariff Spec (5-tier, model-priced)

## 1) Chosen pricing strategy (locked)

- Unit billing: `1 generation = model_coin_cost`.
- Trial: `1 free generation` per `user_id` (one-time).
- Paid model: 5 пакетов `Starter/Basic/Popular/Pro/Ultra = 150/350/800/2000/5000`.
- Каналы оплаты: `Telegram Stars` (primary), `Stripe` (web/regional fallback).

## 2) Model price policy (photo-first)

- Стоимость генерации зависит от выбранной AI-модели.
- Диапазон MVP: `10–40 🪙` за генерацию.
- Канонический каталог (Phase 1):
  - Nano Banana — `10 🪙`
  - Stable Diffusion 3.5 Turbo — `15 🪙`
  - Recraft V4 — `25 🪙`
  - OpenAI GPT-image-1.5 — `30 🪙`
  - FLUX.1 Kontext [pro] — `40 🪙`

## 3) Package matrix (Stars baseline)

| Package | Coins | Price (⭐) | Bonus |
|---|---:|---:|---:|
| Starter | 150 | 199 | — |
| Basic | 350 | 399 | +5% |
| Popular | 800 | 799 | +10% |
| Pro | 2,000 | 1,599 | +18% |
| Ultra | 5,000 | 2,999 | +25% |

## 4) Credit and paywall rules

- При старте генерации проверяем по порядку: free credit → paid wallet → paywall.
- Paywall trigger: `wallet_balance < generation_cost` и free уже использован.
- Успешная генерация списывает стоимость выбранной модели.
- Technical failure делает авто-рефанд на списанную сумму.
- Policy/content failure не делает auto-refund (manual support override).

## 5) Payment outcome handling

- `pending`: заказ остается в paywall состоянии.
- `paid`: начисляем кредиты, снимаем paywall.
- `failed`: кредиты не начисляются, доступен retry.
- `refunded`: делаем обратную кредитную транзакцию, если кредиты не потрачены; иначе support case.

## 6) Canonical scenarios (for QA)

- Новый пользователь проходит 1 free generation без оплаты.
- После free при `0` балансе пользователь стабильно попадает в paywall.
- Покупка `Basic` начисляет `+350` кредитов одним ledger событием.
- Дубликат payment webhook не приводит к двойному начислению.
- Technical fail после списания делает refund на полную стоимость модели.
