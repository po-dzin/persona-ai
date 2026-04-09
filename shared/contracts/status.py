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
    {"code": "STARTER", "title": "Starter", "credits": 150,  "bonus_coins": 0,    "bonus_percent": 0,  "stars_price": 230,  "sort_order": 10},
    {"code": "BASIC",   "title": "Basic",   "credits": 350,  "bonus_coins": 15,   "bonus_percent": 4,  "stars_price": 537,  "sort_order": 20},
    {"code": "POPULAR", "title": "Popular", "credits": 800,  "bonus_coins": 85,   "bonus_percent": 11, "stars_price": 1227, "sort_order": 30},
    {"code": "PRO",     "title": "Pro",     "credits": 2000, "bonus_coins": 300,  "bonus_percent": 15, "stars_price": 3067, "sort_order": 40},
    {"code": "ULTRA",   "title": "Ultra",   "credits": 5000, "bonus_coins": 1000, "bonus_percent": 20, "stars_price": 7667, "sort_order": 50},
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
        "id": "nano-banana-v2",
        "name": "Nano Banana 2",
        "provider": "nano_banana",
        "coins": 20,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "nano-banana-pro",
        "name": "Nano Banana Pro",
        "provider": "nano_banana",
        "coins": 50,
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
