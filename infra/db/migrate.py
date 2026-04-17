"""
Run all SQL migrations in infra/db/migrations/ in filename order.

All migration files are idempotent (IF NOT EXISTS / OR REPLACE / DO $$ IF NOT EXISTS $$),
so re-running is always safe.

Schema ownership:
  The ORM (app.core.db.init_db / Base.metadata.create_all) is the source of truth for
  the current production schema.  SQL migration files handle PostgreSQL-specific DDL that
  the ORM can't express: RLS functions/policies, extra indexes, seeds, etc.

  0001_schema.sql is an aspirational "clean-slate" schema for a future UUID-PK migration.
  It conflicts with the current ORM schema (TEXT user_id PK vs UUID id PK) and must NOT
  be executed against a database that is already managed by the ORM.  It is skipped here
  and kept only as documentation.

Usage:
    python infra/db/migrate.py
    DATABASE_URL=postgres://... python infra/db/migrate.py
"""
from __future__ import annotations

import os
import pathlib
import sys

MIGRATIONS_DIR = pathlib.Path(__file__).parent / "migrations"

# These files define a future schema that conflicts with the current ORM schema.
# The ORM (init_db / create_all) is the source of truth — skip them here.
_ORM_MANAGED_SCHEMA_FILES: frozenset[str] = frozenset({"0001_schema.sql"})


def _init_orm_schema() -> None:
    """Bootstrap the ORM-managed schema before running SQL migrations.

    SQL migrations (RLS policies, indexes, seeds) assume the ORM schema already
    exists.  We add apps/api to sys.path so this script can be run standalone
    from the repo root (e.g. in CI, Render preDeployCommand).
    """
    api_dir = pathlib.Path(__file__).resolve().parent.parent.parent / "apps" / "api"
    if str(api_dir) not in sys.path:
        sys.path.insert(0, str(api_dir))

    try:
        from app.core.db import init_db  # type: ignore[import]
        init_db()
        print("  ORM schema: OK (init_db)")
    except Exception as exc:  # noqa: BLE001
        # Non-fatal: if the ORM can't be imported (missing deps, bad env) we
        # continue and let the SQL files fail with a clear Postgres error.
        print(f"  ORM schema: skipped ({exc})", file=sys.stderr)


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
        from sqlalchemy import create_engine
    except ImportError:
        print("ERROR: sqlalchemy not installed", file=sys.stderr)
        sys.exit(1)

    connect_args = {}
    if "render.com" in database_url or os.environ.get("APP_ENV") == "prod":
        connect_args["sslmode"] = "require"

    # Ensure ORM tables exist before running SQL migrations that reference them.
    _init_orm_schema()

    engine = create_engine(database_url, connect_args=connect_args)

    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not sql_files:
        print("No migration files found — nothing to do")
        return

    applied = 0
    for path in sql_files:
        if path.name in _ORM_MANAGED_SCHEMA_FILES:
            print(f"  skipping {path.name} (ORM-managed schema)")
            continue

        print(f"  applying {path.name} ...", end=" ", flush=True)
        sql = path.read_text()
        # SQLAlchemy text() only supports a single statement per execute() call.
        # Migration files contain many DDL statements + DO $$ blocks, so we use
        # engine.raw_connection() to get the underlying psycopg2 connection which
        # passes the full SQL string to PostgreSQL's simple-query protocol directly.
        raw_conn = engine.raw_connection()
        try:
            cursor = raw_conn.cursor()
            cursor.execute(sql)
            raw_conn.commit()
            cursor.close()
            print("OK")
            applied += 1
        except Exception as exc:
            raw_conn.rollback()
            print(f"FAILED\nERROR in {path.name}: {exc}", file=sys.stderr)
            sys.exit(1)
        finally:
            raw_conn.close()  # returns connection to pool

    print(f"migrations done ({applied} applied, {len(sql_files) - applied} skipped)")


if __name__ == "__main__":
    run()
