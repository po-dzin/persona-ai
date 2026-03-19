# Celery worker scaffold

Worker/beat read `REDIS_URL` from environment (default `redis://localhost:6379/0`).

Run worker:

```bash
celery -A workers.celery.tasks worker --loglevel=INFO
```

Run beat:

```bash
celery -A workers.celery.tasks beat --loglevel=INFO
```

Implemented task signatures:

- `generation.dispatch(order_id, model_id, provider)`
- `generation.finalize(order_id, event_type, result_url=None)`
- `credits.refund_technical_failure(order_id, credit_cost)`
- `reconciliation.stale_jobs()`
