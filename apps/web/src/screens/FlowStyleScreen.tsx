import { useEffect, useMemo, useState } from "react";

import type { AIModel } from "../data/models";
import type { StyleItem } from "../data/styles";

interface FlowStyleScreenProps {
  isOpen: boolean;
  styles: StyleItem[];
  models: AIModel[];
  selectedStyle: StyleItem | null;
  initialTab?: "styles" | "custom";
  initialCustomPrompt?: string;
  initialCustomModelId?: string;
  onSelectStyle: (style: StyleItem) => void;
  onContinue: (payload: { modelId: string; prompt: string; aspectRatio: string }) => void;
  onClose: () => void;
}

export function FlowStyleScreen({
  isOpen, styles, models, selectedStyle,
  initialTab = "styles",
  initialCustomPrompt = "",
  initialCustomModelId,
  onSelectStyle, onContinue, onClose,
}: FlowStyleScreenProps) {
  const ratioOptions = ["1:1", "9:16", "16:9", "3:4", "4:3", "2:3", "5:4", "21:9"];
  const categoryOrder = ["Тренды", "Бизнес и карьера", "Лайфстайл", "Арт и креатив", "Особый повод"];
  const [tab, setTab] = useState<"styles" | "custom">(initialTab);
  const [customModel, setCustomModel] = useState(initialCustomModelId || models[0]?.id || "nano-banana-v1");
  const [customPrompt, setCustomPrompt] = useState(initialCustomPrompt);
  const [ratio, setRatio] = useState("1:1");

  const selectedModel = useMemo(() => models.find(m => m.id === customModel), [customModel, models]);
  const stylesByCategory = useMemo(() => {
    const grouped: Record<string, StyleItem[]> = {};
    for (const style of styles) {
      if (!grouped[style.category]) grouped[style.category] = [];
      grouped[style.category].push(style);
    }
    const ordered = categoryOrder.filter((category) => grouped[category]);
    for (const category of Object.keys(grouped)) {
      if (!ordered.includes(category)) ordered.push(category);
    }
    return ordered.map((category) => ({ category, items: grouped[category] || [] }));
  }, [styles]);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setCustomPrompt(initialCustomPrompt);
    setCustomModel(initialCustomModelId || models[0]?.id || "nano-banana-v1");
  }, [isOpen, initialTab, initialCustomPrompt, initialCustomModelId, models]);

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
          <div>
            {stylesByCategory.map((block) => (
              <div key={block.category}>
                <div className="section-header"><div className="section-title">{block.category}</div></div>
                <div className="styles-scroll">
                  {block.items.map((style) => {
                    const isSelected = selectedStyle?.id === style.id;
                    return (
                      <button
                        key={style.id}
                        className={"style-card" + (isSelected ? " selected" : "")}
                        onClick={() => onSelectStyle(style)}
                      >
                        <div className="style-check">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="style-preview" style={{ background: style.gradient }}>
                          {style.is_trending ? <span className="style-tag fire">Hot</span> : null}
                          {style.is_new ? <span className="style-tag new">New</span> : null}
                          <div className="style-overlay">
                            <div className="style-name">{style.name}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ height: 16 }}>
              <div />
            </div>
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
              {ratioOptions.map(v => (
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
