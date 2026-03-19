import type { PackageItem } from "../data/packages";

import { TopBar } from "../components/TopBar";

interface BalanceScreenProps {
  credits: number;
  packages: PackageItem[];
  onPurchase: (code: string) => void;
  onOpenModelsPricing: () => void;
}

export function BalanceScreen({ credits, packages, onPurchase, onOpenModelsPricing }: BalanceScreenProps) {
  return (
    <section className="screen active">
      <TopBar title="Баланс" />
      <div className="balance-hero">
        <div className="balance-coin-icon">🪙</div>
        <div className="balance-amount">{credits}</div>
        <div className="balance-label">монет на балансе</div>
      </div>

      <div className="section-title">Пополнить баланс</div>
      <div className="packages-list">
        {packages.map((pkg) => (
          <button key={pkg.code} className="package-card" onClick={() => onPurchase(pkg.code)}>
            <div className="package-name">{pkg.title}</div>
            <div className="package-coins">{pkg.credits} монет</div>
            <div className="package-price">{pkg.price_stars} ⭐</div>
          </button>
        ))}
      </div>

      <button className="link-button" onClick={onOpenModelsPricing}>
        Описание тарифов →
      </button>
    </section>
  );
}
