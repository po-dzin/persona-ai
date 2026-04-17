import { useEffect, useMemo, useRef, useState } from "react";

import { ZoomableImage } from "../components/ZoomableImage";
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
  catalogLoading?: boolean;
  onSelectStyle: (style: StyleItem) => void;
  onContinue: (payload: {
    modelId: string;
    prompt: string;
    aspectRatio: string;
    sourceTab: SourceTab;
    enhancePrompt?: boolean;
    photoFile?: File | null;
  }) => void;
  onClose: () => void;
}

type ModelFamilyId = "nb2" | "nb-pro" | "flux2-pro" | "flux2-max";

const DEFAULT_STYLE_MODEL_ID = "nb2-1k";
const QUALITY_ORDER: Array<"1k" | "2k" | "4k"> = ["1k", "2k", "4k"];
const FAMILY_ORDER: ModelFamilyId[] = ["nb2", "nb-pro", "flux2-pro", "flux2-max"];
const FAMILY_LABELS: Record<ModelFamilyId, string> = {
  "nb2": "Nano Banana 2",
  "nb-pro": "Nano Banana Pro",
  "flux2-pro": "FLUX.2 Pro",
  "flux2-max": "FLUX.2 Max",
};

function parseModelId(modelId?: string | null): { family: ModelFamilyId; quality: "1k" | "2k" | "4k" } {
  const fallback = { family: "nb2" as ModelFamilyId, quality: "1k" as const };
  if (!modelId) return fallback;
  if (modelId.startsWith("nb2-")) return { family: "nb2", quality: modelId.endsWith("-4k") ? "4k" : modelId.endsWith("-2k") ? "2k" : "1k" };
  if (modelId.startsWith("nb-pro-")) return { family: "nb-pro", quality: modelId.endsWith("-4k") ? "4k" : "2k" };
  if (modelId.startsWith("flux2-pro-")) return { family: "flux2-pro", quality: modelId.endsWith("-4k") ? "4k" : modelId.endsWith("-2k") ? "2k" : "1k" };
  if (modelId.startsWith("flux2-max-")) return { family: "flux2-max", quality: modelId.endsWith("-4k") ? "4k" : modelId.endsWith("-2k") ? "2k" : "1k" };
  return fallback;
}

