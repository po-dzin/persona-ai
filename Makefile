.PHONY: spec-lint test api worker beat web

spec-lint:
	python3 scripts/spec_lint.py

test:
	pytest -q

api:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir apps/api

worker:
	celery -A workers.celery.tasks worker --loglevel=INFO

beat:
	celery -A workers.celery.tasks beat --loglevel=INFO

web:
	cd apps/web && npm run dev
