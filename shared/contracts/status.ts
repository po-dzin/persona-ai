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
  { code: "STARTER", title: "Starter", credits: 150, starsPrice: 199, sortOrder: 10 },
  { code: "BASIC", title: "Basic", credits: 350, starsPrice: 399, sortOrder: 20 },
  { code: "POPULAR", title: "Popular", credits: 800, starsPrice: 799, sortOrder: 30 },
  { code: "PRO", title: "Pro", credits: 2000, starsPrice: 1599, sortOrder: 40 },
  { code: "ULTRA", title: "Ultra", credits: 5000, starsPrice: 2999, sortOrder: 50 },
] as const;

export const PACKAGE_CREDITS = Object.fromEntries(PACKAGE_MATRIX.map((p) => [p.code, p.credits])) as Record<
  (typeof PACKAGE_MATRIX)[number]["code"],
  number
>;

export const PACKAGE_ALIASES = {
  S: "STARTER",
  M: "POPULAR",
  L: "PRO",
} as const;

export const PROVIDER_IDS = ["nano_banana", "stable_diffusion", "flux", "openai_image", "recraft"] as const;

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
    id: "sd-3.5-turbo",
    name: "Stable Diffusion 3.5 Turbo",
    provider: "stable_diffusion",
    coins: 15,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "recraft-v4",
    name: "Recraft V4",
    provider: "recraft",
    coins: 25,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "gpt-image-1.5",
    name: "OpenAI GPT-image-1.5",
    provider: "openai_image",
    coins: 30,
    isActive: true,
    officialOnly: true,
  },
  {
    id: "flux-kontxt-pro",
    name: "FLUX.1 Kontext [pro]",
    provider: "flux",
    coins: 40,
    isActive: true,
    officialOnly: true,
  },
] as const;

export const SLA_SECONDS = { min: 30, max: 120 } as const;
export const RETENTION = { sourceHours: 48, resultDays: 30 } as const;
