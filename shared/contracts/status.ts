export const ORDER_STATUSES = [
  "draft",
  "awaiting_credit_or_payment",
  "queued",
  "processing",
  "done",
  "failed",
  "canceled",
] as const;

export const JOB_STATUSES = ["queued", "submitted", "processing", "done", "failed", "timeout"] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PACKAGE_MATRIX = [
  { code: "STARTER", title: "Starter", credits: 150, starsPrice: 199, bonusPercent: 0, sortOrder: 10 },
  { code: "BASIC", title: "Basic", credits: 350, starsPrice: 399, bonusPercent: 5, sortOrder: 20 },
  { code: "POPULAR", title: "Popular", credits: 800, starsPrice: 799, bonusPercent: 10, sortOrder: 30 },
  { code: "PRO", title: "Pro", credits: 2000, starsPrice: 1599, bonusPercent: 18, sortOrder: 40 },
  { code: "ULTRA", title: "Ultra", credits: 5000, starsPrice: 2999, bonusPercent: 25, sortOrder: 50 },
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
