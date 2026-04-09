import { useState } from "react";

import type { PackageItem } from "../data/packages";

interface PurchaseScreenProps {
  isOpen: boolean;
  selectedPackage: PackageItem | null;
  onClose: () => void;
  onConfirm: (pkg: PackageItem) => void;
}


type PaymentMethod = "tg_stars" | "stripe";

export function PurchaseScreen({ isOpen, selectedPackage, onClose, onConfirm }: PurchaseScreenProps) {
  const [method, setMethod] = useState<PaymentMethod>("tg_stars");

  if (!isOpen || !selectedPackage) return null;

  const bonusCoins = selectedPackage.bonusCoins ?? (
    selectedPackage.bonusPercent > 0
      ? Math.round(selectedPackage.credits * selectedPackage.bonusPercent / 100)
      : 0
  );
  const isStripeEnabled = false;

  return (
    <div className="overlay-screen purchase-screen">
      <div className="flow-top">
        <button className="flow-back" onClick={onClose} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flow-title">Подтверждение</div>
        <div className="flow-step" />
      </div>

      <div className="purchase-summary">
        <div className="purchase-row">
          <div className="purchase-row-label">Пакет</div>
          <div className="purchase-row-value">{selectedPackage.title}</div>
        </div>
        <div className="purchase-row">
          <div className="purchase-row-label">Монет</div>
          <div className="purchase-row-value">
            {selectedPackage.credits}
            {bonusCoins > 0 && <span className="purchase-row-bonus-inline"> +{bonusCoins}</span>}
          </div>
        </div>
        {selectedPackage.bonusPercent > 0 ? (
          <div className="purchase-row">
            <div className="purchase-row-label">Бонус</div>
            <div className="purchase-row-value bonus">+{selectedPackage.bonusPercent}%</div>
          </div>
        ) : null}
        <div className="purchase-total">
          <div className="purchase-total-label">К оплате</div>
          <div className="purchase-total-value">{selectedPackage.priceStars} ⭐</div>
        </div>
      </div>

      <div className="purchase-methods">
        <button
          className={`purchase-method-option${method === "tg_stars" ? " active" : ""}`}
          onClick={() => setMethod("tg_stars")}
        >
          <div className="purchase-method-main">
            <div className="purchase-method-icon" aria-hidden="true">⭐</div>
            <div>
              <div className="purchase-method-name">Telegram Stars</div>
              <div className="purchase-method-desc">Списание из баланса Telegram</div>
            </div>
          </div>
          <div className="purchase-method-radio" aria-hidden="true" />
        </button>

        <button
          className={`purchase-method-option${method === "stripe" ? " active" : ""} disabled`}
          onClick={() => {
            if (isStripeEnabled) setMethod("stripe");
          }}
          disabled={!isStripeEnabled}
        >
          <div className="purchase-method-main">
            <div className="purchase-method-icon" aria-hidden="true">💳</div>
            <div>
              <div className="purchase-method-name">Stripe</div>
              <div className="purchase-method-desc">Банковская карта (скоро)</div>
            </div>
          </div>
          <div className="purchase-method-badge">Скоро</div>
        </button>
      </div>

      <div className="flow-bottom-bar">
        <button className="flow-btn purple" onClick={() => onConfirm(selectedPackage)}>
          Купить
        </button>
      </div>
    </div>
  );
}
