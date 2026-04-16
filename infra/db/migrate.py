"""
Run all SQL migrations in infra/db/migrations/ in filename order.

All migration files are idempotent (IF NOT EXISTS / OR REPLACE / DO $$ IF NOT EXISTS $$),
so re-running is always safe.

Usage:
    python infra/db/migrate.py
    DATABASE_URL=postgres://... python infra/db/migrate.py
"""
from __future__ import annotations

import os
import pathlib
import sys

MIGRATIONS_DIR = pathlib.Path(__file__).parent / "migrations"


def run() -> None:
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("ERROR: DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    # Local SQLite dev databases don't need SQL migrations (ORM handles schema).
    if database_url.startswith("sqlite"):
        print("SQLite detected — skipping SQL migrations (ORM manages schema)")
        return

    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print("ERROR: sqlalchemy not installed", file=sys.stderr)
        sys.exit(1)

    connect_args = {}
    if "render.com" in database_url or os.environ.get("APP_ENV") == "prod":
        connect_args["sslmode"] = "require"

    engine = create_engine(database_url, connect_args=connect_args)

    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not sql_files:
        print("No migration files found — nothing to do")
        return

    for path in sql_files:
        print(f"  applying {path.name} ...", end=" ", flush=True)
        sql = path.read_text()
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            print("OK")
        except Exception as exc:
            print(f"FAILED\nERROR in {path.name}: {exc}", file=sys.stderr)
            sys.exit(1)

    print(f"migrations done ({len(sql_files)} files)")


if __name__ == "__main__":
    run()
