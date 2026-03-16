# Live Photo App — Unified Specs

Единый пакет спецификаций для проекта `Live Photo App`.

Этот каталог — **источник истины** для MVP и ближайших фаз.
Если старые документы конфликтуют с этим пакетом, приоритет у файлов из `specs/`.

## Канонические решения (фиксируем)

1. Surface: **Telegram Mini App + Web** (один frontend-код, разные входы).
2. Монетизация: **3 пакета 5/20/50** + **1 бесплатная генерация** для нового пользователя.
3. Баланс скорости/надежности/масштаба: **FastAPI + Redis + Celery + Celery Beat + DB-backed job state + provider webhooks + reconciliation**.
4. AI в MVP: **Replicate (LivePortrait primary, Runway Gen-4 Turbo fallback)** через provider adapter.
5. Платежи: **Telegram Stars primary**, **Stripe для web и регионального fallback**.
6. Хранилище: **Postgres + Object Storage (S3-compatible)**.
7. Observability: **Sentry + structured logs + job metrics**.

## Структура каталога

- `01_product_spec.md` — продуктовая спецификация MVP/Phase 1.
- `02_technical_architecture.md` — техническая архитектура, runtime-потоки, guardrails.
- `03_uiux_spec.md` — UX-флоу, экраны, copy и trust-поведение.
- `04_architecture_options.md` — варианты реализации и обоснование выбранного.
- `05_database_spec.md` — логическая модель БД и требования к данным.
- `06_technical_architecture_diagrams.md` — диаграммы техархитектуры (Mermaid).
- `07_database_er_diagram.md` — ER-диаграмма БД (Mermaid).
- `08_tariff_spec.md` — тарифная спецификация и правила кредитов/рефандов.
- `schema.sql` — стартовая SQL-схема Postgres.
- `ux_pain_to_solution.html` — обновлённая map боли→решения.

## Фазы

- **MVP (v1.0)**: upload → style → free/paywall → processing → result → history.
- **Phase 1.1**: подарки, рефералка, расширенный профиль и дашборд.
- **Phase 2**: cost optimization (self-hosted GPU / Modal), multi-provider routing.

## KPI MVP

- Conversion free→paid package.
- Cost per generation и margin per paid package.
- p95 generation time.
- Failure rate (tech/content/payment).
- 7-day repeat rate.

## Implementation Map (Vertical Slice)

- `apps/web` — Mini App + Web frontend scaffold.
- `apps/api` — FastAPI contracts + vertical slice domain logic.
- `workers/celery` — queue worker and beat tasks.
- `infra/db/migrations` — schema + tariff seed (`5/20/50`).
- `shared/contracts` — shared constants for statuses/tariffs/SLA/retention.
