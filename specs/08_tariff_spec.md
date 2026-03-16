# 08 · Tariff Spec (3-tier, cost-based)

## 1) Chosen pricing strategy (locked)

- Unit billing: `1 generation = 1 credit`.
- Trial: `1 free generation` per `user_id` (one-time).
- Paid model: 3 пакета `S/M/L = 5/20/50`.
- Каналы оплаты: `Telegram Stars` (primary), `Stripe` (web/regional fallback).

Почему это оптимально:

- 3 пакета уменьшают choice overload и повышают конверсию в MVP.
- Кредитная модель упрощает UX и поддержку нескольких AI-провайдеров.
- Cost-based pricing защищает маржу при изменении себестоимости моделей.

## 2) Base generation price model (Luma/Runway/Kling)

- Расчетная формула: `base_gen_usd = median(luma_base_usd, runway_base_usd, kling_base_usd)`.
- Если `kling_base_usd` временно недоступен в контрактных данных, используем fallback: `median(luma_base_usd, runway_base_usd)`.
- Для запуска фиксируем операционный baseline: `base_gen_usd = 0.25`.
- Обновление baseline: weekly recalculation по свежим provider rates.

Причина выбора медианы:

- медиана устойчива к резким всплескам стоимости у одного провайдера;
- не завышает цену как `max`, но и не занижает маржу как `min`.

## 3) Markup policy (x2..x3)

- `S` пакет: `x3.0` на кредит.
- `M` пакет: `x2.6` на кредит.
- `L` пакет: `x2.2` на кредит.

Интервал x2..x3 соблюдён и сохраняет нисходящую цену за кредит от S к L.

## 4) Final package prices (USD anchor)

Расчет от `base_gen_usd = 0.25`:

| Package | Credits | Markup | Raw price (USD) | Final price (USD) |
|---|---:|---:|---:|---:|
| S | 5 | x3.0 | 3.75 | 3.99 |
| M | 20 | x2.6 | 13.00 | 12.99 |
| L | 50 | x2.2 | 27.50 | 27.99 |

Правило для Stars:

- `stars_price = ceil(usd_price / star_usd_rate)`
- `star_usd_rate` задается конфигом биллинга и обновляется без релиза приложения.

## 5) Credit and paywall rules

- При старте генерации проверяем по порядку: free credit → paid wallet → paywall.
- Paywall trigger: `wallet_balance == 0` и free уже использован.
- Успешная генерация списывает ровно 1 кредит.
- Technical failure делает авто-рефанд `+1` кредит.
- Policy/content failure не делает auto-refund (manual support override).

## 6) Payment outcome handling

- `pending`: заказ остается в paywall состоянии.
- `paid`: начисляем кредиты, снимаем paywall.
- `failed`: кредиты не начисляются, доступен retry.
- `refunded`: делаем обратную кредитную транзакцию, если кредиты не потрачены; иначе support case.

## 7) Canonical scenarios (for QA)

- Новый пользователь проходит 1 free generation без оплаты.
- После free при `0` балансе пользователь стабильно попадает в paywall.
- Покупка `M` начисляет `+20` кредитов одним ledger событием.
- Дубликат payment webhook не приводит к двойному начислению.
- Technical fail после списания кредита создает `refund_generation +1`.
