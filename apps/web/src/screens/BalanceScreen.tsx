import type { PackageItem } from "../data/packages";

interface BalanceScreenProps {
  credits: number;
  packages: PackageItem[];
  onPurchase: (code: string) => void;
  onOpenModelsPricing: () => void;
}

const PACKAGE_ICONS: Record<string, string> = {
  STARTER: "🪙", BASIC: "💰", POPULAR: "⭐", PRO: "💎", ULTRA: "🏆",
};
const PACKAGE_BONUS: Record<string, string> = {
  BASIC: "+5%", POPULAR: "+10%", PRO: "+18%", ULTRA: "+25%",
};
const PACKAGE_ICON_BG: Record<string, string> = {
  STARTER: "rgba(255,214,102,0.1)",
  BASIC: "rgba(255,214,102,0.12)",
  POPULAR: "rgba(167,139,250,0.12)",
  PRO: "rgba(56,190,255,0.12)",
  ULTRA: "rgba(74,222,128,0.12)",
};

export function BalanceScreen({ credits, packages, onPurchase, onOpenModelsPricing }: BalanceScreenProps) {
  return (
    <section className="screen">
      <div className="top-bar"><div className="top-bar-title">Баланс</div></div>

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
              className={`package-card${isFeatured ? " featured" : ""}`}
              onClick={() => onPurchase(pkg.code)}
            >
              {isFeatured ? <div className="package-featured-tag">Популярное</div> : null}
              <div className="package-icon" style={{ background: PACKAGE_ICON_BG[pkg.code] ?? "rgba(255,214,102,0.1)" }}>
                {PACKAGE_ICONS[pkg.code] ?? "🪙"}
              </div>
              <div className="package-info">
                <div className="package-name">{pkg.title}</div>
                <div className="package-coins">{pkg.credits} монет</div>
              </div>
              <div className="package-right">
                <div className="package-price">{pkg.price_stars} ⭐</div>
                {bonus ? <div className="package-bonus">{bonus}</div> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="balance-note">
        Монеты не имеют срока действия · Возврат не предусмотрен
      </div>

      <button
        style={{ display: "block", margin: "0 auto 20px", background: "transparent", border: "none", color: "#8B83D4", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        onClick={onOpenModelsPricing}
      >
        Описание тарифов →
      </button>
    </section>
  );
}
