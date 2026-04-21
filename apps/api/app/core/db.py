from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Generator
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
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
    created_at = Column(DateTime(timezone=True), nullable=False)


class OrderRow(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("idx_orders_user_created", "user_id", "created_at"),
        Index("idx_orders_user_status", "user_id", "status"),
        Index("idx_orders_status", "status"),
    )

    order_id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
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
    order_id = Column(String, nullable=False, index=True)
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
    user_id = Column(String, nullable=True)
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
    user_id = Column(String, nullable=False, index=True)
    order_id = Column(String, nullable=True)
    kind = Column(String, nullable=False)   # "source" | "result"
    storage_bucket = Column(String, nullable=False)
    storage_key = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


def init_db() -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)
    # Column-level migrations for existing databases.
    # create_all() only creates missing tables; it never alters existing ones.
    _run_column_migrations()


_VALID_ORDER_STATUSES = (
    "draft",
    "awaiting_credit_or_payment",
    "processing",
    "done",
    "failed",
)

_VALID_LIFECYCLE_STATES = (
    "S0",
    "S1",
    "S2",
    "S3",
    "S4",
    "S5",
    "S6",
    "INACTIVE_30D",
)


def _run_column_migrations() -> None:
    """Apply additive ALTER TABLE migrations idempotently."""
    with engine.connect() as conn:
        if _is_sqlite:
            # SQLite: check pragma, add if missing
            order_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(orders)"))}
            user_cols  = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
            if "is_favorite" not in order_cols:
                conn.execute(text(
                    "ALTER TABLE orders ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0"
                ))
            if "first_name" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN first_name TEXT"))
            if "username" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN username TEXT"))
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
            if "id" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN id TEXT"))
                # Backfill new rows with a UUID string; SQLite has no gen_random_uuid()
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
            conn.commit()
        else:
            # PostgreSQL: ADD COLUMN IF NOT EXISTS is idempotent
            conn.execute(text(
                "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE"
            ))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'S0'"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_state_updated_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_started_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_miniapp_opened_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_miniapp_opened_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_success_generation_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS zero_balance_since TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_locked BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_lock_reason TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_lock_by TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_lock_at TIMESTAMPTZ"))
            uuid_col_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='id'"
            )).fetchone()
            if not uuid_col_exists:
                conn.execute(text("ALTER TABLE users ADD COLUMN id UUID"))
                conn.execute(text(
                    "UPDATE users SET id = gen_random_uuid() WHERE id IS NULL"
                ))
                conn.execute(text(
                    "ALTER TABLE users ADD CONSTRAINT users_id_unique UNIQUE (id)"
                ))
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid ON users(id)"
                ))
            # ── Drop obsolete free-trial columns ─────────────────────────────
            # free_credit_available: migrate old users first (give 20 coins) then drop.
            fca_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='free_credit_available'"
            )).fetchone()
            if fca_exists:
                conn.execute(text(
                    "UPDATE users SET paid_credits = paid_credits + 20"
                    " WHERE free_credit_available = TRUE AND paid_credits = 0"
                ))
                conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS free_credit_available"))
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS free_credits_granted"))
            conn.execute(text("ALTER TABLE orders DROP COLUMN IF EXISTS is_free_credit_used"))

            # ── TIMESTAMP migration (VARCHAR → TIMESTAMPTZ) ──────────────────
            # Safe: USING clause parses ISO-8601 strings stored by now_iso().
            for tbl, col in [
                ("orders", "created_at"),
                ("orders", "updated_at"),
                ("users", "created_at"),
                ("users", "lifecycle_state_updated_at"),
                ("users", "bot_started_at"),
                ("users", "first_miniapp_opened_at"),
                ("users", "last_miniapp_opened_at"),
                ("users", "last_success_generation_at"),
                ("users", "last_payment_at"),
                ("users", "zero_balance_since"),
                ("users", "lifecycle_lock_at"),
                ("payments", "created_at"),
                ("jobs", "updated_at"),
            ]:
                result = conn.execute(text(
                    f"SELECT data_type FROM information_schema.columns "
                    f"WHERE table_name='{tbl}' AND column_name='{col}'"
                )).fetchone()
                if result and result[0].lower() in ("character varying", "text", "varchar"):
                    conn.execute(text(
                        f"ALTER TABLE {tbl} "
                        f"ALTER COLUMN {col} TYPE TIMESTAMPTZ "
                        f"USING {col}::TIMESTAMPTZ"
                    ))

            # ── FK constraints ────────────────────────────────────────────────
            fk_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE constraint_name='fk_orders_user_id' AND table_name='orders'"
            )).fetchone()
            if not fk_exists:
                conn.execute(text(
                    "ALTER TABLE orders ADD CONSTRAINT fk_orders_user_id "
                    "FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE"
                ))

            fk_pay_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE constraint_name='fk_payments_user_id' AND table_name='payments'"
            )).fetchone()
            if not fk_pay_exists:
                conn.execute(text(
                    "ALTER TABLE payments ADD CONSTRAINT fk_payments_user_id "
                    "FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL"
                ))

            # ── CHECK constraint on orders.status ────────────────────────────
            check_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE constraint_name='chk_orders_status' AND table_name='orders'"
            )).fetchone()
            if not check_exists:
                valid = ", ".join(f"'{s}'" for s in _VALID_ORDER_STATUSES)
                conn.execute(text(
                    f"ALTER TABLE orders ADD CONSTRAINT chk_orders_status "
                    f"CHECK (status IN ({valid}))"
                ))

            lifecycle_check_exists = conn.execute(text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE constraint_name='chk_users_lifecycle_state' AND table_name='users'"
            )).fetchone()
            if not lifecycle_check_exists:
                valid = ", ".join(f"'{s}'" for s in _VALID_LIFECYCLE_STATES)
                conn.execute(text(
                    f"ALTER TABLE users ADD CONSTRAINT chk_users_lifecycle_state "
                    f"CHECK (lifecycle_state IN ({valid}))"
                ))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS lifecycle_transitions (
                    transition_id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    from_state TEXT NULL,
                    to_state TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'system',
                    actor TEXT NULL,
                    metadata_json TEXT NULL,
                    created_at TIMESTAMPTZ NOT NULL
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
                    action_id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    from_state TEXT NULL,
                    to_state TEXT NULL,
                    metadata_json TEXT NULL,
                    created_at TIMESTAMPTZ NOT NULL
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
                    expires_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL,
                    CONSTRAINT uq_media_assets_storage_key UNIQUE (storage_key)
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
            # Idempotent: add unique constraint on existing tables that predate this migration
            conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'uq_media_assets_storage_key'
                          AND table_name = 'media_assets'
                    ) THEN
                        ALTER TABLE media_assets
                            ADD CONSTRAINT uq_media_assets_storage_key UNIQUE (storage_key);
                    END IF;
                END $$
            """))

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
