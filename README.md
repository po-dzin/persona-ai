# Live Photo App — Vertical Slice MVP

This repository contains a mock-first vertical slice implementation aligned with the v2 specs.

## Structure

- `apps/web` — React + TypeScript web client scaffold.
- `apps/api` — FastAPI API contracts and in-memory vertical-slice domain implementation.
- `workers/celery` — Celery worker/beat task scaffold.
- `shared/contracts` — canonical statuses, tariffs, SLA, retention constants.
- `infra/db/migrations` — Postgres schema + package seeds (`5/20/50`).
- `specs` — source-of-truth product/architecture/database/tariff specs.

## Locked product constants

- Surfaces: Mini App + Web
- Tariffs: `5 / 20 / 50`
- Free trial: `1 free generation per user_id`
- SLA copy: `40–180 sec`
- Retention: `source 48h`, `result 30d`
- Idempotency: `webhook_events(provider,event_id)`

## Local checks

```bash
python3 scripts/spec_lint.py
pytest
```

## API endpoints (v1)

- `POST /v1/uploads`
- `GET /v1/packages`
- `POST /v1/orders`
- `POST /v1/orders/{order_id}/start`
- `GET /v1/orders/{order_id}`
- `GET /v1/me/history`
- `POST /v1/webhooks/replicate`
- `POST /v1/webhooks/telegram`
- `POST /v1/webhooks/stripe`
