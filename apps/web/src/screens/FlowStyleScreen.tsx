import { useMemo, useState } from "react";

import { StyleCard } from "../components/StyleCard";
import type { AIModel } from "../data/models";
import type { StyleItem } from "../data/styles";

interface FlowStyleScreenProps {
  isOpen: boolean;
  styles: StyleItem[];
  models: AIModel[];
  selectedStyle: StyleItem | null;
  onSelectStyle: (style: StyleItem) => void;
  onContinue: (payload: { modelId: string; prompt: string; aspectRatio: string }) => void;
  onClose: () => void;
}

export function FlowStyleScreen({
  isOpen,
  styles,
  models,
  selectedStyle,
  onSelectStyle,
  onContinue,
  onClose,
}: FlowStyleScreenProps) {
  const [tab, setTab] = useState<"styles" | "custom">("styles");
  const [customModel, setCustomModel] = useState(models[0]?.id || "nano-banana-v1");
  const [customPrompt, setCustomPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");

  const selectedModel = useMemo(() => models.find((model) => model.id === customModel), [customModel, models]);

  if (!isOpen) return null;

  return (
    <div className="overlay-screen">
      <div className="flow-top">
        <button onClick={onClose}>←</button>
        <div className="flow-title">Создать</div>
        <div className="flow-step">1/2</div>
      </div>

      <div className="flow-tabs">
        <button className={tab === "styles" ? "active" : ""} onClick={() => setTab("styles")}>Стили</button>
        <button className={tab === "custom" ? "active" : ""} onClick={() => setTab("custom")}>Кастом</button>
      </div>

      {tab === "styles" ? (
        <>
          <div className="styles-grid">
            {styles.map((style) => (
              <StyleCard key={style.id} style={style} onClick={onSelectStyle} />
            ))}
          </div>
          <button
            className="flow-primary"
            disabled={!selectedStyle}
            onClick={() =>
              onContinue({
                modelId: "nano-banana-v1",
                prompt: selectedStyle?.prompt_template || "",
                aspectRatio: ratio,
              })
            }
          >
            Дальше
          </button>
        </>
      ) : (
        <>
          <div className="custom-field">
            <label>Модель</label>
            <select value={customModel} onChange={(event) => setCustomModel(event.target.value)}>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} — {model.coins} 🪙
                </option>
              ))}
            </select>
          </div>
          <div className="custom-field">
            <label>Запрос</label>
            <textarea
              value={customPrompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
              placeholder="Опишите, что хотите увидеть..."
            />
          </div>
          <div className="custom-field">
            <label>Соотношение сторон</label>
            <div className="ratio-grid">
              {["1:1", "9:16", "16:9", "4:5", "5:4"].map((value) => (
                <button key={value} className={ratio === value ? "active" : ""} onClick={() => setRatio(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="custom-cost">Стоимость: {selectedModel?.coins || 10} 🪙</div>
          <button
            className="flow-primary"
            onClick={() =>
              onContinue({
                modelId: customModel,
                prompt: customPrompt,
                aspectRatio: ratio,
              })
            }
          >
            Дальше
          </button>
        </>
      )}
    </div>
  );
}
