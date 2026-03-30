"""
Cleanup stuck orders that are permanently in processing/queued state.

Run locally (needs DATABASE_URL in env or .env):
    DATABASE_URL=postgres://... python scripts/cleanup_stuck_orders.py

Run on Render via Shell tab:
    python scripts/cleanup_stuck_orders.py

By default marks all orders older than 10 minutes stuck in processing/queued as failed.
Pass --dry-run to preview without making changes.
"""

import argparse
import os
import sys
from datetime import datetime, timezone, timedelta

def main() -> None:
    parser = argparse.ArgumentParser(description="Reset stuck orders to failed")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be changed, do nothing")
    parser.add_argument("--minutes", type=int, default=10, help="Age threshold in minutes (default: 10)")
    parser.add_argument("--user-id", help="Only reset orders for this user_id")
    args = parser.parse_args()

    # Load DATABASE_URL from env or .env file
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
        if os.path.exists(env_file):
            for line in open(env_file):
                if line.startswith("DATABASE_URL="):
                    database_url = line.strip().split("=", 1)[1].strip('"').strip("'")
    if not database_url:
        print("ERROR: DATABASE_URL not set. Export it or put it in .env", file=sys.stderr)
        sys.exit(1)

    # psycopg2 needs postgresql://, not postgres://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    try:
        import psycopg2
    except ImportError:
        # Fall back to sqlalchemy which is already a dependency
        from sqlalchemy import create_engine, text
        engine = create_engine(database_url)
        _run_sqlalchemy(engine, args)
        return

    conn = psycopg2.connect(database_url)
    _run_psycopg2(conn, args)
    conn.close()


def _run_sqlalchemy(engine, args) -> None:
    from sqlalchemy import text
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.minutes)

    with engine.connect() as conn:
        # Find stuck orders
        query = """
            SELECT order_id, user_id, status, created_at
            FROM orders
            WHERE status IN ('processing', 'queued')
              AND created_at < :cutoff
        """
        params: dict = {"cutoff": cutoff}
        if args.user_id:
            query += " AND user_id = :user_id"
            params["user_id"] = args.user_id
        query += " ORDER BY created_at DESC"

        rows = conn.execute(text(query), params).fetchall()

        if not rows:
            print("No stuck orders found.")
            return

        print(f"Found {len(rows)} stuck order(s):")
        for r in rows:
            print(f"  {r[0]}  user={r[1]}  status={r[2]}  created={r[3]}")

        if args.dry_run:
            print("\n[dry-run] No changes made.")
            return

        # Reset orders
        conn.execute(text("""
            UPDATE orders
            SET status = 'failed', fail_reason_code = 'technical_failed'
            WHERE status IN ('processing', 'queued')
              AND created_at < :cutoff
              {user_filter}
        """.format(user_filter="AND user_id = :user_id" if args.user_id else "")), params)

        # Reset related jobs
        order_ids = [r[0] for r in rows]
        placeholders = ", ".join(f"'{oid}'" for oid in order_ids)
        conn.execute(text(f"""
            UPDATE jobs SET status = 'failed'
            WHERE order_id IN ({placeholders})
              AND status IN ('processing', 'queued')
        """))

        conn.commit()
        print(f"\nDone — reset {len(rows)} order(s) to failed (technical_failed).")


def _run_psycopg2(conn, args) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.minutes)
    cur = conn.cursor()

    query = """
        SELECT order_id, user_id, status, created_at
        FROM orders
        WHERE status IN ('processing', 'queued')
          AND created_at < %s
    """
    params: list = [cutoff]
    if args.user_id:
        query += " AND user_id = %s"
        params.append(args.user_id)
    query += " ORDER BY created_at DESC"

    cur.execute(query, params)
    rows = cur.fetchall()

    if not rows:
        print("No stuck orders found.")
        cur.close()
        return

    print(f"Found {len(rows)} stuck order(s):")
    for r in rows:
        print(f"  {r[0]}  user={r[1]}  status={r[2]}  created={r[3]}")

    if args.dry_run:
        print("\n[dry-run] No changes made.")
        cur.close()
        return

    order_ids = [r[0] for r in rows]

    update_q = """
        UPDATE orders
        SET status = 'failed', fail_reason_code = 'technical_failed'
        WHERE status IN ('processing', 'queued')
          AND created_at < %s
    """
    update_params: list = [cutoff]
    if args.user_id:
        update_q += " AND user_id = %s"
        update_params.append(args.user_id)
    cur.execute(update_q, update_params)

    placeholders = ",".join(["%s"] * len(order_ids))
    cur.execute(f"""
        UPDATE jobs SET status = 'failed'
        WHERE order_id IN ({placeholders})
          AND status IN ('processing', 'queued')
    """, order_ids)

    conn.commit()
    print(f"\nDone — reset {len(rows)} order(s) to failed (technical_failed).")
    cur.close()


if __name__ == "__main__":
    main()
