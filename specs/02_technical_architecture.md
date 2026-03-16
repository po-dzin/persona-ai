# 02 · Technical Architecture (Balanced MVP)

## 1) Why this architecture

Выбранный профиль: **среднее между speed и reliability**.

- Быстрее, чем полноценная microservice/temporal-оркестрация.
- Надёжнее, чем in-process фоновые задачи без очереди.
- Масштабируется горизонтально без полного рефактора.

## 2) Final stack

- Frontend: React + TypeScript (Mini App + Web shell).
- API: FastAPI (Python 3.12).
- Queue: Redis + Celery workers.
- Scheduler: Celery Beat (reconciliation + periodic checks).
- DB: Postgres.
- Storage: S3-compatible object storage.
- AI provider: Replicate (LivePortrait primary, Runway Gen-4 Turbo fallback).
- Payments: Telegram Stars primary, Stripe fallback for Web/unsupported Stars regions.
- Monitoring: Sentry + structured logs.

## 3) Chosen implementation options (locked)

- Worker stack: Celery + Redis + Celery Beat (оптимум по зрелости retry/scheduling и горизонтальному scaling).
- Webhook dedup: только через `webhook_events` в Postgres (прозрачный audit trail и простая идемпотентность).
- Retention default: source media 48h, result media 30d (баланс приватности, UX и storage-cost).

## 4) Core services

- `api-gateway`: auth, rate-limit, user/order endpoints.
- `generation-orchestrator`: create jobs, dispatch to queue.
- `worker`: runs provider calls, handles retries/download/upload.
- `webhook-handler`: provider callbacks + payment callbacks.
- `reconciliation`: periodic checker for stale/in-flight jobs.

## 5) Main runtime flow

1. Client uploads photo metadata; file goes to object storage.
2. API creates `order` and `generation_job=queued`.
3. Credit engine decides:
- use free credit, or
- use paid balance, or
- require package purchase.
4. Queue dispatches generation task to worker.
5. Worker submits provider request with callback URL.
6. Provider webhook updates job (`processing/done/failed`).
7. On success: store result media, mark order done, notify client.
8. On fail: update reason; credit refund if technical failure class.

## 6) Reliability guardrails

- DB is source of truth for all statuses.
- Idempotency keys for payment and provider events via `webhook_events`.
- Exactly-once effect via state checks + unique constraints.
- Reconciliation every 5–10 min for stale jobs.
- Retry policy:
- network/provider transient: retry up to 2.
- policy/content fail: no retry.
- Job timeout hard-limit (e.g. 15 min).
- Dead-letter marker for manual inspection.

## 7) API boundaries (high-level)

- `POST /v1/uploads` — register upload.
- `GET /v1/packages` — active package list + computed prices.
- `POST /v1/orders` — create order draft.
- `POST /v1/orders/{id}/start` — consume credit/paywall gate + enqueue.
- `GET /v1/orders/{id}` — status tracking.
- `GET /v1/me/history` — gallery/history.
- `POST /webhooks/replicate` — generation callback.
- `POST /webhooks/telegram` — Stars events.
- `POST /webhooks/stripe` — Stripe events.

## 8) Security baseline

- Verify Telegram initData signature.
- Verify provider webhook signature.
- Verify Stripe signature.
- Signed URLs for private media access.
- PII minimization and retention TTL jobs.

## 9) Scaling path

- Step 1: scale workers horizontally.
- Step 2: provider routing (cost-aware by queue depth/SLA).
- Step 3: optional move to dedicated workflow engine.
- Step 4: optional GPU self-hosting when volume stabilizes.
