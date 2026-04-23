.PHONY: spec-lint migration-sync env-check env-check-real test smoke ci-gate api worker beat web

PYTHON ?= python3
VENV_PY := $(if $(wildcard .venv312/bin/python),.venv312/bin/python,$(PYTHON))

spec-lint:
	$(PYTHON) scripts/spec_lint.py

migration-sync:
	$(PYTHON) scripts/check_migration_sync.py

env-check:
	$(PYTHON) scripts/check_env.py --mode mock --env-file .env

env-check-real:
	$(PYTHON) scripts/check_env.py --mode real --env-file .env

test:
	$(VENV_PY) -m pytest -q

smoke:
	$(VENV_PY) scripts/smoke_phase1.py

ci-gate:
	$(PYTHON) scripts/spec_lint.py
	$(PYTHON) scripts/check_migration_sync.py
	$(VENV_PY) -m pytest -q
	cd apps/web && npm run check:premerge
	cd apps/admin && npm run check:premerge

api:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir apps/api

worker:
	celery -A workers.celery.tasks worker --loglevel=INFO

beat:
	celery -A workers.celery.tasks beat --loglevel=INFO

web:
	cd apps/web && npm run dev
