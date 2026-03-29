import { useEffect, useMemo, useRef, useState } from "react";

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
  onContinue: (payload: {
    modelId: string;
    prompt: string;
    aspectRatio: string;
    sourceTab: "styles" | "custom";
    photoFile?: File | null;
  }) => void;
  onClose: () => void;
}

function ratioRectSize(value: string): { width: number; height: number } {
  const [rawW, rawH] = value.split(":").map(Number);
  const w = Number.isFinite(rawW) && rawW > 0 ? rawW : 1;
  const h = Number.isFinite(rawH) && rawH > 0 ? rawH : 1;

  if (w >= h) {
    const width = 24;
    const height = Math.max(8, Math.round((24 * h) / w));
    return { width, height };
  }

  const height = 16;
  const width = Math.max(8, Math.round((16 * w) / h));
  return { width, height };
}

export function FlowStyleScreen({
  isOpen,
  styles,
  models,
  selectedStyle,
  initialTab = "styles",
  initialCustomPrompt = "",
  initialCustomModelId,
  onSelectStyle,
  onContinue,
  onClose,
}: FlowStyleScreenProps) {
  const ratioOptions = ["1:1", "9:16", "16:9", "3:4", "4:3", "2:3", "5:4", "21:9"];
  const categoryOrder = ["Тренды", "Бизнес и карьера", "Лайфстайл", "Арт и креатив", "Особый повод"];
  const MAX_FILE_SIZE_MB = 20;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const [tab, setTab] = useState<"styles" | "custom">(initialTab);
  const [customModel, setCustomModel] = useState(initialCustomModelId || models[0]?.id || "nano-banana-v1");
  const [customPrompt, setCustomPrompt] = useState(initialCustomPrompt);
  const [ratio, setRatio] = useState("1:1");
  const [customPhoto, setCustomPhoto] = useState<File | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const [customPhotoError, setCustomPhotoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setCustomPhoto(null);
    setCustomPhotoError(null);
    if (customPhotoUrl) {
      URL.revokeObjectURL(customPhotoUrl);
      setCustomPhotoUrl(null);
    }
  }, [isOpen, initialTab, initialCustomPrompt, initialCustomModelId, models]);

  const pickPhoto = () => inputRef.current?.click();

  const handleCustomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = (file.type || "").toLowerCase();

    if (!["image/jpeg", "image/png"].includes(mime)) {
      setCustomPhotoError("Поддерживаются только JPG и PNG");
      setCustomPhoto(null);
      if (customPhotoUrl) {
        URL.revokeObjectURL(customPhotoUrl);
        setCustomPhotoUrl(null);
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setCustomPhotoError(`Файл слишком большой. Максимум ${MAX_FILE_SIZE_MB} МБ`);
      setCustomPhoto(null);
      if (customPhotoUrl) {
        URL.revokeObjectURL(customPhotoUrl);
        setCustomPhotoUrl(null);
      }
      return;
    }

    setCustomPhotoError(null);
    setCustomPhoto(file);
    if (customPhotoUrl) URL.revokeObjectURL(customPhotoUrl);
    setCustomPhotoUrl(URL.createObjectURL(file));
  };

  if (!isOpen) return null;

  const canCreateCustom = customPrompt.trim().length > 0 && !!customPhoto && !customPhotoError;

  return (
    <div className="overlay-screen">
      <div className="flow-top flow-top-create">
        <div className="flow-step" />
        <div className="flow-title">Создать</div>
        <div className="flow-step" />
      </div>

      <div className="flow-tabs">
        <button className={"flow-tab" + (tab === "styles" ? " active" : "")} onClick={() => setTab("styles")}>Стили</button>
        <button className={"flow-tab" + (tab === "custom" ? " active" : "")} onClick={() => setTab("custom")}>Кастом</button>
      </div>

      {tab === "styles" ? (
        <>
          {stylesByCategory.map((block) => (
            <div key={block.category}>
              <div className="section-header"><div className="section-title">{block.category}</div></div>
              <div className="styles-scroll">
                {block.items.map((style) => (
                  <button
                    key={style.id}
                    className={"style-card" + (selectedStyle?.id === style.id ? " selected" : "")}
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
            </div>
          ))}
          <div style={{ height: 12 }} />
        </>
      ) : (
        <>
          <div className="custom-content">
            <div className="custom-field">
              <div className="custom-label">Модель</div>
              <select className="custom-select" value={customModel} onChange={(e) => setCustomModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.coins} 🪙</option>
                ))}
              </select>
            </div>

            <div className="custom-field">
              <div className="custom-label">Фото</div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: "none" }}
                onChange={handleCustomFile}
              />

              {customPhotoUrl ? (
                <div className="upload-area custom-upload-area" style={{ border: "none", padding: 0, margin: 0, borderRadius: 16, overflow: "hidden", position: "relative" }}>
                  <img
                    src={customPhotoUrl}
                    alt="preview"
                    style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block" }}
                  />
                  <button
                    onClick={pickPhoto}
                    style={{
                      position: "absolute",
                      bottom: 10,
                      right: 10,
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(8px)",
                      border: "none",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "7px 14px",
                      borderRadius: 20,
                      cursor: "pointer",
                    }}
                  >
                    Изменить
                  </button>
                </div>
              ) : (
                <div className="upload-area custom-upload-area" style={{ margin: 0, padding: "28px 16px" }} onClick={pickPhoto}>
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#666" strokeWidth="1.8" strokeLinecap="round" />
                      <polyline points="17 8 12 3 7 8" stroke="#666" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" stroke="#666" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="upload-text">Нажми, чтобы загрузить</div>
                  <div className="upload-hint">JPG, PNG · до 20 МБ</div>
                </div>
              )}

              {customPhotoError ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#E24B4A" }}>{customPhotoError}</div>
              ) : null}

              <div className="flow-helper-note flow-helper-note-under-upload">
                <div>Лучше работают четкие портреты с хорошим освещением</div>
              </div>
            </div>

            <div className="custom-field">
              <div className="custom-label">Описание стиля</div>
              <textarea
                className="custom-textarea"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onFocus={(e) => {
                  const el = e.currentTarget;
                  setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
                }}
                placeholder="Опишите желаемый стиль фотосессии..."
              />
            </div>

            <div className="custom-field">
              <div className="custom-label">Соотношение сторон</div>
              <div className="ratio-grid">
                {ratioOptions.map((v) => {
                  const size = ratioRectSize(v);
                  return (
                    <button key={v} className={"ratio-chip" + (ratio === v ? " active" : "")} onClick={() => setRatio(v)}>
                      <span className="ratio-rect" style={{ width: `${size.width}px`, height: `${size.height}px` }} />
                      <span>{v}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flow-bottom-bar flow-bottom-bar-inline flow-bottom-bar-with-note">
            <button
              className={"flow-btn " + (canCreateCustom ? "purple" : "disabled")}
              disabled={!canCreateCustom}
              onClick={() => onContinue({
                modelId: customModel,
                prompt: customPrompt,
                aspectRatio: ratio,
                sourceTab: "custom",
                photoFile: customPhoto,
              })}
            >
              Создать
            </button>
          </div>
        </>
      )}
    </div>
  );
}
