from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Generator
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    create_engine,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.settings import settings

_is_sqlite = settings.database_url.startswith("sqlite")


def _make_engine(url: str):
    if url.startswith("sqlite"):
        from sqlalchemy.pool import StaticPool
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={"sslmode": "require"} if "render.com" in url else {},
    )


# Primary engine — used by get_session() (user requests, app_api role when configured).
engine = _make_engine(settings.database_url)

# System engine — used by get_system_session() (workers, admin, system paths).
# Falls back to the primary engine when WORKER_DATABASE_URL is not set.
_app_url = settings.app_database_url or settings.database_url
_system_url = settings.worker_database_url or settings.database_url
if _app_url != settings.database_url:
    engine = _make_engine(_app_url)
_system_engine = _make_engine(_system_url) if _system_url != _app_url else engine

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)
_SystemSessionLocal = sessionmaker(bind=_system_engine, autocommit=False, autoflush=False, expire_on_commit=False)

# Per-async-task UUID for automatic RLS propagation.
# Set by activate_rls(); read by get_session() to enforce RLS on every new transaction.
_rls_uuid_var: ContextVar[UUID | None] = ContextVar("rls_uuid", default=None)


def activate_rls(user_uuid: UUID | None) -> None:
    """Record the current user UUID in async context so all subsequent sessions enforce RLS."""
    _rls_uuid_var.set(user_uuid)


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True)
    # Non-PK UUID used for RLS enforcement (app.current_user_id = this value).
    # Nullable until 0005 migration backfills existing rows.
    id = Column(Uuid(as_uuid=True), unique=True, nullable=True, default=uuid4)
    first_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    paid_credits = Column(Integer, default=0, nullable=False)
    max_paid_topup_credits = Column(Integer, default=0, nullable=False)
    lifecycle_state = Column(String, nullable=False, default="S0")
    lifecycle_state_updated_at = Column(DateTime(timezone=True), nullable=True)
    bot_started_at = Column(DateTime(timezone=True), nullable=True)
    first_miniapp_opened_at = Column(DateTime(timezone=True), nullable=True)
    last_miniapp_opened_at = Column(DateTime(timezone=True), nullable=True)
    last_success_generation_at = Column(DateTime(timezone=True), nullable=True)
    last_payment_at = Column(DateTime(timezone=True), nullable=True)
    zero_balance_since = Column(DateTime(timezone=True), nullable=True)
    lifecycle_locked = Column(Boolean, nullable=False, default=False)
    lifecycle_lock_reason = Column(Text, nullable=True)
    lifecycle_lock_by = Column(String, nullable=True)
    lifecycle_lock_at = Column(DateTime(timezone=True), nullable=True)
    lifecycle_last_message_state = Column(String, nullable=True)
    lifecycle_last_message_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class OrderRow(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("idx_orders_user_created", "user_id", "created_at"),
        Index("idx_orders_user_status", "user_id", "status"),
        Index("idx_orders_status", "status"),
    )

    order_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    style_code = Column(String, nullable=False)
    source_key = Column(String, nullable=False)
    model_id = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    aspect_ratio = Column(String, nullable=False)
    status = Column(String, nullable=False, default="draft")
    credit_cost = Column(Integer, nullable=False, default=10)
    result_url = Column(Text, nullable=True)
    fail_reason_code = Column(String, nullable=True)
    is_favorite = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class JobRow(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("idx_jobs_status", "status"),
    )

    job_id = Column(String, primary_key=True)
    order_id = Column(String, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String, nullable=False)
    status = Column(String, nullable=False, default="queued")
    provider_task_id = Column(String, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class PaymentRow(Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index("idx_payments_user", "user_id"),
        Index("idx_payments_user_created", "user_id", "created_at"),
    )

    payment_id = Column(String, primary_key=True)
    provider = Column(String, nullable=False)
    status = Column(String, nullable=False)
    package_code = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    amount = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False)


