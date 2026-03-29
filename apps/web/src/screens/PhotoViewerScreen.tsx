import { useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div className="overlay-screen" onClick={menuOpen ? () => setMenuOpen(false) : undefined}>
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
          <div className="viewer-prompt-header">
            <div className="viewer-prompt-label">Запрос</div>
            <button className="viewer-copy-btn" onClick={handleCopyPrompt} title="Копировать промпт">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="viewer-prompt-text">{prompt}</div>
        </div>

        <div className="viewer-actions-row">
          <button className="viewer-btn primary viewer-download-btn" onClick={onDownload}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Скачать
          </button>
          <button className="viewer-icon-btn" onClick={onShare} title="Поделиться">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="viewer-menu-wrap">
            <button
              className="viewer-icon-btn"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              title="Действия"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
              </svg>
            </button>
            {menuOpen ? (
              <div className="viewer-menu" onClick={(e) => e.stopPropagation()}>
                <button className="viewer-menu-item" onClick={() => { onShare(); setMenuOpen(false); }}>
                  В Stories
                </button>
                <button className="viewer-menu-item" onClick={() => { onSendToTelegram(); setMenuOpen(false); }}>
                  В Telegram
                </button>
                <button className="viewer-menu-item" onClick={() => { onUseAsReference(); setMenuOpen(false); }}>
                  Использовать как референс
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
