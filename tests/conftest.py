"""
Test configuration.

Sets environment variables BEFORE any app modules are imported,
so that Settings() and create_engine() pick up the test database URL.
"""
import os

# Force test database — never hit production PostgreSQL
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


@pytest.fixture(autouse=True)
def reset_db():
    """Drop and recreate all tables before each test for clean isolation."""
    from app.core.db import Base, engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
