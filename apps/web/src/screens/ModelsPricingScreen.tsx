import type { AIModel } from "../data/models";
import type { PackageItem } from "../data/packages";

interface ModelsPricingScreenProps {
  isOpen: boolean;
  models: AIModel[];
  packages: PackageItem[];
  onClose: () => void;
}

function retentionDays(code: string): string {
  return code === "PRO" || code === "ULTRA" ? "30 дней" : "7 дней";
}

export function ModelsPricingScreen({ isOpen, models, packages, onClose }: ModelsPricingScreenProps) {
  if (!isOpen) return null;

  return (
    <div className="overlay-screen pricing-screen">
      <div className="flow-top">
        <button className="flow-back" onClick={onClose} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flow-title">Описание тарифов</div>
        <div className="flow-step" />
      </div>

      <div className="pricing-subtitle">
        Стоимость генерации зависит от выбранной AI-модели.<br />
        Чем мощнее модель — тем выше качество результата.
      </div>

      <div className="models-list pricing-models-list">
        {models.map((model) => (
          <div key={model.id} className="model-row">
            <span className="model-name">{model.name}</span>
            <span className="model-price">{model.coins} 🪙</span>
          </div>
        ))}
      </div>

      <div className="pricing-section-title">Хранение фотографий</div>
      <div className="models-list pricing-storage-list">
        {packages.filter((p) => p.code !== "TEST").map((pkg) => {
          const days = retentionDays(pkg.code);
          const isLong = days.startsWith("30");
          return (
            <div key={pkg.code} className="model-row">
              <span className="model-name">{pkg.title}</span>
              <span className={"pricing-days" + (isLong ? " long" : "")}>{days}</span>
            </div>
          );
        })}
      </div>

      <div className="pricing-note">После истечения срока фото удаляются.</div>
    </div>
  );
}
