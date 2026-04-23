#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DB_FILE = ROOT / "apps" / "api" / "app" / "core" / "db.py"
MIGRATIONS = ROOT / "infra" / "db" / "migrations"


def main() -> int:
    db_src = DB_FILE.read_text(encoding="utf-8")

    # Runtime PostgreSQL DDL must live in migration SQL, not in app bootstrap.
    forbidden_markers = [
        "information_schema.columns",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS",
        "DO $$",
    ]
    found = [m for m in forbidden_markers if m in db_src]
    if found:
        print(f"FAIL: found runtime PostgreSQL DDL markers in db.py: {', '.join(found)}")
        return 1

    sql_files = sorted(MIGRATIONS.glob("*.sql"))
    if not sql_files:
        print("FAIL: no SQL migrations found")
        return 1

    latest = sql_files[-1].name
    if not re.match(r"^\d{4}_.+\.sql$", latest):
        print(f"FAIL: invalid latest migration filename: {latest}")
        return 1

    expected_markers = [
        "webhook_events",
        "max_paid_topup_credits",
    ]
    migration_texts = [path.read_text(encoding="utf-8") for path in sql_files]
    missing = [m for m in expected_markers if not any(m in sql for sql in migration_texts)]
    if missing:
        print(f"FAIL: migration set missing required markers: {', '.join(missing)}")
        return 1

    print(f"OK: migration sync check passed (latest: {latest})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
