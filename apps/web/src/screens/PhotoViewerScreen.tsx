import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";

interface PhotoViewerScreenProps {
  isOpen: boolean;
  photo: PhotoRecord | null;
  style?: StyleItem;
  onClose: () => void;
}

export function PhotoViewerScreen({ isOpen, photo, style, onClose }: PhotoViewerScreenProps) {
  if (!isOpen || !photo) return null;

  return (
    <div className="overlay-screen">
      <div className="flow-top">
        <button onClick={onClose}>←</button>
        <div className="flow-title">Фото</div>
        <div className="flow-step">Viewer</div>
      </div>
      <div className="viewer-photo" style={{ background: style?.gradient || "linear-gradient(145deg, #2A2A2A, #3A3A3A)" }}>
        <div className="viewer-style">{style?.name || photo.style_code}</div>
      </div>
      <div className="viewer-body">
        <div>Статус: {photo.status}</div>
        <div>Model: {photo.model_id}</div>
        <div className="viewer-actions">
          <button>Скачать</button>
          <button>Поделиться</button>
          <button>В Telegram</button>
        </div>
      </div>
    </div>
  );
}
