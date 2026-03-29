import { useEffect, useState } from "react";

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
  onDeletePhoto: () => void;
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
  onDeletePhoto,
}: PhotoViewerScreenProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const url = photo?.result_url || "";
  const prompt = photo?.prompt || "Промпт недоступен";

  const closeAll = () => { setShareOpen(false); setMenuOpen(false); };

  useEffect(() => {
    if (!isOpen) {
      setPromptCopied(false);
      setImageFailed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setPromptCopied(false);
    setImageFailed(false);
  }, [photo?.order_id]);

  if (!isOpen || !photo) return null;

  const handleCopyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); } catch { /* unavailable */ }
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1400);
  };

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* unavailable */ }
    closeAll();
  };

  const handleTgStories = () => {
    window.open(`tg://stories/post?url=${encodeURIComponent(url)}`, "_blank");
    closeAll();
  };

  const handleTgDM = () => {
    onSendToTelegram();
    closeAll();
  };

  const handleInstagram = () => {
    window.open(`instagram://library`, "_blank");
    closeAll();
  };

  const handleThreads = () => {
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(url)}`, "_blank");
    closeAll();
  };

  const handleNativeShare = async () => {
    closeAll();
    try {
      if (navigator.share) {
        await navigator.share({ title: style?.name || "Persona photo", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch { /* cancelled */ }
  };

  return (
    <div className="overlay-screen" onClick={shareOpen || menuOpen ? closeAll : undefined}>
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
        {photo.result_url && !imageFailed ? (
          <img
            src={photo.result_url}
            alt={style?.name || photo.style_code}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="viewer-photo-fallback">
            <div className="viewer-photo-fallback-title">Фото недоступно</div>
            <div className="viewer-photo-fallback-subtitle">Старая или битая генерация</div>
          </div>
        )}
        <button className="viewer-heart" onClick={onToggleFavorite}>
          {isFavorite ? "❤" : "♡"}
        </button>
        <div className="photo-style-label">{style?.name || photo.style_code}</div>
      </div>

      <div className="viewer-body">
        <div className="viewer-prompt-block">
          <div className="viewer-prompt-header">
            <div className="viewer-prompt-label">Запрос</div>
            <button className={`viewer-copy-btn${promptCopied ? " copied" : ""}`} onClick={handleCopyPrompt} title="Копировать промпт">
              {promptCopied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
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

          {/* Share button with submenu */}
          <div className="viewer-menu-wrap">
            <button
              className={`viewer-icon-btn${shareOpen ? " active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShareOpen((v) => !v); }}
              title="Поделиться"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
            {shareOpen ? (
              <div className="viewer-menu viewer-share-menu" onClick={(e) => e.stopPropagation()}>
                <button className="viewer-menu-item" onClick={handleCopyLink}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  Копировать ссылку
                </button>
                <button className="viewer-menu-item" onClick={handleTgStories}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  TG Stories
                </button>
                <button className="viewer-menu-item" onClick={handleTgDM}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  Telegram
                </button>
                <button className="viewer-menu-item" onClick={handleInstagram}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>
                    </svg>
                  </span>
                  Instagram
                </button>
                <button className="viewer-menu-item" onClick={handleThreads}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M8 12a4 4 0 0 1 8 0c0 2.5-1.5 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M12 16v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  Threads
                </button>
                <button className="viewer-menu-item" onClick={handleNativeShare}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="6" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="12" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="18" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.8"/>
                    </svg>
                  </span>
                  Другие
                </button>
              </div>
            ) : null}
          </div>

          {/* 3-dot actions menu */}
          <div className="viewer-menu-wrap">
            <button
              className={`viewer-icon-btn${menuOpen ? " active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setShareOpen(false); setMenuOpen((v) => !v); }}
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
                <button className="viewer-menu-item" onClick={() => { onUseAsReference(); closeAll(); }}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M14 4h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 14L20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 14v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 20l10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  Использовать как референс
                </button>
                <button className="viewer-menu-item viewer-menu-item-danger" onClick={() => { onDeletePhoto(); closeAll(); }}>
                  <span className="vmi-icon vmi-icon-danger">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M7 6l1 14h8l1-14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 10v6M14 10v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  Удалить фото
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
