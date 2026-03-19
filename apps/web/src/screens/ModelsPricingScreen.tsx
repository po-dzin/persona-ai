import type { AIModel } from "../data/models";

interface ModelsPricingScreenProps {
  isOpen: boolean;
  models: AIModel[];
  onClose: () => void;
}

export function ModelsPricingScreen({ isOpen, models, onClose }: ModelsPricingScreenProps) {
  if (!isOpen) return null;

  return (
    <div className="overlay-screen">
      <div className="flow-top">
        <button onClick={onClose}>←</button>
        <div className="flow-title">Описание тарифов</div>
        <div className="flow-step" />
      </div>
      <div className="models-list">
        {models.map((model) => (
          <div key={model.id} className="model-row">
            <span>{model.name}</span>
            <span>{model.coins} 🪙</span>
          </div>
        ))}
      </div>
      <div className="small-copy">Фото удаляется по политике хранения</div>
    </div>
  );
}
