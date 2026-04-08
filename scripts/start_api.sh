#!/bin/bash
set -e
cd "$(dirname "$0")/.."
export PYTHONPATH=".venv312/lib/python3.12/site-packages:$PYTHONPATH"
export VIRTUAL_ENV=".venv312"
exec .venv312/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 3000 --app-dir apps/api
