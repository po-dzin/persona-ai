import type { PackageItem } from "../data/packages";

interface PurchaseScreenProps {
  isOpen: boolean;
  selectedPackage: PackageItem | null;
  onClose: () => void;
  onConfirm: (pkg: PackageItem) => void;
}

const BONUS_BY_CODE: Record<string, string> = {
  BASIC: "+5%",
  POPULAR: "+10%",
  PRO: "+18%",
  ULTRA: "+25%",
};

export function PurchaseScreen({ isOpen, selectedPackage, onClose, onConfirm }: PurchaseScreenProps) {
  if (!isOpen || !selectedPackage) return null;

  const bonus = BONUS_BY_CODE[selectedPackage.code];

  return (
    <div className="overlay-screen purchase-screen">
      <div className="flow-top">
        <button className="flow-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
          <div className="purchase-row-value">{selectedPackage.credits}</div>
        </div>
        {bonus ? (
          <div className="purchase-row">
            <div className="purchase-row-label">Бонус</div>
            <div className="purchase-row-value bonus">{bonus}</div>
          </div>
        ) : null}
        <div className="purchase-total">
          <div className="purchase-total-label">К оплате</div>
          <div className="purchase-total-value">{selectedPackage.price_stars} ⭐</div>
        </div>
      </div>

      <div className="purchase-method">
        <div className="purchase-method-name">Telegram Stars</div>
        <div className="purchase-method-desc">Списание из баланса Telegram</div>
      </div>

      <div className="flow-bottom-bar">
        <button className="flow-btn purple" onClick={() => onConfirm(selectedPackage)}>
          Купить
        </button>
      </div>
    </div>
  );
}
