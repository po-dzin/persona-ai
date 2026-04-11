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
  { code: "STARTER", title: "Starter", credits: 150,  bonusCoins: 0,    bonusPercent: 0,  starsPrice: 230,  sortOrder: 10 },
  { code: "BASIC",   title: "Basic",   credits: 350,  bonusCoins: 20,   bonusPercent: 5,  starsPrice: 537,  sortOrder: 20 },
  { code: "POPULAR", title: "Popular", credits: 800,  bonusCoins: 80,   bonusPercent: 10, starsPrice: 1227, sortOrder: 30 },
  { code: "PRO",     title: "Pro",     credits: 2000, bonusCoins: 300,  bonusPercent: 15, starsPrice: 3067, sortOrder: 40 },
  { code: "ULTRA",   title: "Ultra",   credits: 5000, bonusCoins: 1000, bonusPercent: 20, starsPrice: 7667, sortOrder: 50 },
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

export const PROVIDER_IDS = ["nano_banana", "flux"] as const;

export const MODEL_CATALOG = [
  {
    id: "nb2-1k",
    name: "Nano Banana 2 · 1k",
    provider: "nano_banana",
    coins: 10,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "nb2-2k",
    name: "Nano Banana 2 · 2k",
    provider: "nano_banana",
    coins: 15,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "nb2-4k",
    name: "Nano Banana 2 · 4k",
    provider: "nano_banana",
    coins: 22,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "nb-pro-2k",
    name: "Nano Banana Pro · 2k",
    provider: "nano_banana",
    coins: 20,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "nb-pro-4k",
    name: "Nano Banana Pro · 4k",
    provider: "nano_banana",
    coins: 35,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "flux2-pro-1k",
    name: "FLUX.2 Pro · 1k",
    provider: "flux",
    coins: 7,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "flux2-pro-2k",
    name: "FLUX.2 Pro · 2k",
    provider: "flux",
    coins: 14,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "flux2-pro-4k",
    name: "FLUX.2 Pro · 4k",
    provider: "flux",
    coins: 27,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "flux2-max-1k",
    name: "FLUX.2 Max · 1k",
    provider: "flux",
    coins: 12,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "flux2-max-2k",
    name: "FLUX.2 Max · 2k",
    provider: "flux",
    coins: 22,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "flux2-max-4k",
    name: "FLUX.2 Max · 4k",
    provider: "flux",
    coins: 42,
    isActive: true,
    officialOnly: true,
  },
] as const;

export const SLA_SECONDS = { min: 30, max: 120 } as const;
export const RETENTION = { sourceHours: 48, resultDays: 30 } as const;