class LifecycleTransitionRow(Base):
    __tablename__ = "lifecycle_transitions"
    __table_args__ = (
        Index("idx_lifecycle_transitions_user_created", "user_id", "created_at"),
        Index("idx_lifecycle_transitions_created", "created_at"),
    )

    transition_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    from_state = Column(String, nullable=True)
    to_state = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    source = Column(String, nullable=False, default="system")
    actor = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class LifecycleAdminActionRow(Base):
    __tablename__ = "lifecycle_admin_actions"
    __table_args__ = (
        Index("idx_lifecycle_admin_actions_user_created", "user_id", "created_at"),
        Index("idx_lifecycle_admin_actions_created", "created_at"),
    )

    action_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    action_type = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    from_state = Column(String, nullable=True)
    to_state = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class AppMetaRow(Base):
    __tablename__ = "app_meta"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False, default="")
    updated_at = Column(DateTime(timezone=True), nullable=False)


class MediaAssetRow(Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        Index("idx_media_assets_expires_at", "expires_at"),
        Index("idx_media_assets_order_id", "order_id"),
        UniqueConstraint("storage_key", name="uq_media_assets_storage_key"),
    )

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(String, ForeignKey("orders.order_id", ondelete="SET NULL"), nullable=True)
    kind = Column(String, nullable=False)   # "source" | "result"
    storage_bucket = Column(String, nullable=False)
    storage_key = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class WebhookEventRow(Base):
    __tablename__ = "webhook_events"
    __table_args__ = (
        UniqueConstraint("provider", "event_id", name="uq_webhook_events_provider_event"),
        Index("idx_webhook_events_created", "created_at"),
        Index("idx_webhook_events_order_id", "order_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider = Column(String, nullable=False)
    event_id = Column(String, nullable=False)
    event_type = Column(String, nullable=True)
    order_id = Column(String, nullable=True)
    payment_id = Column(String, nullable=True)
    payload_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


def init_db() -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)
    # Runtime DDL is allowed only for local SQLite bootstrap.
    # PostgreSQL schema changes must go through infra/db/migrations/*.sql
    if _is_sqlite and settings.env in {"dev", "test", "local"}:
        _run_sqlite_bootstrap()


def _run_sqlite_bootstrap() -> None:
    """Apply additive SQLite-only bootstrap migrations for local/dev databases."""
    with engine.connect() as conn:
        # SQLite: check pragma, add if missing
        order_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(orders)"))}
        user_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        if "is_favorite" not in order_cols:
            conn.execute(text(
                "ALTER TABLE orders ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0"
            ))
        if "first_name" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN first_name TEXT"))
        if "username" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN username TEXT"))
        if "max_paid_topup_credits" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN max_paid_topup_credits INTEGER NOT NULL DEFAULT 0"))
        if "lifecycle_state" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'S0'"))
        if "lifecycle_state_updated_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_state_updated_at TEXT"))
        if "bot_started_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN bot_started_at TEXT"))
        if "first_miniapp_opened_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN first_miniapp_opened_at TEXT"))
        if "last_miniapp_opened_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_miniapp_opened_at TEXT"))
        if "last_success_generation_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_success_generation_at TEXT"))
        if "last_payment_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_payment_at TEXT"))
        if "zero_balance_since" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN zero_balance_since TEXT"))
        if "lifecycle_locked" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_locked BOOLEAN NOT NULL DEFAULT 0"))
        if "lifecycle_lock_reason" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_lock_reason TEXT"))
        if "lifecycle_lock_by" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_lock_by TEXT"))
        if "lifecycle_lock_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_lock_at TEXT"))
        if "lifecycle_last_message_state" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_last_message_state TEXT"))
        if "lifecycle_last_message_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lifecycle_last_message_at TEXT"))
        if "id" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN id TEXT"))
            conn.execute(text(
                "UPDATE users SET id = lower(hex(randomblob(4))) || '-' "
                "|| lower(hex(randomblob(2))) || '-4' "
                "|| substr(lower(hex(randomblob(2))),2) || '-' "
                "|| substr('89ab', abs(random()) % 4 + 1, 1) "
                "|| substr(lower(hex(randomblob(2))),2) || '-' "
                "|| lower(hex(randomblob(6))) "
                "WHERE id IS NULL"
            ))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid ON users(id)"
            ))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS lifecycle_transitions (
                transition_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                from_state TEXT,
                to_state TEXT NOT NULL,
                reason TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'system',
                actor TEXT,
                metadata_json TEXT,
                created_at TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_user_created
            ON lifecycle_transitions(user_id, created_at)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_lifecycle_transitions_created
            ON lifecycle_transitions(created_at)
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS lifecycle_admin_actions (
                action_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                actor TEXT NOT NULL,
                reason TEXT NOT NULL,
                from_state TEXT,
                to_state TEXT,
                metadata_json TEXT,
                created_at TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_lifecycle_admin_actions_user_created
            ON lifecycle_admin_actions(user_id, created_at)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_lifecycle_admin_actions_created
            ON lifecycle_admin_actions(created_at)
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS media_assets (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                order_id TEXT,
                kind TEXT NOT NULL,
                storage_bucket TEXT NOT NULL,
                storage_key TEXT NOT NULL,
                expires_at TEXT,
                created_at TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_media_assets_expires_at
            ON media_assets(expires_at)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_media_assets_order_id
            ON media_assets(order_id)
        """))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_media_assets_storage_key
            ON media_assets(storage_key)
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS webhook_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                event_id TEXT NOT NULL,
                event_type TEXT,
                order_id TEXT,
                payment_id TEXT,
                payload_hash TEXT,
                created_at TEXT NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_event
            ON webhook_events(provider, event_id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_webhook_events_created
            ON webhook_events(created_at)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id
            ON webhook_events(order_id)
        """))
        conn.execute(text(
            "UPDATE users SET lifecycle_state = 'S5' "
            "WHERE lifecycle_state IN ('S6', 'INACTIVE_30D')"
        ))
        conn.commit()


def set_rls_context(db: Session, user_uuid) -> None:
    """Activate per-transaction RLS enforcement for the given user UUID.

    Also records the UUID in the async-task ContextVar so that all
    subsequent get_session() calls in the same request/task automatically
    enforce RLS without needing another explicit call.

    No-op on SQLite. No-op if user_uuid is None.
    """
    if _is_sqlite or user_uuid is None:
        return
    activate_rls(user_uuid)
    db.execute(
        text("SELECT set_config('app.current_user_id', :uuid, true)"),
        {"uuid": str(user_uuid)},
    )
    db.execute(text("SELECT set_config('app.rls_mode', 'enforce', true)"))


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """User-context session: enforces RLS when a UUID is set via activate_rls().

    If no UUID is in the ContextVar the session runs in the DB default mode
    ('system' after migration 0007), correct for paths that run before user
    identity is established (e.g. get_or_create_user).
    """
    session = SessionLocal()
    try:
        uuid = _rls_uuid_var.get()
        if uuid is not None and not _is_sqlite:
            session.execute(
                text("SELECT set_config('app.current_user_id', :uuid, true)"),
                {"uuid": str(uuid)},
            )
            session.execute(text("SELECT set_config('app.rls_mode', 'enforce', true)"))
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_system_session() -> Generator[Session, None, None]:
    """System-context session: explicitly sets app.rls_mode = 'system'.

    Uses the system engine (WORKER_DATABASE_URL / app_worker role when configured).
    Use for workers, admin routes, startup hooks, and any path that legitimately
    accesses rows across multiple users. Never use inside user-facing request handlers.
    """
    session = _SystemSessionLocal()
    try:
        if not _is_sqlite:
            session.execute(text("SELECT set_config('app.rls_mode', 'system', true)"))
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
