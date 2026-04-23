from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def interval(days: int, *, sqlite: bool, column: str = "created_at") -> str:
    if sqlite:
        return f"{column} >= datetime('now', '-{days} days')"
    return f"{column} >= NOW() - INTERVAL '{days} days'"


def trunc_day(*, sqlite: bool, col: str = "created_at") -> str:
    if sqlite:
        return f"DATE({col})"
    return f"DATE_TRUNC('day', {col})"


def scalar(session: Session, sql: str, params: dict | None = None) -> Any:
    row = session.execute(text(sql), params or {}).fetchone()
    return row[0] if row else 0


def rows(session: Session, sql: str, params: dict | None = None) -> list[dict]:
    result = session.execute(text(sql), params or {})
    keys = list(result.keys())
    return [dict(zip(keys, row)) for row in result.fetchall()]


def serialize(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def serialize_rows(raw_rows: list[dict]) -> list[dict]:
    return [{k: serialize(v) for k, v in row.items()} for row in raw_rows]
