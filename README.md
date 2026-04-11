# Persona — Photo-First MVP

This repository contains a mock-first implementation aligned with the photo-first Phase 1 specs (`v59` baseline).

## Structure

- `apps/web` — React + TypeScript UI app with v59-style screens/components.
- `apps/api` — FastAPI API contracts and in-memory vertical-slice domain implementation.
- `workers/celery` — Celery worker/beat task scaffold.
- `shared/contracts` — canonical statuses, tariffs, SLA, retention constants.
- `infra/db/migrations` — Postgres schema + canonical package seeds (`STARTER/BASIC/POPULAR/PRO/ULTRA`).
- `specs` — source-of-truth product/architecture/database/tariff specs.

## Locked product constants

- Surfaces: Mini App + Web
- Tariffs: base `150/350/800/2000/5000`, total delivered `150/370/880/2300/6000`
- Onboarding bonus: `20 paid coins per user_id`
- SLA copy: `30–120 sec`
- Retention: `source 48h`, `result 30d`
- Idempotency: `webhook_events(provider,event_id)`

## Local checks

```bash
python3 scripts/spec_lint.py
python3 scripts/check_env.py --mode mock --env-file .env
python3 -m pytest -q
python3 scripts/smoke_phase1.py
cd apps/web && npm run build
```

## Real-flow prep (without code changes)

Current infra baseline: `Render + Upstash + Cloudflare R2` (3 services total).
Stripe payments are intentionally moved to Phase 2 backlog; Phase 1 uses Telegram Stars only.

For free demo runs without a paid worker, set `FREE_DEMO_MODE=true`:
- `REDIS_URL` is not required by env validator in this mode.
- If provider adapter returns `result_url` on submit, order is finalized synchronously.

Env templates policy:

- `.env.example` — single template for both mock/local and real integration.

1. Create local env file from template:

```bash
cp .env.example .env
```

2. For real-flow set:

```bash
APP_ENV=prod
INTEGRATION_MODE=real
PROVIDER_REAL_CALLS_ENABLED=true
```

3. Fill secrets from `docs/SECRETS_CHECKLIST.md`.
4. Validate required vars:

```bash
python3 scripts/check_env.py --mode real --env-file .env
```

5. Start local runtime stack:

```bash
docker compose -f infra/docker-compose.yml up --build
```

Note: MVP flow is `photo-only` upload; user driving-video upload is intentionally disabled.

## API endpoints (v1)

- `GET /v1/styles`
- `GET /v1/models`
- `GET /v1/me/balance`
- `GET /v1/me/photos`
- `POST /v1/purchase`
- `POST /v1/generate`
- `POST /v1/uploads`
- `GET /v1/packages`
- `POST /v1/orders`
- `POST /v1/orders/{order_id}/start`
- `GET /v1/orders/{order_id}`
- `GET /v1/me/history`
- `POST /v1/webhooks/{provider}`
- `POST /v1/webhooks/replicate`
- `POST /v1/webhooks/telegram`
- `POST /v1/webhooks/stripe`

## Make targets

- `make spec-lint` — specs consistency checks
- `make test` — pytest suite
- `make smoke` — end-to-end smoke through API flow
- `make ci-gate` — spec lint + tests + web build
