# Secrets Checklist (Render + Upstash + R2)

Use this checklist before switching `INTEGRATION_MODE=real`.

Templates:

- `.env.example` as the single template for both local and real-flow setups.

## Checklist A: Must-have secrets (provided by operator)

- `DATABASE_URL`
- `REDIS_URL`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BASE_URL`
- `NANO_BANANA_API_KEY`
- `NANO_BANANA_API_URL`
- `STABILITY_API_KEY`
- `STABILITY_API_URL`
- `BFL_API_KEY`
- `OPENAI_API_KEY`
- `RECRAFT_API_KEY`
- `PROVIDER_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_MINIAPP_URL`

## Checklist B: Non-secret runtime defaults (already decided)

- `APP_ENV=prod`
- `INTEGRATION_MODE=real`
- `FREE_DEMO_MODE=false` (set `true` for free demo without worker queue)
- `API_PORT=8000`
- `PROVIDER_REAL_CALLS_ENABLED=true`
- `PROVIDER_REQUEST_TIMEOUT_SECONDS=45`
- `SLA_SECONDS_MIN=30`
- `SLA_SECONDS_MAX=120`
- `SOURCE_RETENTION_HOURS=48`
- `RESULT_RETENTION_DAYS=30`
- `BASE_GEN_USD=0.25`

## Phase 2 backlog (not required in current release)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_STARTER`
- `STRIPE_PRICE_ID_BASIC`
- `STRIPE_PRICE_ID_POPULAR`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ULTRA`

## Quick validation

```bash
cp .env.example .env
# then set APP_ENV=prod, INTEGRATION_MODE=real, PROVIDER_REAL_CALLS_ENABLED=true
python3 scripts/check_env.py --mode real --env-file .env
```

If validation is green, run infra stack and smoke flow.
