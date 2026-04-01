from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.settings import settings

_is_sqlite = settings.database_url.startswith("sqlite")

if _is_sqlite:
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={"sslmode": "require"} if "render.com" in settings.database_url else {},
    )

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True)
    first_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    free_credits_granted = Column(Boolean, default=True, nullable=False)
    free_credit_available = Column(Boolean, default=True, nullable=False)
    paid_credits = Column(Integer, default=0, nullable=False)
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
    is_free_credit_used = Column(Boolean, nullable=False, default=False)
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
            conn.commit()
        else:
            # PostgreSQL: ADD COLUMN IF NOT EXISTS is idempotent
            conn.execute(text(
                "ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE"
            ))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT"))

            # ── TIMESTAMP migration (VARCHAR → TIMESTAMPTZ) ──────────────────
            # Safe: USING clause parses ISO-8601 strings stored by now_iso().
            for tbl, col in [
                ("orders", "created_at"),
                ("orders", "updated_at"),
                ("users", "created_at"),
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

            conn.commit()


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context-manager that commits on success and rolls back on exception."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
