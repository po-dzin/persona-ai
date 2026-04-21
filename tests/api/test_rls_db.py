"""
Postgres-only RLS integration tests.

These tests prove that cross-account data access is denied at the DATABASE layer,
not just at application code level. They set app.rls_mode directly via SQL to
simulate different session identities.

Skipped automatically when DATABASE_URL points to SQLite (local/CI without PG).

Mode semantics (after migration 0007):
  'enforce'  — only rows owned by app.current_user_id are visible
  'system'   — all rows visible (workers, admin, webhooks)
  unset/''   — defaults to 'system' (see app_rls_mode() function)
"""
from __future__ import annotations

import os
import uuid

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.skipif(
    os.environ.get("DATABASE_URL", "sqlite:").startswith("sqlite"),
    reason="RLS is PostgreSQL-only",
)


@pytest.fixture()
def pg_session():
    from app.core.db import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def two_users(pg_session):
    uid_a, uid_b = str(uuid.uuid4()), str(uuid.uuid4())
    uuid_a, uuid_b = str(uuid.uuid4()), str(uuid.uuid4())

    for uid, puuid in ((uid_a, uuid_a), (uid_b, uuid_b)):
        pg_session.execute(
            text(
                "INSERT INTO users (user_id, id, paid_credits, lifecycle_state, created_at, updated_at) "
                "VALUES (:uid, :uuid::uuid, 20, 'S0', now(), now())"
            ),
            {"uid": uid, "uuid": puuid},
        )
    pg_session.commit()
    return {"user_id": uid_a, "uuid": uuid_a}, {"user_id": uid_b, "uuid": uuid_b}


def _set_enforce(session, user_uuid: str) -> None:
    session.execute(text("SELECT set_config('app.rls_mode', 'enforce', true)"))
    session.execute(
        text("SELECT set_config('app.current_user_id', :uuid, true)"),
        {"uuid": user_uuid},
    )


def _set_system(session) -> None:
    session.execute(text("SELECT set_config('app.rls_mode', 'system', true)"))
    session.execute(text("SELECT set_config('app.current_user_id', '', true)"))


def _clear_mode(session) -> None:
    """Unset rls_mode — should fall back to 'system' default per app_rls_mode()."""
    session.execute(text("SELECT set_config('app.rls_mode', '', true)"))
    session.execute(text("SELECT set_config('app.current_user_id', '', true)"))


# ── users table ──────────────────────────────────────────────────────────────

def test_rls_users_enforce_self_only(pg_session, two_users):
    """User A in enforce mode sees only their own row."""
    user_a, user_b = two_users

    _set_enforce(pg_session, user_a["uuid"])
    rows = pg_session.execute(text("SELECT user_id FROM users")).fetchall()
    assert {r[0] for r in rows} == {user_a["user_id"]}

    _set_enforce(pg_session, user_b["uuid"])
    rows = pg_session.execute(text("SELECT user_id FROM users")).fetchall()
    assert {r[0] for r in rows} == {user_b["user_id"]}


def test_rls_users_system_sees_all(pg_session, two_users):
    """System mode sees all users."""
    user_a, user_b = two_users

    _set_system(pg_session)
    rows = pg_session.execute(text("SELECT user_id FROM users")).fetchall()
    ids = {r[0] for r in rows}
    assert user_a["user_id"] in ids
    assert user_b["user_id"] in ids


def test_rls_users_default_sees_all(pg_session, two_users):
    """Unset mode falls back to 'system' — all rows visible."""
    user_a, user_b = two_users

    _clear_mode(pg_session)
    rows = pg_session.execute(text("SELECT user_id FROM users")).fetchall()
    ids = {r[0] for r in rows}
    assert user_a["user_id"] in ids
    assert user_b["user_id"] in ids


# ── orders table ─────────────────────────────────────────────────────────────

@pytest.fixture()
def two_orders(pg_session, two_users):
    user_a, user_b = two_users
    oid_a, oid_b = str(uuid.uuid4()), str(uuid.uuid4())

    for uid, oid in ((user_a["user_id"], oid_a), (user_b["user_id"], oid_b)):
        pg_session.execute(
            text(
                "INSERT INTO orders "
                "(order_id, user_id, style_code, source_key, model_id, prompt, aspect_ratio, "
                " status, credit_cost, created_at, updated_at) "
                "VALUES (:oid, :uid, 'test', 'k', 'nb2-1k', 'p', '1:1', "
                "        'draft', 1, now(), now())"
            ),
            {"oid": oid, "uid": uid},
        )
    pg_session.commit()
    return oid_a, oid_b


def test_rls_orders_cross_account_denied(pg_session, two_users, two_orders):
    """User A's enforce session cannot read User B's order."""
    user_a, _ = two_users
    _, oid_b = two_orders

    _set_enforce(pg_session, user_a["uuid"])
    row = pg_session.execute(
        text("SELECT order_id FROM orders WHERE order_id = :oid"),
        {"oid": oid_b},
    ).fetchone()
    assert row is None, "RLS should hide User B's order from User A"


def test_rls_orders_own_read_allowed(pg_session, two_users, two_orders):
    """User A can read their own order in enforce mode."""
    user_a, _ = two_users
    oid_a, _ = two_orders

    _set_enforce(pg_session, user_a["uuid"])
    row = pg_session.execute(
        text("SELECT order_id FROM orders WHERE order_id = :oid"),
        {"oid": oid_a},
    ).fetchone()
    assert row is not None


# ── activate_rls() ContextVar propagation ────────────────────────────────────

def test_activate_rls_propagates_to_new_session(two_users):
    """activate_rls() in ContextVar enforces RLS in the next get_session() call."""
    from app.core.db import activate_rls, get_session
    import uuid as _uuid

    user_a, user_b = two_users

    activate_rls(_uuid.UUID(user_a["uuid"]))
    try:
        with get_session() as db:
            rows = db.execute(text("SELECT user_id FROM users")).fetchall()
            ids = {r[0] for r in rows}
            assert ids == {user_a["user_id"]}, (
                f"Expected only {user_a['user_id']}, got {ids}"
            )
    finally:
        activate_rls(None)


def test_get_system_session_bypasses_user_uuid(two_users):
    """get_system_session() sees all rows even when user UUID is in ContextVar."""
    from app.core.db import activate_rls, get_system_session
    import uuid as _uuid

    user_a, user_b = two_users

    activate_rls(_uuid.UUID(user_a["uuid"]))
    try:
        with get_system_session() as db:
            rows = db.execute(text("SELECT user_id FROM users")).fetchall()
            ids = {r[0] for r in rows}
            assert user_a["user_id"] in ids
            assert user_b["user_id"] in ids, (
                "get_system_session() must see all users regardless of ContextVar"
            )
    finally:
        activate_rls(None)
