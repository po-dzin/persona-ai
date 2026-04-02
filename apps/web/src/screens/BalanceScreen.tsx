import type { PackageItem } from "../data/packages";

interface BalanceScreenProps {
  credits: number;
  packages: PackageItem[];
  onSelectPackage: (pkg: PackageItem) => void;
  onOpenPricing: () => void;
}

const PACKAGE_BONUS: Record<string, string> = {
  BASIC: "+5% бонус",
  POPULAR: "+10% бонус",
  PRO: "+18% бонус",
  ULTRA: "+25% бонус",
};

const PACKAGE_ICONS: Record<string, string> = {
  STARTER: "🪙",
  BASIC: "🪙",
  POPULAR: "🪙",
  PRO: "🪙",
  ULTRA: "🪙",
};

const PACKAGE_ICON_BG: Record<string, string> = {
  STARTER: "var(--sem-color-package-icon-starter)",
  BASIC: "var(--sem-color-package-icon-basic)",
  POPULAR: "var(--sem-color-package-icon-popular)",
  PRO: "var(--sem-color-package-icon-pro)",
  ULTRA: "var(--sem-color-package-icon-ultra)",
};

export function BalanceScreen({ credits, packages, onSelectPackage, onOpenPricing }: BalanceScreenProps) {
  return (
    <section className="screen">
      <div className="balance-hero">
        <div className="balance-coin-icon">🪙</div>
        <div className="balance-amount">{credits}</div>
        <div className="balance-label">монет на балансе</div>
      </div>

      <div className="balance-section-title">Пополнить баланс</div>
      <div className="packages-list">
        {packages.map((pkg) => {
          const bonus = PACKAGE_BONUS[pkg.code];
          const isFeatured = pkg.code === "POPULAR";
          return (
            <button
              key={pkg.code}
              type="button"
              className={`package-card${isFeatured ? " featured" : ""}`}
              onClick={() => onSelectPackage(pkg)}
            >
              <div className="package-icon" style={{ background: PACKAGE_ICON_BG[pkg.code] ?? "var(--sem-color-package-icon-fallback)" }}>
                {PACKAGE_ICONS[pkg.code] ?? "🪙"}
              </div>
              <div className="package-info">
                <div className="package-name">{pkg.title}</div>
                <div className="package-coins">{pkg.credits} монет</div>
              </div>
              <div className="package-right">
                {isFeatured ? <div className="package-featured-tag">Популярное</div> : null}
                <div className="package-price">{pkg.priceStars} ⭐</div>
                {bonus ? <div className="package-bonus">{bonus}</div> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="balance-footer-copy">
        Оплата через Telegram Stars.<br />
        Монеты начисляются мгновенно.
      </div>
      <button type="button" className="balance-pricing-link" onClick={onOpenPricing}>Описание тарифов →</button>

      <div className="screen-tail-space" />
    </section>
  );
}
