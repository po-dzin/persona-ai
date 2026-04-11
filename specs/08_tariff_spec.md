# 08 · Tariff Spec (5-tier, model-priced)

## 1) Chosen pricing strategy (locked)

- Unit billing: `1 generation = model_coin_cost`.
- Onboarding: `20` paid coins on first user creation.
- Paid model: 5 пакетов `Starter/Basic/Popular/Pro/Ultra = 150/370/880/2300/6000` (total delivered).
- Каналы оплаты: `Telegram Stars` (primary), `Stripe` (web/regional fallback).
- Legacy package aliases (например, `*_STARS`) не поддерживаются.

## 2) Model price policy (photo-first)

- Стоимость генерации зависит от выбранной AI-модели.
- Канонический каталог (Phase 1) берется из `shared/contracts/status.py`.
- Текущий диапазон цен: `7–42 🪙` за генерацию.
- Поддерживаемые семейства моделей: `Nano Banana 2`, `Nano Banana Pro`, `FLUX.2 Pro`, `FLUX.2 Max`.
- Legacy model aliases отключены; принимаются только canonical model IDs.

## 3) Package matrix (Stars baseline)

| Package | Coins | Price (⭐) | Bonus |
|---|---:|---:|---:|
| Starter | 150 | 230 | — |
| Basic | 350 +20 | 537 | +5% |
| Popular | 800 +80 | 1,227 | +10% |
| Pro | 2,000 +300 | 3,067 | +15% |
| Ultra | 5,000 +1000 | 7,667 | +20% |

## 4) Credit and paywall rules

- При старте генерации проверяем: `paid wallet -> paywall`.
- Paywall trigger: `wallet_balance < generation_cost`.
- Успешная генерация списывает стоимость выбранной модели.
- `technical_failed` делает авто-рефанд на списанную сумму.
- `policy_failed` не делает auto-refund (manual support override).
- Lifecycle state не должен изменяться только из-за fail-события.

## 5) Payment outcome handling

- `pending`: заказ остается в paywall состоянии.
- `paid`: начисляем кредиты, снимаем paywall.
- `failed`: кредиты не начисляются, доступен retry.
- `refunded`: делаем обратную кредитную транзакцию, если кредиты не потрачены; иначе support case.

## 6) Canonical scenarios (for QA)

- Новый пользователь получает `20` onboarding coins.
- При `0` балансе пользователь стабильно попадает в paywall.
- Покупка `Basic` начисляет `350 + 20 = 370` монет одним событием.
- Дубликат payment webhook не приводит к двойному начислению.
- Technical fail после списания делает refund на полную стоимость модели.
