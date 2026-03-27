export interface PackageItem {
  code: string;
  title: string;
  credits: number;
  price_stars: number;
  bonus_percent: number;
  provider: string;
}

export const FALLBACK_PACKAGES: PackageItem[] = [
  { code: "TEST", title: "Test", credits: 1000, price_stars: 1, bonus_percent: 0, provider: "telegram_stars" },
  { code: "STARTER", title: "Starter", credits: 150, price_stars: 199, bonus_percent: 0, provider: "telegram_stars" },
  { code: "BASIC", title: "Basic", credits: 350, price_stars: 399, bonus_percent: 5, provider: "telegram_stars" },
  { code: "POPULAR", title: "Popular", credits: 800, price_stars: 799, bonus_percent: 10, provider: "telegram_stars" },
  { code: "PRO", title: "Pro", credits: 2000, price_stars: 1599, bonus_percent: 18, provider: "telegram_stars" },
  { code: "ULTRA", title: "Ultra", credits: 5000, price_stars: 2999, bonus_percent: 25, provider: "telegram_stars" },
];
