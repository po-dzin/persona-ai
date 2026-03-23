from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.settings import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"sslmode": "require"} if "render.com" in settings.database_url else {},
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True)
    free_credits_granted = Column(Boolean, default=True, nullable=False)
    free_credit_available = Column(Boolean, default=True, nullable=False)
    paid_credits = Column(Integer, default=0, nullable=False)
    created_at = Column(String, nullable=False)


class OrderRow(Base):
    __tablename__ = "orders"

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
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class JobRow(Base):
    __tablename__ = "jobs"

    job_id = Column(String, primary_key=True)
    order_id = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False)
    status = Column(String, nullable=False, default="queued")
    provider_task_id = Column(String, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    updated_at = Column(String, nullable=False)


class PaymentRow(Base):
    __tablename__ = "payments"

    payment_id = Column(String, primary_key=True)
    provider = Column(String, nullable=False)
    status = Column(String, nullable=False)
    package_code = Column(String, nullable=False)
    user_id = Column(String, nullable=True, index=True)
    amount = Column(Integer, nullable=False, default=0)
    created_at = Column(String, nullable=False)


def init_db() -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()
