import type { PackageItem } from "../../../../shared/contracts/domain";

export const FALLBACK_PACKAGES: PackageItem[] = [
  { code: "TEST", title: "Test", credits: 1000, priceStars: 1, bonusPercent: 0, provider: "telegram_stars" },
  { code: "STARTER", title: "Starter", credits: 150, priceStars: 199, bonusPercent: 0, provider: "telegram_stars" },
  { code: "BASIC", title: "Basic", credits: 350, priceStars: 399, bonusPercent: 5, provider: "telegram_stars" },
  { code: "POPULAR", title: "Popular", credits: 800, priceStars: 799, bonusPercent: 10, provider: "telegram_stars" },
  { code: "PRO", title: "Pro", credits: 2000, priceStars: 1599, bonusPercent: 18, provider: "telegram_stars" },
  { code: "ULTRA", title: "Ultra", credits: 5000, priceStars: 2999, bonusPercent: 25, provider: "telegram_stars" },
];

export type { PackageItem };
