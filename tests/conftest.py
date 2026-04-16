"""
Test configuration.

Sets environment variables BEFORE any app modules are imported,
so that Settings() and create_engine() pick up the test database URL.
"""
import os

# Force test database — never hit production PostgreSQL.
# In CI: TEST_DATABASE_URL=postgresql://... (set in ci.yml) enables real Postgres.
# Locally: falls back to in-memory SQLite.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("INTEGRATION_MODE", "mock")

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
API_DIR = ROOT / "apps" / "api"

for p in (ROOT, API_DIR):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)


@pytest.fixture(scope="session", autouse=True)
def apply_sql_migrations():
    """Apply SQL migrations once per session (PostgreSQL only).

    On SQLite the ORM manages the full schema; migrations are PostgreSQL-specific
    (RLS, functions, policies) and are skipped automatically by migrate.py.
    """
    db_url = os.environ["DATABASE_URL"]
    if not db_url.startswith("sqlite"):
        sys.path.insert(0, str(ROOT))
        import runpy
        # migrate.py reads DATABASE_URL from env, applies all *.sql files idempotently
        runpy.run_path(str(ROOT / "infra" / "db" / "migrate.py"), run_name="__main__")


@pytest.fixture(autouse=True)
def reset_db():
    """Drop and recreate all ORM-managed tables before each test for clean isolation."""
    from app.core.db import Base, engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
