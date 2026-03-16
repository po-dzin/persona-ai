# API app

Run locally:

```bash
pip install -r apps/api/requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir apps/api
```

Main endpoints:

- `POST /v1/uploads`
- `GET /v1/packages`
- `POST /v1/orders`
- `POST /v1/orders/{order_id}/start`
- `GET /v1/orders/{order_id}`
- `GET /v1/me/history`
- `POST /v1/webhooks/replicate`
- `POST /v1/webhooks/telegram`
- `POST /v1/webhooks/stripe`
