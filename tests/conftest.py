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
# Tests must use a single privileged URL from TEST_DATABASE_URL.
# If APP/WORKER role-scoped URLs leak from env, reset_db may run as app_api/app_worker
# and fail on TRUNCATE with insufficient privilege.
os.environ["APP_DATABASE_URL"] = ""
os.environ["WORKER_DATABASE_URL"] = ""
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("INTEGRATION_MODE", "mock")

import sys
from pathlib import Path

import pytest
from sqlalchemy.exc import ProgrammingError

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
    """Reset test data before each test while preserving migrated PG schema state."""
    from app.core.db import Base, engine
    from sqlalchemy import inspect, text

    db_url = os.environ["DATABASE_URL"]
    if db_url.startswith("sqlite"):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    else:
        # Keep the migration-managed PostgreSQL schema intact: dropping tables
        # removes RLS policies, FORCE RLS, grants, and seeded reference data.
        with engine.begin() as conn:
            inspector = inspect(conn)
            existing_tables = set(inspector.get_table_names(schema="public"))
            table_names = [
                f'public."{table.name}"'
                for table in Base.metadata.sorted_tables
                if table.name in existing_tables
            ]
            if table_names:
                truncate_blocked = False
                try:
                    # Use a savepoint so a failed TRUNCATE doesn't poison
                    # the outer transaction used by the fallback cleanup.
                    with conn.begin_nested():
                        conn.execute(
                            text(
                                f"TRUNCATE TABLE {', '.join(table_names)} "
                                "RESTART IDENTITY CASCADE"
                            )
                        )
                except ProgrammingError as exc:
                    if "permission denied" not in str(exc).lower():
                        raise
                    truncate_blocked = True

                if truncate_blocked:
                    # Lower-privilege fallback for CI users without TRUNCATE rights.
                    for table_name in table_names:
                        conn.execute(text(f"DELETE FROM {table_name}"))

    yield
