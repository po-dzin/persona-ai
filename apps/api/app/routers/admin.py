"""Admin API router — internal analytics and management endpoints.

Auth: X-Admin-Token header must match ADMIN_SECRET_TOKEN env var.
All timestamps stored as TIMESTAMPTZ (PostgreSQL) or ISO strings (SQLite dev).
"""
from __future__ import annotations

import hmac
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import text

from app.core.auth import parse_tg_user
from app.core.db import get_session, _is_sqlite
from app.core.settings import settings

router = APIRouter(prefix="/admin/api", tags=["admin"])


# ─────────────────────────── auth ────────────────────────────────


def require_admin(
    x_telegram_init_data: str = Header(default=""),
    x_admin_token: str = Header(default=""),
) -> None:
    """
    Two ways to authenticate:
    1. X-Telegram-Init-Data — user must be in ADMIN_USER_IDS
    2. X-Admin-Token — static token fallback (for scripts / curl)
    """
    # Try TG init data first
    if x_telegram_init_data.strip():
        user = parse_tg_user(x_telegram_init_data.strip())
        if user and str(user.get("id", "")) in settings.admin_user_ids:
            return
        raise HTTPException(status_code=403, detail="not_admin")

    # Fallback: static token (for scripts/curl)
    if x_admin_token.strip() and settings.admin_secret_token:
        if hmac.compare_digest(x_admin_token.strip(), settings.admin_secret_token):
            return

    raise HTTPException(status_code=401, detail="unauthorized")


# ─────────────────────── SQL helpers ─────────────────────────────


def _interval(days: int) -> str:
    """SQL fragment: created_at >= <now - N days>"""
    if _is_sqlite:
        return f"created_at >= datetime('now', '-{days} days')"
    return f"created_at >= NOW() - INTERVAL '{days} days'"


def _trunc_day(col: str = "created_at") -> str:
    """SQL fragment: truncate timestamp to day for grouping."""
    if _is_sqlite:
        return f"DATE({col})"
    return f"DATE_TRUNC('day', {col})"


def _scalar(session, sql: str, params: dict | None = None) -> Any:
    row = session.execute(text(sql), params or {}).fetchone()
    return row[0] if row else 0


def _rows(session, sql: str, params: dict | None = None) -> list[dict]:
    result = session.execute(text(sql), params or {})
    keys = list(result.keys())
    return [dict(zip(keys, row)) for row in result.fetchall()]


