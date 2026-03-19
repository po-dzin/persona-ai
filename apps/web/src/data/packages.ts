export interface PackageItem {
  code: string;
  title: string;
  credits: number;
  price_stars: number;
  provider: string;
}

export const FALLBACK_PACKAGES: PackageItem[] = [
  { code: "STARTER", title: "Starter", credits: 150, price_stars: 199, provider: "telegram_stars" },
  { code: "BASIC", title: "Basic", credits: 350, price_stars: 399, provider: "telegram_stars" },
  { code: "POPULAR", title: "Popular", credits: 800, price_stars: 799, provider: "telegram_stars" },
  { code: "PRO", title: "Pro", credits: 2000, price_stars: 1599, provider: "telegram_stars" },
  { code: "ULTRA", title: "Ultra", credits: 5000, price_stars: 2999, provider: "telegram_stars" },
];
