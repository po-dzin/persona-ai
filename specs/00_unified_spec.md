# 00 · Unified Spec Contract (Single Source of Truth)

## Product identity

- Product: `Persona`
- Surfaces: `Telegram Mini App` (primary) + `Web` (secondary)
- Monetization: `Coin packages + Telegram Stars`
- Positioning: AI фотосессии в трендовых стилях — быстро, красиво, эмоционально.

## Product phases

- **Phase 1 (MVP)**: AI фотосессии / трендовые фото (генерация изображений)
- **Phase 2**: AI анимации (generation of video/live photos)

## Canonical flow

### Основная навигация (5-tab)

1. Главная — каталог стилей по категориям
2. Мои фото — галерея результатов + очередь
3. ✨ AI (center) — создание генерации
4. Баланс — монеты + пакеты
5. Профиль — статистика, партнёрка, помощь

### Генерация (2 шага)

1. Выбрать стиль (каталог/кастом) или AI-модель + промпт
2. Загрузить фото → подтверждение → очередь

## Canonical statuses

- Order: `draft` → `queued` → `processing` → `done|failed`
- Job: `queued` → `submitted` → `processing` → `done|failed|timeout`
- Payment: `pending` → `paid|failed|refunded`

## Canonical SLA & copy

- ETA copy: `Обычно 30–120 секунд`
- Quality copy: `Лучше работают четкие портреты с хорошим освещением`
- Honesty copy: `Итог может немного отличаться от превью`
- Privacy copy: `Фото удаляется по политике хранения`

## Canonical technical baseline

- **Frontend**: Preact + TypeScript + Vite (Telegram Mini App + Web)
- **API**: FastAPI + Postgres + Redis + Celery Workers
- **AI providers**: Nano Banana, Stable Diffusion, FLUX, OpenAI Image, Recraft (official-only)
- **Payments**: Telegram Stars (primary)
- **Webhook dedup**: `webhook_events(provider,event_id)` as single source for idempotency

## Canonical data baseline

- Coin-ledger model (wallet + immutable transactions in coins).
- Styles catalog with categories, tags, gradient previews, prompt templates.
- AI models with per-model coin pricing.
- Idempotency by unique external IDs + webhook event dedup.
- Media assets with TTL and signed access (`source=48h`, `result=30d`).

## Canonical tariff baseline

- 5-tier packages: `Starter/Basic/Popular/Pro/Ultra` = `150/365/875/2300/6000` coins
- Prices in Telegram Stars: `230/537/1227/3067/7667 ⭐`
- Volume bonuses: `—/+4%/+9%/+15%/+20%`
- Per-model pricing: `10–40 🪙` per generation depending on AI model

## Out of MVP (moved to Phase 2+)

- AI video/animation generation
- Full affiliate dashboards
- Advanced gift automation
- Self-hosted GPU orchestration
