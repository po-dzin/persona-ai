# API app

Run locally:

```bash
pip install -r apps/api/requirements.txt
python3 scripts/check_env.py --mode mock --env-file .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir apps/api
```

For real-flow validation (with provider/payment integrations), switch env mode and validate:

```bash
python3 scripts/check_env.py --mode real --env-file .env
```

Notes:

- Provider adapters run in mock mode by default.
- Real provider HTTP calls are enabled only when `INTEGRATION_MODE=real` and `PROVIDER_REAL_CALLS_ENABLED=true`.
- In case of provider HTTP/network failure, adapters currently degrade to deterministic mock output.

Main endpoints:

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
