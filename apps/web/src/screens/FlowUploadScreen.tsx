import { useEffect, useRef, useState } from "react";

import type { StyleItem } from "../data/styles";

interface FlowUploadScreenProps {
  isOpen: boolean;
  selectedStyle: StyleItem | null;
  prompt: string;
  aspectRatio: string;
  isSubmitting: boolean;
  cost?: number;
  showPromptBlock?: boolean;
  initialPhotoFile?: File | null;
  onGenerate: (photoFile: File | null) => void;
  onBack: () => void;
}

export function FlowUploadScreen({
  isOpen, selectedStyle, prompt, aspectRatio,
  isSubmitting, cost = 10, showPromptBlock = true, initialPhotoFile = null, onGenerate, onBack,
}: FlowUploadScreenProps) {
  const MAX_FILE_SIZE_MB = 20;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickPhoto = () => inputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = (file.type || "").toLowerCase();
    if (!["image/jpeg", "image/png"].includes(mime)) {
      setValidationError("Поддерживаются только JPG и PNG");
      setPhoto(null);
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
        setPhotoUrl(null);
      }
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(`Файл слишком большой. Максимум ${MAX_FILE_SIZE_MB} МБ`);
      setPhoto(null);
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
        setPhotoUrl(null);
      }
      return;
    }
    setValidationError(null);
    setPhoto(file);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  };



  useEffect(() => {
    if (!isOpen || !initialPhotoFile) return;
    const mime = (initialPhotoFile.type || "").toLowerCase();
    if (!["image/jpeg", "image/png"].includes(mime)) return;
    if (initialPhotoFile.size > MAX_FILE_SIZE_BYTES) return;

    setValidationError(null);
    setPhoto(initialPhotoFile);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(initialPhotoFile));
  }, [isOpen, initialPhotoFile]);

  if (!isOpen) return null;

  return (
    <div className="overlay-screen">
      {/* Header */}
      <div className="flow-top">
        <button className="flow-back" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flow-title">Загрузить фото</div>
        <div className="flow-step">2/2</div>
      </div>

      {/* Selected style + model chip */}
      <div className="upload-selected-style">
        <div
          className="upload-style-thumb"
          style={{ background: selectedStyle?.gradient || "#2A2A2A" }}
        />
        <div>
          <div className="upload-style-name">{selectedStyle?.name || "Кастом"}</div>
          <div className="upload-style-label">Выбранный стиль</div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {/* Upload area / photo preview */}
      {photoUrl ? (
        <div className="upload-area" style={{ border: "none", padding: 0, margin: "16px 20px 0", borderRadius: 20, overflow: "hidden", position: "relative" }}>
          <img
            src={photoUrl}
            alt="preview"
            style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }}
          />
          <button
            onClick={pickPhoto}
            style={{
              position: "absolute", bottom: 12, right: 12,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
              border: "none", color: "white", fontSize: 12, fontWeight: 600,
              padding: "7px 14px", borderRadius: 20, cursor: "pointer",
            }}
          >
            Изменить
          </button>
        </div>
      ) : (
        <div className="upload-area" onClick={pickPhoto}>
          <div className="upload-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#666" strokeWidth="1.8" strokeLinecap="round"/>
              <polyline points="17 8 12 3 7 8" stroke="#666" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="#666" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="upload-text">Загрузить фото</div>
          <div className="upload-hint">JPG, PNG · до 20 МБ</div>
        </div>
      )}

      {validationError ? (
        <div style={{ margin: "10px 20px 0", fontSize: 12, color: "#E24B4A" }}>
          {validationError}
        </div>
      ) : null}

      {/* Prompt preview */}
      {showPromptBlock && (prompt || selectedStyle?.prompt_template) ? (
        <div style={{ margin: "12px 20px 0", background: "#1A1A1A", borderRadius: 12, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Промпт</div>
          <div style={{ fontSize: 12, color: "#AAA", lineHeight: 1.5 }}>
            {prompt || selectedStyle?.prompt_template}
          </div>
          <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
            Формат: {aspectRatio}
          </div>
        </div>
      ) : null}

      {/* Generate button */}
      <div className="flow-bottom-bar flow-bottom-bar-with-note">
        <div className="custom-cost">Стоимость: <strong>{cost} 🪙</strong></div>
        <button
          className={"flow-btn " + (photo && !isSubmitting ? "purple" : "disabled")}
          disabled={!photo || isSubmitting || Boolean(validationError)}
          onClick={() => onGenerate(photo)}
        >
          {isSubmitting ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <span className="queue-dots" style={{ display: "inline-flex", gap: 4 }}>
                <span /><span /><span />
              </span>
              Генерация...
            </span>
          ) : "Создать"}
        </button>
        <div className="flow-helper-note">
          <div>Лучше работают четкие портреты с хорошим освещением</div>
          <div>Итог может немного отличаться от превью</div>
          <div>Обычно 30–120 секунд</div>
        </div>
      </div>
    </div>
  );
}
