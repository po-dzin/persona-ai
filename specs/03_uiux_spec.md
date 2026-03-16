# 03 · UI/UX Spec (Telegram-first: Mini App + Web)

## 1) UX principles

- Trust-first: прозрачность статусов, времени и ограничений.
- Value-fast: пользователь видит результат максимально рано.
- Low-friction: минимум шагов до первой генерации.
- Consistent surfaces: Mini App и Web повторяют одну информационную архитектуру.

## 2) Core screens (MVP)

1. Onboarding / Home.
2. Upload.
3. Style picker (preview-first).
4. Credit gate / Paywall (если нет кредита).
5. Processing.
6. Result.
7. Gallery/History.
8. Profile (basic).

## 3) UX state machine

- `idle`
- `uploaded`
- `style_selected`
- `credit_check`
- `payment_pending` (optional branch)
- `queued`
- `processing`
- `done`
- `failed_recoverable`
- `failed_non_recoverable`

## 4) Mandatory UX behaviors

- До запуска generation всегда показываем стоимость в кредитах.
- Если доступен free credit — явно показываем “1 free generation”.
- На processing показываем этапы:
- Upload validated
- Face detected
- Motion synthesis
- Rendering/export
- На результате всегда есть 3 CTA:
- Play/Preview
- Download
- Share
- На ошибке всегда есть recovery path (retry или upload another).

## 5) Copy contract (единый)

- Time promise: “Обычно 40–180 секунд”.
- Trust copy: “Фото удаляется после обработки по политике хранения”.
- Quality copy: “Лучше всего работают четкие портреты анфас”.
- Honesty copy: “Итог может немного отличаться от превью”.

## 6) Surface-specific notes

### Mini App

- Primary acquisition и conversion surface.
- Compact layout, один primary CTA на шаг.
- Нативное ощущение Telegram, но с брендовыми акцентами.

### Web

- SEO/landing + дополнительный conversion канал.
- Тот же flow и токены, чуть более просторная композиция.
- Stripe fallback включается для Web и для регионов, где Stars недоступны.

## 7) Phase 1.1 UX extensions

- Gift flow: покупка предоплаченного пакета для другого пользователя.
- Referral dashboard: клики, активированные рефералы, начисления.
- Profile upgrades: stats, earned credits, referral tier.
