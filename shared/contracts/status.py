"""Canonical contracts shared by API/worker/tests for photo-first Phase 1."""

from __future__ import annotations

ORDER_STATUSES = (
    "draft",
    "awaiting_credit_or_payment",
    "queued",
    "processing",
    "done",
    "failed",
    "canceled",
)

JOB_STATUSES = (
    "queued",
    "submitted",
    "processing",
    "done",
    "failed",
    "timeout",
)

PAYMENT_STATUSES = (
    "pending",
    "paid",
    "failed",
    "refunded",
)

PACKAGE_MATRIX = (
    {"code": "STARTER", "title": "Starter", "credits": 150, "stars_price": 199, "bonus_percent": 0, "sort_order": 10},
    {"code": "BASIC", "title": "Basic", "credits": 350, "stars_price": 399, "bonus_percent": 5, "sort_order": 20},
    {"code": "POPULAR", "title": "Popular", "credits": 800, "stars_price": 799, "bonus_percent": 10, "sort_order": 30},
    {"code": "PRO", "title": "Pro", "credits": 2000, "stars_price": 1599, "bonus_percent": 18, "sort_order": 40},
    {"code": "ULTRA", "title": "Ultra", "credits": 5000, "stars_price": 2999, "bonus_percent": 25, "sort_order": 50},
)

PACKAGE_CREDITS = {pkg["code"]: pkg["credits"] for pkg in PACKAGE_MATRIX}
PACKAGE_STARS_PRICES = {pkg["code"]: pkg["stars_price"] for pkg in PACKAGE_MATRIX}
PACKAGE_TITLES = {pkg["code"]: pkg["title"] for pkg in PACKAGE_MATRIX}
PACKAGE_BONUS_PERCENT = {pkg["code"]: pkg["bonus_percent"] for pkg in PACKAGE_MATRIX}

PROVIDER_IDS = (
    "nano_banana",
)

MODEL_CATALOG = (
    {
        "id": "nano-banana-v1",
        "name": "Nano Banana",
        "provider": "nano_banana",
        "coins": 10,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "nano-banana-pro",
        "name": "Nano Banana Pro",
        "provider": "nano_banana",
        "coins": 20,
        "is_active": True,
        "official_only": True,
    },
)

MODEL_BY_ID = {model["id"]: model for model in MODEL_CATALOG}

SLA_SECONDS_MIN = 30
SLA_SECONDS_MAX = 120
SOURCE_RETENTION_HOURS = 48
RESULT_RETENTION_DAYS = 30

BASE_GEN_USD = 0.25
