# Persona — Unified Specs

Единый пакет спецификаций для проекта `Persona`.

Этот каталог — **источник истины** для MVP и ближайших фаз.
Если старые документы конфликтуют с этим пакетом, приоритет у файлов из `specs/`.

## Канонические решения (фиксируем)

1. Surface: **Telegram Mini App + Web** (один frontend-код, разные входы).
2. Монетизация: **5 пакетов 150/350/800/2000/5000** + **1 бесплатная генерация** для нового пользователя.
3. Стек: **FastAPI + Redis + Celery + Celery Beat + DB-backed job state + provider webhooks + reconciliation**.
4. AI в MVP: **official-only** photo providers: Nano Banana, Stable Diffusion, FLUX, OpenAI Image, Recraft.
5. Платежи: **Telegram Stars primary**, **Stripe web fallback**.
6. Хранилище: **Postgres + Object Storage (S3-compatible)**.
7. Observability: **Sentry + structured logs + job metrics**.

## Структура каталога

- `00_unified_spec.md` — общий контракт фаз и baseline.
- `01_product_spec.md` — продуктовая спецификация MVP/Phase 1.
- `02_technical_architecture.md` — техническая архитектура, runtime-потоки, guardrails.
- `03_uiux_spec.md` — UX-флоу, экраны, copy и trust-поведение.
- `04_architecture_options.md` — варианты реализации и обоснование выбранного.
- `05_database_spec.md` — логическая модель БД и требования к данным.
- `06_technical_architecture_diagrams.md` — диаграммы техархитектуры (Mermaid).
- `07_database_er_diagram.md` — ER-диаграмма БД (Mermaid).
- `08_tariff_spec.md` — тарифная спецификация и правила кредитов/рефандов.
- `09_multi_agent_spec.md` — разделение ownership для parallel delivery.
- `schema.sql` — стартовая SQL-схема Postgres.

## Фазы

- **Phase 1 (MVP)**: AI фотосессии (image generation only).
- **Phase 1.1**: подарки, рефералка, расширенный профиль и дашборд.
- **Phase 2**: анимация/видео + cost routing optimization.

## KPI MVP

- Conversion free→paid package.
- Cost per generation и margin per paid package.
- p95 generation time.
- Failure rate (tech/content/payment).
- 7-day repeat rate.

## Implementation Map (Vertical Slice)

- `apps/web` — Mini App + Web UI, экранный граф из `persona-prototype-v59.html`.
- `apps/api` — FastAPI contracts + vertical slice domain logic.
- `workers/celery` — queue worker and beat tasks.
- `infra/db/migrations` — schema + tariff seed (`150/350/800/2000/5000`).
- `shared/contracts` — shared constants and contract types.