function buildModelId(family: ModelFamilyId, quality: "1k" | "2k" | "4k"): string {
  return `${family}-${quality}`;
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
  catalogLoading = false,
  onSelectStyle,
  onContinue,
  onClose,
}: FlowStyleScreenProps) {
  const ratioOptions = ["1:1", "9:16", "16:9", "3:4", "4:3", "2:3", "5:4", "21:9"];
  const categoryOrder = [
    "Тренды",
    "Студийный портрет",
    "Романтика и отношения",
    "Лайфстайл",
    "Праздники",
    "Семья и память",
    "Фешн",
    "Арт и креатив",
    "Бизнес и карьера",
    "Эпохи и ретро",
    "Сезоны и атмосфера",
    "Персонажи и герои",
    "Культуры и страны",
  ];
  const MAX_FILE_SIZE_MB = 20;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const [tab, setTab] = useState<SourceTab>(initialTab);
  const initialModel = parseModelId(initialCustomModelId ?? DEFAULT_STYLE_MODEL_ID);
  const [customFamily, setCustomFamily] = useState<ModelFamilyId>(initialModel.family);
  const [customQuality, setCustomQuality] = useState<"1k" | "2k" | "4k">(initialModel.quality);
  const [customPrompt, setCustomPrompt] = useState(initialCustomPrompt);
  const [ratio, setRatio] = useState("1:1");
  const [customPhoto, setCustomPhoto] = useState<File | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const [customPhotoError, setCustomPhotoError] = useState<string | null>(null);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
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
    const trending = styles.filter((style) => style.isTrending);
    const ordered = categoryOrder.filter((category) =>
      category === "Тренды" ? trending.length > 0 : grouped[category],
    );
    for (const category of Object.keys(grouped)) {
      if (!ordered.includes(category)) ordered.push(category);
    }
    return ordered.map((category) => ({
      category,
      items: category === "Тренды" ? trending : grouped[category] || [],
    }));
  }, [styles]);

  useEffect(() => {
    const opening = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!opening) return;
    setTab(initialTab);
    setCustomPrompt(initialCustomPrompt);
    const nextModel = parseModelId(initialCustomModelId ?? DEFAULT_STYLE_MODEL_ID);
    setCustomFamily(nextModel.family);
    setCustomQuality(nextModel.quality);
    setCustomPhoto(null);
    setCustomPhotoError(null);
    setEnhancePrompt(true);
    setCustomPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [isOpen, initialTab, initialCustomPrompt, initialCustomModelId]);

  const pickPhoto = () => inputRef.current?.click();

  const availableQualityOptions = useMemo(() => {
    const available = new Set(
      models
        .filter((model) => model.id.startsWith(`${customFamily}-`))
        .map((model) => parseModelId(model.id).quality),
    );
    return QUALITY_ORDER.filter((quality) => available.has(quality));
  }, [customFamily, models]);

  const availableFamilies = useMemo(
    () =>
      FAMILY_ORDER.filter((family) =>
        models.some((model) => model.id.startsWith(`${family}-`)),
      ),
    [models],
  );

  useEffect(() => {
    if (availableFamilies.includes(customFamily)) return;
    setCustomFamily(availableFamilies[0] ?? "nb2");
  }, [availableFamilies, customFamily]);

  useEffect(() => {
    if (availableQualityOptions.includes(customQuality)) return;
    setCustomQuality(availableQualityOptions[0] ?? "1k");
  }, [availableQualityOptions, customQuality]);

  const customModelId = useMemo(() => {
    const exact = buildModelId(customFamily, customQuality);
    if (models.some((model) => model.id === exact)) return exact;
    return models.find((model) => model.id.startsWith(`${customFamily}-`))?.id ?? DEFAULT_STYLE_MODEL_ID;
  }, [customFamily, customQuality, models]);
  const customModelCost = models.find((model) => model.id === customModelId)?.coins ?? 10;

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
          {catalogLoading && stylesByCategory.length === 0
            ? (
              <div className="styles-scroll">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton skeleton-style-card" aria-hidden="true" />
                ))}
              </div>
            )
            : stylesByCategory.map((block) => (
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
                        {style.isTrending ? <span className="style-tag fire">Хит</span> : null}
                        {style.isNew ? <span className="style-tag new">Новое</span> : null}
                        <div className="style-overlay">
                          <div className="style-name">{style.name}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          }
          <div className="screen-section-gap-sm" />
        </>
      ) : (
        <>
          <div className="custom-content">
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
                  <ZoomableImage
                    src={customPhotoUrl}
                    alt="preview"
                    className="custom-upload-preview-image"
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
              <button
                type="button"
                className={"enhancer-toggle" + (enhancePrompt ? " active" : "")}
                role="switch"
                aria-checked={enhancePrompt}
                aria-label="Улучшение промпта"
                onClick={() => setEnhancePrompt((prev) => !prev)}
              >
                <span className="enhancer-toggle-copy">
                  <span className="enhancer-toggle-title">Улучшение промпта</span>
                  <span className="enhancer-toggle-subtitle">
                    {enhancePrompt ? "Включено: структурирует и стабилизирует промпт" : "Выключено: отправляется исходный промпт"}
                  </span>
                </span>
                <span className={"enhancer-toggle-track" + (enhancePrompt ? " active" : "")}>
                  <span className="enhancer-toggle-thumb" />
                </span>
              </button>
            </div>

            <div className="custom-field custom-field-relative">
              <label className="custom-label" htmlFor="custom-model-family">Модель</label>
              <select
                id="custom-model-family"
                className="custom-select"
                value={customFamily}
                onChange={(e) => setCustomFamily(e.target.value as ModelFamilyId)}
              >
                {availableFamilies.map((family) => (
                  <option key={family} value={family}>
                    {FAMILY_LABELS[family]}
                  </option>
                ))}
              </select>
              <label className="custom-label custom-label-secondary" htmlFor="custom-model-quality">Качество</label>
              <select
                id="custom-model-quality"
                className="custom-select"
                value={customQuality}
                onChange={(e) => setCustomQuality(e.target.value as "1k" | "2k" | "4k")}
              >
                {availableQualityOptions.map((quality) => (
                  <option key={quality} value={quality}>
                    {quality}
                  </option>
                ))}
              </select>
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
            <div className="custom-cost">
              <span>Стоимость: <strong>{customModelCost} 🪙</strong></span>
            </div>
            <button
              className={"flow-btn " + (canCreateCustom ? "purple" : "disabled")}
              disabled={!canCreateCustom || isCreating}
              onClick={() => onContinue({
                modelId: customModelId,
                prompt: customPrompt,
                aspectRatio: ratio,
                sourceTab: "custom",
                enhancePrompt,
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
