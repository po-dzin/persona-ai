import { useMemo, useState } from "react";

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
  isOpen, styles, models, selectedStyle,
  onSelectStyle, onContinue, onClose,
}: FlowStyleScreenProps) {
  const [tab, setTab] = useState<"styles" | "custom">("styles");
  const [customModel, setCustomModel] = useState(models[0]?.id || "nano-banana-v1");
  const [customPrompt, setCustomPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");

  const selectedModel = useMemo(() => models.find(m => m.id === customModel), [customModel, models]);

  if (!isOpen) return null;

  const canContinue = tab === "styles" ? !!selectedStyle : customPrompt.trim().length > 0;

  return (
    <div className="overlay-screen">
      <div className="flow-top">
        <button className="flow-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flow-title">Создать</div>
        <div className="flow-step">1/2</div>
      </div>

      <div className="flow-tabs">
        <button className={"flow-tab" + (tab === "styles" ? " active" : "")} onClick={() => setTab("styles")}>Стили</button>
        <button className={"flow-tab" + (tab === "custom" ? " active" : "")} onClick={() => setTab("custom")}>Кастом</button>
      </div>

      {tab === "styles" ? (
        <>
          <div className="pick-styles-grid">
            {styles.map((style) => (
              <button
                key={style.id}
                className={"pick-style" + (selectedStyle?.id === style.id ? " selected" : "")}
                onClick={() => onSelectStyle(style)}
              >
                <div className="style-preview" style={{ background: style.gradient }}>
                  {style.is_trending ? <span className="style-tag fire">Hot</span> : null}
                  {style.is_new ? <span className="style-tag new">New</span> : null}
                  <div className="style-overlay">
                    <div className="style-name">{style.name}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="flow-bottom-bar">
            <button
              className={"flow-btn " + (canContinue ? "purple" : "disabled")}
              disabled={!canContinue}
              onClick={() => onContinue({ modelId: "nano-banana-v1", prompt: selectedStyle?.prompt_template || "", aspectRatio: ratio })}
            >
              Дальше
            </button>
          </div>
        </>
      ) : (
        <div className="custom-content">
          <div className="custom-field">
            <div className="custom-label">Модель</div>
            <select className="custom-select" value={customModel} onChange={e => setCustomModel(e.target.value)}>
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name} — {m.coins} 🪙</option>
              ))}
            </select>
          </div>
          <div className="custom-field">
            <div className="custom-label">Запрос</div>
            <textarea
              className="custom-textarea"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Опишите, что хотите увидеть..."
            />
          </div>
          <div className="custom-field">
            <div className="custom-label">Соотношение сторон</div>
            <div className="ratio-grid">
              {["1:1", "9:16", "16:9", "4:5", "5:4"].map(v => (
                <button key={v} className={"ratio-chip" + (ratio === v ? " active" : "")} onClick={() => setRatio(v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className="custom-cost">Стоимость: <strong>{selectedModel?.coins || 10} 🪙</strong></div>
          <div className="flow-bottom-bar">
            <button
              className={"flow-btn " + (canContinue ? "purple" : "disabled")}
              disabled={!canContinue}
              onClick={() => onContinue({ modelId: customModel, prompt: customPrompt, aspectRatio: ratio })}
            >
              Дальше
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
