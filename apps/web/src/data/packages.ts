import type { PackageItem } from "../../../../shared/contracts/domain";

export const FALLBACK_PACKAGES: PackageItem[] = [
  { code: "TEST",    title: "Test",    credits: 1000, bonusCoins: 0,    bonusPercent: 0,  priceStars: 1,    provider: "telegram_stars" },
  { code: "STARTER", title: "Starter", credits: 150,  bonusCoins: 0,    bonusPercent: 0,  priceStars: 230,  provider: "telegram_stars" },
  { code: "BASIC",   title: "Basic",   credits: 350,  bonusCoins: 15,   bonusPercent: 4,  priceStars: 537,  provider: "telegram_stars" },
  { code: "POPULAR", title: "Popular", credits: 800,  bonusCoins: 75,   bonusPercent: 9,  priceStars: 1227, provider: "telegram_stars" },
  { code: "PRO",     title: "Pro",     credits: 2000, bonusCoins: 300,  bonusPercent: 15, priceStars: 3067, provider: "telegram_stars" },
  { code: "ULTRA",   title: "Ultra",   credits: 5000, bonusCoins: 1000, bonusPercent: 20, priceStars: 7667, provider: "telegram_stars" },
];

export type { PackageItem };
