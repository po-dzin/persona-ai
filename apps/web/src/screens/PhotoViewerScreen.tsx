import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";

interface PhotoViewerScreenProps {
  isOpen: boolean;
  photo: PhotoRecord | null;
  style?: StyleItem;
  isFavorite: boolean;
  onClose: () => void;
  onSendToTelegram: () => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onShare: () => void;
  onUseAsReference: () => void;
}

export function PhotoViewerScreen({
  isOpen,
  photo,
  style,
  isFavorite,
  onClose,
  onSendToTelegram,
  onToggleFavorite,
  onDownload,
  onShare,
  onUseAsReference,
}: PhotoViewerScreenProps) {
  if (!isOpen || !photo) return null;
  const prompt = photo.prompt || "Промпт недоступен";
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Clipboard may be unavailable in some webviews.
    }
  };

  return (
    <div className="overlay-screen">
      <div className="flow-top">
        <button className="flow-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flow-title">Фото</div>
        <div className="flow-step" />
      </div>
      <div className="viewer-photo" style={{ background: style?.gradient || "linear-gradient(145deg, #2A2A2A, #3A3A3A)" }}>
        {photo.result_url ? (
          <img
            src={photo.result_url}
            alt={style?.name || photo.style_code}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <button className="viewer-heart" onClick={onToggleFavorite}>
          {isFavorite ? "❤" : "♡"}
        </button>
        <div className="photo-style-label">{style?.name || photo.style_code}</div>
      </div>
      <div className="viewer-body">
        <div className="viewer-prompt-block">
          <div className="viewer-prompt-label">Запрос</div>
          <div className="viewer-prompt-text">{prompt}</div>
          <button className="viewer-btn" style={{ marginTop: 10 }} onClick={handleCopyPrompt}>
            Копировать промпт
          </button>
        </div>
        <div className="viewer-actions">
          <button className="viewer-btn secondary" onClick={onShare}>В Stories</button>
          <button className="viewer-btn primary" onClick={onDownload}>Скачать</button>
          <button className="viewer-btn secondary" onClick={onSendToTelegram}>В Telegram</button>
          <button className="viewer-btn secondary" onClick={onUseAsReference}>Использовать</button>
        </div>
        <button className="viewer-btn" style={{ width: "100%", marginTop: 8 }} onClick={onShare}>Поделиться</button>
      </div>
    </div>
  );
}
