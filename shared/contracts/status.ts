export const ORDER_STATUSES = [
  "draft",
  "awaiting_credit_or_payment",
  "queued",
  "processing",
  "done",
  "failed",
  "canceled",
] as const;

export const JOB_STATUSES = [
  "queued",
  "submitted",
  "processing",
  "done",
  "failed",
  "timeout",
] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

export const PACKAGE_CREDITS = {
  S: 5,
  M: 20,
  L: 50,
} as const;

export const SLA_SECONDS = { min: 40, max: 180 } as const;
export const RETENTION = { sourceHours: 48, resultDays: 30 } as const;
