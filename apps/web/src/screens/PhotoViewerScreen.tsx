import { useEffect, useMemo, useState } from "react";

import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { readMotionTokenMs } from "../utils/motionTokens";

interface PhotoViewerScreenProps {
  isOpen: boolean;
  photo: PhotoRecord | null;
  appLink?: string;
  style?: StyleItem;
  isFavorite: boolean;
  onClose: () => void;
  onSendToTelegram: () => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onCopyLink: () => void | Promise<void>;
  onUseAsReference: () => void;
  onDeletePhoto: () => void;
}

export function PhotoViewerScreen({
  isOpen,
  photo,
  appLink = "",
  style,
  isFavorite,
  onClose,
  onSendToTelegram,
  onToggleFavorite,
  onDownload,
  onCopyLink,
  onUseAsReference,
  onDeletePhoto,
}: PhotoViewerScreenProps) {
  const SHARE_BRAND_TEXT = "Создано в PersonAI ✨";
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [telegramFallbackOpen, setTelegramFallbackOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const copyToastDurationMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-feedback-toast", 1400)),
    [prefersReducedMotion],
  );

  const url = photo?.resultUrl || "";
  const prompt = photo?.prompt || "Промпт недоступен";
  const homeAppLink = `${window.location.origin}${window.location.pathname}`;

  const closeAll = () => {
    setShareOpen(false);
    setMenuOpen(false);
    setTelegramFallbackOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setPromptCopied(false);
      setImageFailed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setPromptCopied(false);
    setImageFailed(false);
  }, [photo?.orderId]);

  if (!isOpen || !photo) return null;

  const handleCopyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); } catch { /* unavailable */ }
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), copyToastDurationMs);
  };

  const handleCopyLink = () => {
    onCopyLink();
    closeAll();
  };

  const handleTelegramShare = () => {
    void (async () => {
      // For Telegram button we require photo share. No text-only fallback.
      if (navigator.share && url) {
        try {
          const imageBlob = await fetch(url).then((r) => r.blob());
          const imageExt = imageBlob.type.includes("png") ? "png" : "jpg";
          const file = new File([imageBlob], `personai-share.${imageExt}`, { type: imageBlob.type || "image/jpeg" });
          const payload = { text: SHARE_BRAND_TEXT, url: homeAppLink, files: [file] };
          if (!navigator.canShare || navigator.canShare(payload)) {
            await navigator.share(payload);
            closeAll();
            return;
          }
        } catch {
          // fall through to bot fallback below
        }
      }
      setShareOpen(false);
      setTelegramFallbackOpen(true);
    })();
  };

  const handleTelegramLinkOnly = () => {
    const text = encodeURIComponent(SHARE_BRAND_TEXT);
    const targetUrl = `https://t.me/share/url?url=${encodeURIComponent(homeAppLink)}&text=${text}`;
    const liveTg = window.Telegram?.WebApp as { openTelegramLink?: (shareUrl: string) => void } | undefined;
    if (liveTg?.openTelegramLink) {
      liveTg.openTelegramLink(targetUrl);
    } else {
      window.open(targetUrl, "_blank");
    }
    closeAll();
  };

  const handleTelegramBotFallback = () => {
    onSendToTelegram();
    closeAll();
  };

  const handleTgStories = () => {
    window.open(`tg://stories/post?url=${encodeURIComponent(url)}`, "_blank");
    closeAll();
  };

  const handleUploadToBot = () => {
    onSendToTelegram();
    closeAll();
  };

  const handleInstagram = () => {
    const igTarget = /iPhone|iPad|Android/i.test(navigator.userAgent)
      ? "instagram://story-camera"
      : "https://www.instagram.com/create/select/";
    window.open(igTarget, "_blank");
    closeAll();
  };

  const handleThreads = () => {
    const shareText = `${SHARE_BRAND_TEXT} ${homeAppLink}`.trim();
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`, "_blank");
    closeAll();
  };

  const handleSystemShare = () => {
    void (async () => {
      try {
        const shareUrl = homeAppLink;
        if (navigator.share) {
          if (url) {
            try {
              const imageBlob = await fetch(url).then((r) => r.blob());
              const imageExt = imageBlob.type.includes("png") ? "png" : "jpg";
              const file = new File([imageBlob], `personai-share.${imageExt}`, { type: imageBlob.type || "image/jpeg" });
              const payload = { text: SHARE_BRAND_TEXT, url: shareUrl, files: [file] };
              if (!navigator.canShare || navigator.canShare(payload)) {
                await navigator.share(payload);
                closeAll();
                return;
              }
            } catch {
              // fall through to URL/text-only share
            }
          }
          await navigator.share({ text: SHARE_BRAND_TEXT, url: shareUrl });
          closeAll();
          return;
        }
      } catch {
        // fallback to app copy-link handler
      }
      onCopyLink();
      closeAll();
    })();
  };

  return (
    <div className="overlay-screen photo-viewer-screen" onClick={shareOpen || menuOpen || telegramFallbackOpen ? closeAll : undefined}>
      <div className="flow-top">
        <button className="flow-back" onClick={onClose} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flow-title">Фото</div>
        <div className="flow-step" />
      </div>

      <div className="viewer-photo" style={{ background: style?.gradient || "var(--sem-gradient-photo-fallback)" }}>
        {photo.resultUrl && !imageFailed ? (
          <img
            src={photo.resultUrl}
            alt={style?.name || photo.styleCode}
            className="fill-image-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="viewer-photo-fallback">
            <div className="viewer-photo-fallback-title">Фото недоступно</div>
            <div className="viewer-photo-fallback-subtitle">Старая или битая генерация</div>
          </div>
        )}
        <button className="viewer-heart" onClick={onToggleFavorite} aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}>
          {isFavorite ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--sem-color-danger)" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="var(--sem-color-text-inverse)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      <div className="viewer-body">
        <div className="viewer-prompt-block">
          <div className="viewer-prompt-header">
            <div className="viewer-prompt-label">Запрос</div>
            <button
              className={`viewer-copy-btn${promptCopied ? " copied" : ""}`}
              onClick={handleCopyPrompt}
              title="Копировать промпт"
              aria-label="Копировать промпт"
            >
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
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setShareOpen((v) => !v);
              }}
              aria-label="Поделиться"
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
                <button className="viewer-menu-item" onClick={handleTelegramShare}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  Telegram
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
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M9.2 9.4c.5-.8 1.5-1.4 2.8-1.4 2 0 3.6 1.3 3.9 3.2.2 1.2 0 2.5-.8 3.5-.7.9-1.8 1.5-3.1 1.5-1.8 0-3.2-1.1-3.7-2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 8v8.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                      <path d="M14.2 11.6c-.6-.4-1.3-.6-2.1-.6-1.4 0-2.5.7-3.2 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                  </span>
                  Threads
                </button>
                <button className="viewer-menu-item" onClick={handleCopyLink}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  Копировать ссылку
                </button>
                <button className="viewer-menu-item" onClick={handleUploadToBot}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  Выгрузить в бот
                </button>
                <button className="viewer-menu-item" onClick={handleSystemShare}>
                  <span className="vmi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  Другое
                </button>
              </div>
            ) : null}
          </div>

          {/* 3-dot actions menu */}
          <div className="viewer-menu-wrap">
            <button
              className={`viewer-icon-btn${menuOpen ? " active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setShareOpen(false);
                setMenuOpen((v) => !v);
              }}
              aria-label="Действия"
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
      {telegramFallbackOpen ? (
        <div className="modal-backdrop" onClick={closeAll}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="tg-fallback-title">
            <div className="modal-icon" aria-hidden="true">✨</div>
            <div className="modal-title" id="tg-fallback-title">Не удалось отправить фото</div>
            <div className="modal-desc">Выберите, как продолжить:</div>
            <button className="modal-btn primary" onClick={handleTelegramLinkOnly}>Отправить только ссылку</button>
            <button className="modal-btn primary" onClick={handleTelegramBotFallback}>Выгрузить в бот</button>
            <button className="modal-btn" onClick={closeAll}>Отмена</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
