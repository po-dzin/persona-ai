// AUTO-GENERATED — do not edit manually.
// Source of truth: shared/contracts/status.py
// Regenerate: python shared/contracts/generate_ts.py

export const ORDER_STATUSES = ["draft", "awaiting_credit_or_payment", "queued", "processing", "done", "failed", "canceled"] as const;

export const JOB_STATUSES = ["queued", "submitted", "processing", "done", "failed", "timeout"] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PACKAGE_MATRIX = [
  { code: "STARTER", title: "Starter", credits: 150,  starsPrice: 230,  bonusPercent: 0,  sortOrder: 10 },
  { code: "BASIC",   title: "Basic",   credits: 365,  starsPrice: 537,  bonusPercent: 4,  sortOrder: 20 },
  { code: "POPULAR", title: "Popular", credits: 875,  starsPrice: 1227, bonusPercent: 9,  sortOrder: 30 },
  { code: "PRO",     title: "Pro",     credits: 2300, starsPrice: 3067, bonusPercent: 15, sortOrder: 40 },
  { code: "ULTRA",   title: "Ultra",   credits: 6000, starsPrice: 7667, bonusPercent: 20, sortOrder: 50 },
] as const;

export const PACKAGE_CREDITS = Object.fromEntries(
  PACKAGE_MATRIX.map((p) => [p.code, p.credits]),
) as Record<(typeof PACKAGE_MATRIX)[number]["code"], number>;

export const PACKAGE_STARS_PRICES = Object.fromEntries(
  PACKAGE_MATRIX.map((p) => [p.code, p.starsPrice]),
) as Record<(typeof PACKAGE_MATRIX)[number]["code"], number>;

export const PACKAGE_TITLES = Object.fromEntries(
  PACKAGE_MATRIX.map((p) => [p.code, p.title]),
) as Record<(typeof PACKAGE_MATRIX)[number]["code"], string>;

export const PACKAGE_BONUS_PERCENT = Object.fromEntries(
  PACKAGE_MATRIX.map((p) => [p.code, p.bonusPercent]),
) as Record<(typeof PACKAGE_MATRIX)[number]["code"], number>;

export const PROVIDER_IDS = ["nano_banana"] as const;

export const MODEL_CATALOG = [
  {
    id: "nano-banana-v1",
    name: "Nano Banana",
    provider: "nano_banana",
    coins: 10,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "nano-banana-v2",
    name: "Nano Banana 2",
    provider: "nano_banana",
    coins: 20,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "nano_banana",
    coins: 50,
    isActive: true,
    officialOnly: true,
  },
] as const;

export const SLA_SECONDS = { min: 30, max: 120 } as const;
export const RETENTION = { sourceHours: 48, resultDays: 30 } as const;
