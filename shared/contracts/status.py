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
    {"code": "BASIC",   "title": "Basic",   "credits": 350,  "bonus_coins": 20,   "bonus_percent": 5,  "stars_price": 537,  "sort_order": 20},
    {"code": "POPULAR", "title": "Popular", "credits": 800,  "bonus_coins": 80,   "bonus_percent": 10, "stars_price": 1227, "sort_order": 30},
    {"code": "PRO",     "title": "Pro",     "credits": 2000, "bonus_coins": 300,  "bonus_percent": 15, "stars_price": 3067, "sort_order": 40},
    {"code": "ULTRA",   "title": "Ultra",   "credits": 5000, "bonus_coins": 1000, "bonus_percent": 20, "stars_price": 7667, "sort_order": 50},
)

PACKAGE_CREDITS = {pkg["code"]: pkg["credits"] for pkg in PACKAGE_MATRIX}
PACKAGE_BONUS_COINS = {pkg["code"]: pkg["bonus_coins"] for pkg in PACKAGE_MATRIX}
PACKAGE_STARS_PRICES = {pkg["code"]: pkg["stars_price"] for pkg in PACKAGE_MATRIX}
PACKAGE_TITLES = {pkg["code"]: pkg["title"] for pkg in PACKAGE_MATRIX}
PACKAGE_BONUS_PERCENT = {pkg["code"]: pkg["bonus_percent"] for pkg in PACKAGE_MATRIX}

PROVIDER_IDS = (
    "nano_banana",
    "flux",
)

MODEL_CATALOG = (
    {
        "id": "nb2-1k",
        "name": "Nano Banana 2 · 1k",
        "provider": "nano_banana",
        "coins": 10,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "nb2-2k",
        "name": "Nano Banana 2 · 2k",
        "provider": "nano_banana",
        "coins": 15,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "nb2-4k",
        "name": "Nano Banana 2 · 4k",
        "provider": "nano_banana",
        "coins": 22,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "nb-pro-2k",
        "name": "Nano Banana Pro · 2k",
        "provider": "nano_banana",
        "coins": 20,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "nb-pro-4k",
        "name": "Nano Banana Pro · 4k",
        "provider": "nano_banana",
        "coins": 35,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "flux2-pro-1k",
        "name": "FLUX.2 Pro · 1k",
        "provider": "flux",
        "coins": 7,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "flux2-pro-2k",
        "name": "FLUX.2 Pro · 2k",
        "provider": "flux",
        "coins": 14,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "flux2-pro-4k",
        "name": "FLUX.2 Pro · 4k",
        "provider": "flux",
        "coins": 27,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "flux2-max-1k",
        "name": "FLUX.2 Max · 1k",
        "provider": "flux",
        "coins": 12,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "flux2-max-2k",
        "name": "FLUX.2 Max · 2k",
        "provider": "flux",
        "coins": 22,
        "is_active": True,
        "official_only": True,
    },
    {
        "id": "flux2-max-4k",
        "name": "FLUX.2 Max · 4k",
        "provider": "flux",
        "coins": 42,
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
