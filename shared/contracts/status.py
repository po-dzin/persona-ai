"""Canonical status contracts shared by API/worker/tests."""

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

PACKAGE_CREDITS = {
    "S": 5,
    "M": 20,
    "L": 50,
}

SLA_SECONDS_MIN = 40
SLA_SECONDS_MAX = 180
SOURCE_RETENTION_HOURS = 48
RESULT_RETENTION_DAYS = 30

BASE_GEN_USD = 0.25
PACKAGE_MARKUPS = {
    "S": 3.0,
    "M": 2.6,
    "L": 2.2,
}
