import type { PackageItem } from "../../../../shared/contracts/domain";

export const FALLBACK_PACKAGES: PackageItem[] = [
  { code: "TEST", title: "Test", credits: 1000, priceStars: 1, bonusPercent: 0, provider: "telegram_stars" },
  { code: "STARTER", title: "Starter", credits: 150,  priceStars: 230,  bonusPercent: 0,  provider: "telegram_stars" },
  { code: "BASIC",   title: "Basic",   credits: 350,  priceStars: 537,  bonusPercent: 4,  provider: "telegram_stars" },
  { code: "POPULAR", title: "Popular", credits: 800,  priceStars: 1227, bonusPercent: 9,  provider: "telegram_stars" },
  { code: "PRO",     title: "Pro",     credits: 2000, priceStars: 3067, bonusPercent: 15, provider: "telegram_stars" },
  { code: "ULTRA",   title: "Ultra",   credits: 5000, priceStars: 7667, bonusPercent: 20, provider: "telegram_stars" },
];

export type { PackageItem };
