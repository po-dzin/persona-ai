import { useEffect, useMemo, useRef, useState } from "react";

import type { AIModel } from "../data/models";
import type { StyleItem } from "../data/styles";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { readMotionTokenMs } from "../utils/motionTokens";
import type { SourceTab } from "../../../../shared/contracts/ui";

interface FlowStyleScreenProps {
  isOpen: boolean;
  styles: StyleItem[];
  models: AIModel[];
  selectedStyle: StyleItem | null;
  initialTab?: SourceTab;
  initialCustomPrompt?: string;
  initialCustomModelId?: string;
  isCreating?: boolean;
  onSelectStyle: (style: StyleItem) => void;
  onContinue: (payload: {
    modelId: string;
    prompt: string;
    aspectRatio: string;
    sourceTab: SourceTab;
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
  isCreating = false,
  onSelectStyle,
  onContinue,
  onClose,
}: FlowStyleScreenProps) {
  const ratioOptions = ["1:1", "9:16", "16:9", "3:4", "4:3", "2:3", "5:4", "21:9"];
  const categoryOrder = ["Тренды", "Бизнес и карьера", "Лайфстайл", "Арт и креатив", "Особый повод"];
  const MAX_FILE_SIZE_MB = 20;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const [tab, setTab] = useState<SourceTab>(initialTab);
  const [customModel, setCustomModel] = useState(initialCustomModelId ?? "nano-banana-v1");
  const [customPrompt, setCustomPrompt] = useState(initialCustomPrompt);
  const [ratio, setRatio] = useState("1:1");
  const [customPhoto, setCustomPhoto] = useState<File | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const [customPhotoError, setCustomPhotoError] = useState<string | null>(null);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const promptRevealDelayMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-fast", 150)),
    [prefersReducedMotion],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

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
    const opening = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!opening) return;
    setTab(initialTab);
    setCustomPrompt(initialCustomPrompt);
    setCustomModel(initialCustomModelId ?? "nano-banana-v1");
    setCustomPhoto(null);
    setCustomPhotoError(null);
    setCustomPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [isOpen, initialTab, initialCustomPrompt, initialCustomModelId]);

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
  const ensurePromptVisible = (el: HTMLTextAreaElement) => {
    const reveal = () => {
      const scroller = el.closest(".overlay-screen") as HTMLElement | null;
      if (!scroller) return;
      const vv = window.visualViewport;
      const keyboardInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      const safeBottom = 52 + keyboardInset + 16;
      const rect = el.getBoundingClientRect();
      const targetBottom = window.innerHeight - safeBottom;
      const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
      if (rect.bottom > targetBottom) {
        scroller.scrollBy({ top: rect.bottom - targetBottom + 12, behavior });
      } else {
        el.scrollIntoView({ behavior, block: "center" });
      }
    };
    if (promptRevealDelayMs <= 0) {
      reveal();
      return;
    }
    window.setTimeout(reveal, promptRevealDelayMs);
  };

  return (
    <div className={"overlay-screen" + (tab === "custom" && isPromptFocused ? " overlay-screen-keyboard-active" : "")}>
      <div className="flow-top flow-top-create">
        <div className="flow-step" />
        <div className="flow-title">Создать</div>
        <div className="flow-step" />
      </div>

      <div className="flow-tabs">
        <button className={"flow-tab" + (tab === "styles" ? " active" : "")} onClick={() => setTab("styles")} aria-pressed={tab === "styles"}>Стили</button>
        <button className={"flow-tab" + (tab === "custom" ? " active" : "")} onClick={() => setTab("custom")} aria-pressed={tab === "custom"}>Кастом</button>
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
                    aria-label={style.name}
                    aria-pressed={selectedStyle?.id === style.id}
                  >
                    <div className="style-preview" style={{ background: style.gradient }}>
                      {style.isTrending ? <span className="style-tag fire">Hot</span> : null}
                      {style.isNew ? <span className="style-tag new">New</span> : null}
                      <div className="style-overlay">
                        <div className="style-name">{style.name}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="screen-section-gap-sm" />
        </>
      ) : (
        <>
          <div className="custom-content">
            <div className="custom-field custom-field-relative">
              <div className="custom-label">Модель</div>
              <button
                className="model-trigger"
                onClick={() => setModelDropOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={modelDropOpen}
              >
                <span>{models.find((m) => m.id === customModel)?.name ?? customModel} — {models.find((m) => m.id === customModel)?.coins ?? 10} 🪙</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={"model-trigger-chevron" + (modelDropOpen ? " open" : "")}>
                  <path d="M6 9l6 6 6-6" stroke="var(--sem-color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {modelDropOpen && (
                <div className="model-dropdown" role="listbox">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      className={"model-dropdown-item" + (m.id === customModel ? " selected" : "")}
                      role="option"
                      aria-selected={m.id === customModel}
                      onClick={() => { setCustomModel(m.id); setModelDropOpen(false); }}
                    >
                      <span>{m.name} — {m.coins} 🪙</span>
                      {m.id === customModel ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 13l4 4L19 7" stroke="var(--sem-color-accent-light)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="custom-field">
              <div className="custom-label">Фото</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden-file-input"
                  onChange={handleCustomFile}
                />

              {customPhotoUrl ? (
                <div className="upload-area custom-upload-area custom-upload-preview-shell">
                  <img
                    src={customPhotoUrl}
                    alt="preview"
                    className="fill-image-contain custom-upload-preview-image"
                  />
                  <button
                    onClick={pickPhoto}
                    className="upload-preview-edit-btn upload-preview-edit-btn-sm"
                  >
                    Изменить
                  </button>
                </div>
              ) : (
                <div className="upload-area custom-upload-area custom-upload-empty-shell" onClick={pickPhoto}>
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.8" strokeLinecap="round" />
                      <polyline points="17 8 12 3 7 8" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="upload-text">Нажми, чтобы загрузить</div>
                  <div className="upload-hint">JPG, PNG · до 20 МБ</div>
                </div>
              )}

              {customPhotoError ? (
                <div className="form-error-inline form-error-inline-compact">{customPhotoError}</div>
              ) : null}

              <div className="flow-helper-note flow-helper-note-under-upload">
                <div>Лучше работают четкие портреты с хорошим освещением</div>
              </div>
            </div>

            <div className={"custom-field custom-field-prompt" + (isPromptFocused ? " is-focused" : "")}>
              <div className="custom-label">Описание стиля</div>
              <textarea
                className="custom-textarea"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onFocus={(e) => {
                  setIsPromptFocused(true);
                  ensurePromptVisible(e.currentTarget);
                }}
                onBlur={() => setIsPromptFocused(false)}
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
              disabled={!canCreateCustom || isCreating}
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
