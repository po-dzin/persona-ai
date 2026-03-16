# Celery worker scaffold

Run worker:

```bash
celery -A workers.celery.tasks worker --loglevel=INFO
```

Run beat:

```bash
celery -A workers.celery.tasks beat --loglevel=INFO
```

Implemented task signatures:

- `generation.dispatch(order_id)`
- `generation.finalize(order_id, event_type)`
- `credits.refund_technical_failure(order_id)`
- `reconciliation.stale_jobs()`
