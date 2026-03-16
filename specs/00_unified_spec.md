# 00 · Unified Spec Contract (Single Source of Truth)

## Product identity

- Product: `Live Photo App`
- Surfaces: `Telegram Mini App` + `Web`
- Monetization: `Packages + 1 Free Generation`
- Positioning: быстрый, понятный, trust-first AI animation сервис.

## Canonical flow

1. Onboarding
2. Upload
3. Style Pick (preview)
4. Credit Check
5. Paywall (if needed)
6. Processing
7. Result
8. History/Profile

## Canonical statuses

- Order: `draft` → `awaiting_credit_or_payment` → `queued` → `processing` → `done|failed`
- Job: `queued` → `submitted` → `processing` → `done|failed|timeout`
- Payment: `pending` → `paid|failed|refunded`

## Canonical SLA & copy

- ETA copy: `Обычно 40–180 секунд`
- Quality copy: `Лучше работают четкие портреты анфас`
- Honesty copy: `Итог может немного отличаться от превью`
- Privacy copy: `Фото удаляется по политике хранения`

## Canonical technical baseline

- FastAPI + Postgres + Redis + Celery Workers + Celery Beat + Webhooks + Reconciliation.
- Replicate-based generation in MVP.
- Telegram Stars primary, Stripe fallback.
- Webhook dedup: `webhook_events(provider,event_id)` as single source for idempotency.

## Canonical data baseline

- Credit-ledger model (wallet + immutable transactions).
- Idempotency by unique external IDs + webhook event dedup.
- Media assets with TTL and signed access (`source=48h`, `result=30d`).

## Canonical tariff baseline

- 3-tier packages only: `5 / 20 / 50` credits.
- Cost-based pricing from `base_gen_usd` with markups `x2..x3`.
- Locked launch baseline: `base_gen_usd=0.25`, multipliers `S=3.0`, `M=2.6`, `L=2.2`.

## Canonical visual layer

- Technical architecture diagrams: `06_technical_architecture_diagrams.md`.
- Database ER diagram: `07_database_er_diagram.md`.
- Tariff matrix and credit rules: `08_tariff_spec.md`.

## Out of MVP (moved)

- Full affiliate dashboards.
- Advanced gift automation.
- Self-hosted GPU orchestration.
