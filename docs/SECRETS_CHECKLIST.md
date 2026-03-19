# Secrets Checklist for Real-Flow Test

Use this checklist before switching `INTEGRATION_MODE=real`.

Templates:

- `.env.example` for universal local setup.
- `.env.real.example` for real-flow setup.

## 1) Must-have secrets

- `NANO_BANANA_API_KEY`
- `STABILITY_API_KEY`
- `BFL_API_KEY`
- `OPENAI_API_KEY`
- `RECRAFT_API_KEY`
- `PROVIDER_WEBHOOK_SECRET`
- `NANO_BANANA_API_URL`
- `STABILITY_API_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_STARS_PROVIDER_TOKEN`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

## 2) Required if Stripe fallback is enabled

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_STARTER`
- `STRIPE_PRICE_ID_BASIC`
- `STRIPE_PRICE_ID_POPULAR`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ULTRA`

## 3) Provider flags (optional, runtime)

- `MODEL_ENABLED_NANO_BANANA`
- `MODEL_ENABLED_STABLE_DIFFUSION`
- `MODEL_ENABLED_FLUX`
- `MODEL_ENABLED_OPENAI_IMAGE`
- `MODEL_ENABLED_RECRAFT`
- `PROVIDER_REAL_CALLS_ENABLED`
- `PROVIDER_REQUEST_TIMEOUT_SECONDS`

## 4) Minimal non-secret runtime vars

- `INTEGRATION_MODE=real`
- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`

## 5) Quick validation

```bash
cp .env.real.example .env
python3 scripts/check_env.py --mode real --env-file .env
```

If validation is green, run infra stack and smoke flow.
