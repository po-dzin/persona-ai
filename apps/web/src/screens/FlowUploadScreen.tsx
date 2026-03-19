import type { AIModel } from "../data/models";
import type { StyleItem } from "../data/styles";

interface FlowUploadScreenProps {
  isOpen: boolean;
  selectedStyle: StyleItem | null;
  selectedModel: AIModel | null;
  prompt: string;
  aspectRatio: string;
  onGenerate: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function FlowUploadScreen({
  isOpen,
  selectedStyle,
  selectedModel,
  prompt,
  aspectRatio,
  onGenerate,
  onBack,
  isSubmitting,
}: FlowUploadScreenProps) {
  if (!isOpen) return null;

  return (
    <div className="overlay-screen">
      <div className="flow-top">
        <button onClick={onBack}>←</button>
        <div className="flow-title">Загрузи фото</div>
        <div className="flow-step">2/2</div>
      </div>

      <div className="upload-selected-style">
        <div className="upload-style-name">{selectedStyle?.name || "Кастом"}</div>
        <div className="upload-style-label">{selectedModel?.name || "Nano Banana"}</div>
      </div>

      <div className="upload-card">
        <div>Файл: JPG/PNG до 20 МБ</div>
        <div>Prompt: {prompt || selectedStyle?.prompt_template || "—"}</div>
        <div>Aspect ratio: {aspectRatio}</div>
      </div>

      <button className="flow-primary" onClick={onGenerate} disabled={isSubmitting}>
        {isSubmitting ? "Генерация..." : "Сгенерировать"}
      </button>
    </div>
  );
}