def _serialize(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def _serialize_rows(rows: list[dict]) -> list[dict]:
    return [{k: _serialize(v) for k, v in row.items()} for row in rows]


# ─────────────────────────── endpoints ───────────────────────────


@router.get("/overview", dependencies=[Depends(require_admin)])
def overview(days: int = Query(default=7, ge=1, le=90)):
    """
    Dashboard overview: user counts, generation counts, revenue, queue depth.
    `days` controls the primary comparison period (1 / 7 / 30).
    Always returns today + period + alltime.
    """
    with get_session() as session:
        total_users = _scalar(session, "SELECT COUNT(*) FROM users")
        paying_users = _scalar(
            session,
            "SELECT COUNT(DISTINCT user_id) FROM payments WHERE status = 'paid'",
        )
        conversion_pct = round(paying_users / total_users * 100, 1) if total_users else 0

        users_today = _scalar(session, f"SELECT COUNT(*) FROM users WHERE {_interval(1)}")
        users_period = _scalar(session, f"SELECT COUNT(*) FROM users WHERE {_interval(days)}")

        dau = _scalar(
            session,
            f"SELECT COUNT(DISTINCT user_id) FROM orders WHERE {_interval(1)}",
        )

        # Generations by period
        def gen_counts(d: int) -> dict:
            sql = f"""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'done') as done,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    COUNT(*) as total
                FROM orders WHERE {_interval(d)}
            """ if not _is_sqlite else f"""
                SELECT
                    SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
                    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
                    COUNT(*) as total
                FROM orders WHERE {_interval(d)}
            """
            row = session.execute(text(sql)).fetchone()
            return {"done": row[0] or 0, "failed": row[1] or 0, "total": row[2] or 0}

        gen_today = gen_counts(1)
        gen_period = gen_counts(days)
        gen_alltime_done = _scalar(session, "SELECT COUNT(*) FROM orders WHERE status='done'")
        gen_alltime_total = _scalar(session, "SELECT COUNT(*) FROM orders")

        error_rate = (
            round(gen_period["failed"] / gen_period["total"] * 100, 1)
            if gen_period["total"] else 0
        )

        # Revenue (Telegram Stars)
        rev_today = _scalar(
            session,
            f"SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='paid' AND {_interval(1)}",
        )
        rev_period = _scalar(
            session,
            f"SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='paid' AND {_interval(days)}",
        )
        rev_alltime = _scalar(
            session,
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='paid'",
        )
        arppu = round(rev_alltime / paying_users, 1) if paying_users else 0

        # Queue depth (orders in flight)
        queue_rows = _rows(
            session,
            "SELECT status, COUNT(*) as cnt FROM orders WHERE status IN ('processing', 'awaiting_credit_or_payment') GROUP BY status",
        )
        queue: dict[str, int] = {r["status"]: r["cnt"] for r in queue_rows}

        # Jobs queue
        job_queue_rows = _rows(
            session,
            "SELECT status, COUNT(*) as cnt FROM jobs WHERE status IN ('queued', 'submitted', 'processing') GROUP BY status",
        )
        job_queue: dict[str, int] = {r["status"]: r["cnt"] for r in job_queue_rows}

    return {
        "period_days": days,
        "users": {
            "total": total_users,
            "paying": paying_users,
            "conversion_pct": conversion_pct,
            "new_today": users_today,
            "new_period": users_period,
            "dau": dau,
        },
        "generations": {
            "today": gen_today,
            "period": gen_period,
            "alltime_done": gen_alltime_done,
            "alltime_total": gen_alltime_total,
            "error_rate_pct": error_rate,
        },
        "revenue": {
            "today_stars": rev_today,
            "period_stars": rev_period,
            "alltime_stars": rev_alltime,
            "arppu_stars": arppu,
        },
        "queue": {
            "orders": queue,
            "jobs": job_queue,
        },
    }


@router.get("/timeseries", dependencies=[Depends(require_admin)])
def timeseries(days: int = Query(default=30, ge=7, le=90)):
    """Daily breakdown for charts: users, generations, revenue."""
    with get_session() as session:
        users_sql = f"""
            SELECT {_trunc_day()} as day, COUNT(*) as new_users
            FROM users WHERE {_interval(days)}
            GROUP BY {_trunc_day()} ORDER BY day
        """
        orders_sql = f"""
            SELECT
                {_trunc_day()} as day,
                COUNT(*) as total,
                {'COUNT(*) FILTER (WHERE status=\'done\')' if not _is_sqlite else 'SUM(CASE WHEN status=\'done\' THEN 1 ELSE 0 END)'} as done,
                {'COUNT(*) FILTER (WHERE status=\'failed\')' if not _is_sqlite else 'SUM(CASE WHEN status=\'failed\' THEN 1 ELSE 0 END)'} as failed
            FROM orders WHERE {_interval(days)}
            GROUP BY {_trunc_day()} ORDER BY day
        """
        revenue_sql = f"""
            SELECT {_trunc_day()} as day, COALESCE(SUM(amount), 0) as stars
            FROM payments WHERE status='paid' AND {_interval(days)}
            GROUP BY {_trunc_day()} ORDER BY day
        """

        users_data = _serialize_rows(_rows(session, users_sql))
        orders_data = _serialize_rows(_rows(session, orders_sql))
        revenue_data = _serialize_rows(_rows(session, revenue_sql))

    return {
        "days": days,
        "users": users_data,
        "orders": orders_data,
        "revenue": revenue_data,
    }


@router.get("/revenue", dependencies=[Depends(require_admin)])
def revenue(days: int = Query(default=30, ge=1, le=365)):
    """Revenue breakdown: by package, recent payments, totals."""
    with get_session() as session:
        # By package
        by_package = _serialize_rows(_rows(
            session,
            f"""
            SELECT package_code, COUNT(*) as payments_count,
                   COALESCE(SUM(amount), 0) as total_stars,
                   COUNT(DISTINCT user_id) as unique_buyers
            FROM payments WHERE status='paid' AND {_interval(days)}
            GROUP BY package_code ORDER BY total_stars DESC
            """,
        ))

        # Recent payments
        recent = _serialize_rows(_rows(
            session,
            """
            SELECT p.payment_id, p.user_id, u.username, u.first_name,
                   p.package_code, p.amount, p.status, p.provider, p.created_at
            FROM payments p
            LEFT JOIN users u ON u.user_id = p.user_id
            WHERE p.status = 'paid'
            ORDER BY p.created_at DESC LIMIT 50
            """,
        ))

        # Totals
        total_stars = _scalar(
            session,
            f"SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='paid' AND {_interval(days)}",
        )
        total_payments = _scalar(
            session,
            f"SELECT COUNT(*) FROM payments WHERE status='paid' AND {_interval(days)}",
        )
        paying_users = _scalar(
            session,
            f"SELECT COUNT(DISTINCT user_id) FROM payments WHERE status='paid' AND {_interval(days)}",
        )
        arppu = round(total_stars / paying_users, 1) if paying_users else 0

        refunded = _scalar(
            session,
            f"SELECT COUNT(*) FROM payments WHERE status='refunded' AND {_interval(days)}",
        )

    return {
        "period_days": days,
        "totals": {
            "stars": total_stars,
            "payments": total_payments,
            "paying_users": paying_users,
            "arppu_stars": arppu,
            "refunded": refunded,
        },
        "by_package": by_package,
        "recent": recent,
    }


@router.get("/generations", dependencies=[Depends(require_admin)])
def generations(days: int = Query(default=7, ge=1, le=90)):
    """Generation stats: by status, by style, by model, recent failures."""
    with get_session() as session:
        # By status
        by_status = {
            r["status"]: r["cnt"]
            for r in _rows(
                session,
                f"SELECT status, COUNT(*) as cnt FROM orders WHERE {_interval(days)} GROUP BY status",
            )
        }

        # Top styles
        top_styles = _serialize_rows(_rows(
            session,
            f"""
            SELECT style_code, COUNT(*) as count,
                   {'COUNT(*) FILTER (WHERE status=\'done\')' if not _is_sqlite else 'SUM(CASE WHEN status=\'done\' THEN 1 ELSE 0 END)'} as done
            FROM orders WHERE {_interval(days)}
            GROUP BY style_code ORDER BY count DESC LIMIT 15
            """,
        ))

        # By model
        by_model = _serialize_rows(_rows(
            session,
            f"""
            SELECT model_id,
                   COUNT(*) as total,
                   {'COUNT(*) FILTER (WHERE status=\'done\')' if not _is_sqlite else 'SUM(CASE WHEN status=\'done\' THEN 1 ELSE 0 END)'} as done,
                   {'COUNT(*) FILTER (WHERE status=\'failed\')' if not _is_sqlite else 'SUM(CASE WHEN status=\'failed\' THEN 1 ELSE 0 END)'} as failed,
                   ROUND(AVG(credit_cost), 1) as avg_cost
            FROM orders WHERE {_interval(days)}
            GROUP BY model_id ORDER BY total DESC
            """,
        ))

        # Recent failures
        recent_failed = _serialize_rows(_rows(
            session,
            """
            SELECT o.order_id, o.user_id, o.model_id, o.style_code,
                   o.fail_reason_code, o.created_at,
                   j.provider, j.attempts, j.status as job_status
            FROM orders o
            LEFT JOIN jobs j ON j.order_id = o.order_id
            WHERE o.status = 'failed'
            ORDER BY o.created_at DESC LIMIT 25
            """,
        ))

        # Avg generation time (from job updated_at - order created_at for done orders)
        avg_time_row = session.execute(text(f"""
            SELECT AVG(
                EXTRACT(EPOCH FROM (j.updated_at - o.created_at))
            ) as avg_seconds
            FROM orders o
            JOIN jobs j ON j.order_id = o.order_id
            WHERE o.status = 'done' AND j.status = 'done' AND {_interval(days)}
        """)).fetchone() if not _is_sqlite else None

        avg_gen_seconds = round(avg_time_row[0], 1) if avg_time_row and avg_time_row[0] else None

    return {
        "period_days": days,
        "by_status": by_status,
        "top_styles": top_styles,
        "by_model": by_model,
        "recent_failed": recent_failed,
        "avg_gen_seconds": avg_gen_seconds,
    }


@router.get("/users", dependencies=[Depends(require_admin)])
def users_list(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=10, le=200),
    search: str = Query(default=""),
    filter: str = Query(default=""),  # "paying" | "active" | ""
):
    """Paginated user list with search and filters."""
    offset = (page - 1) * limit

    where_clauses = []
    params: dict = {"limit": limit, "offset": offset}

    if search:
        if _is_sqlite:
            where_clauses.append(
                "(u.user_id LIKE :search OR u.username LIKE :search OR u.first_name LIKE :search)"
            )
            params["search"] = f"%{search}%"
        else:
            where_clauses.append(
                "(u.user_id ILIKE :search OR u.username ILIKE :search OR u.first_name ILIKE :search)"
            )
            params["search"] = f"%{search}%"

    having_clause = ""
    if filter == "paying":
        having_clause = "HAVING COALESCE(SUM(p.amount) FILTER (WHERE p.status='paid'), 0) > 0" if not _is_sqlite else \
                        "HAVING COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END), 0) > 0"
    elif filter == "active":
        where_clauses.append(f"({_interval(7).replace('created_at', 'o.created_at')})")

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
        SELECT
            u.user_id, u.first_name, u.username,
            u.paid_credits, u.created_at,
            COUNT(DISTINCT o.order_id) FILTER (WHERE o.status = 'done') as gens_done,
            COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END), 0) as total_stars
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.user_id
        LEFT JOIN payments p ON p.user_id = u.user_id
        {where_sql}
        GROUP BY u.user_id, u.first_name, u.username, u.paid_credits, u.created_at
        {having_clause}
        ORDER BY u.created_at DESC
        LIMIT :limit OFFSET :offset
    """ if not _is_sqlite else f"""
        SELECT
            u.user_id, u.first_name, u.username,
            u.paid_credits, u.created_at,
            SUM(CASE WHEN o.status='done' THEN 1 ELSE 0 END) as gens_done,
            COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END), 0) as total_stars
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.user_id
        LEFT JOIN payments p ON p.user_id = u.user_id
        {where_sql}
        GROUP BY u.user_id, u.first_name, u.username, u.paid_credits, u.created_at
        {having_clause}
        ORDER BY u.created_at DESC
        LIMIT :limit OFFSET :offset
    """

    # Wrap in a subquery so HAVING (for "paying" filter) is respected by COUNT
    inner_sql = f"""
        SELECT u.user_id
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.user_id
        LEFT JOIN payments p ON p.user_id = u.user_id
        {where_sql}
        GROUP BY u.user_id
        {having_clause}
    """
    count_sql = f"SELECT COUNT(*) FROM ({inner_sql}) AS _sub"

    with get_session() as session:
        rows = _serialize_rows(_rows(session, sql, params))
        total = _scalar(session, count_sql, {k: v for k, v in params.items() if k not in ("limit", "offset")})

    return {
        "users": rows,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total else 1,
    }


@router.get("/users/{user_id}", dependencies=[Depends(require_admin)])
def user_detail(user_id: str):
    """Full user profile: balance, orders history, payments history."""
    with get_session() as session:
        result = session.execute(
            text("SELECT * FROM users WHERE user_id = :uid"), {"uid": user_id}
        )
        user_row = result.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="user_not_found")

        user = {k: _serialize(v) for k, v in dict(zip(list(result.keys()), user_row)).items()}

        orders = _serialize_rows(_rows(
            session,
            "SELECT order_id, style_code, model_id, status, credit_cost, result_url, fail_reason_code, created_at, updated_at FROM orders WHERE user_id = :uid ORDER BY created_at DESC LIMIT 30",
            {"uid": user_id},
        ))

        payments = _serialize_rows(_rows(
            session,
            "SELECT payment_id, package_code, amount, provider, status, created_at FROM payments WHERE user_id = :uid ORDER BY created_at DESC LIMIT 20",
            {"uid": user_id},
        ))

        stats_row = session.execute(text("""
            SELECT
                COUNT(*) as total_orders,
                SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_orders,
                SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed_orders,
                COALESCE(SUM(CASE WHEN status='done' THEN credit_cost ELSE 0 END), 0) as coins_spent
            FROM orders WHERE user_id = :uid
        """), {"uid": user_id}).fetchone()

        pay_total = _scalar(
            session,
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE user_id = :uid AND status='paid'",
            {"uid": user_id},
        )

    return {
        "user": user,
        "stats": {
            "total_orders": stats_row[0] or 0,
            "done_orders": stats_row[1] or 0,
            "failed_orders": stats_row[2] or 0,
            "coins_spent": stats_row[3] or 0,
            "total_stars_paid": pay_total,
        },
        "orders": orders,
        "payments": payments,
    }
