import { useEffect, useMemo, useState } from "react";

import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";
import { isPhotoGenerating } from "../utils/photoStatus";

interface PhotosScreenProps {
  photos: PhotoRecord[];
  styles: StyleItem[];
  generatingOrderIds?: Set<string>;
  onOpenPhoto: (photo: PhotoRecord) => void;
  favorites: Set<string>;
  isLoading?: boolean;
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
}

export function PhotosScreen({ photos, styles, generatingOrderIds, onOpenPhoto, favorites, isLoading }: PhotosScreenProps) {
  const [filter, setFilter] = useState("Все");
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(new Set());
  const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(new Set());
  const isUiGenerating = (photo: PhotoRecord) =>
    generatingOrderIds ? generatingOrderIds.has(photo.orderId) : isPhotoGenerating(photo);
  const isWaitingImageLoad = (photo: PhotoRecord) =>
    Boolean(photo.resultUrl)
    && photo.status !== "failed"
    && !imageErrorIds.has(photo.orderId)
    && !loadedImageIds.has(photo.orderId);
  const isGeneratingCard = (photo: PhotoRecord) => isUiGenerating(photo) || isWaitingImageLoad(photo);
  const queuedCount = photos.filter((p) => isGeneratingCard(p)).length;
  const styleByCode = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s])), [styles]);
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const style of styles) {
      if (!seen.has(style.category)) {
        seen.add(style.category);
        ordered.push(style.category);
      }
    }
    return ordered;
  }, [styles]);
  const filterItems = useMemo(() => ["Все", "Избранные", ...categories], [categories]);

  const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - RETENTION_MS;
  const withinRetention = photos.filter(
    (p) => p.status !== "done" || new Date(p.createdAt).getTime() > cutoff,
  );

  const filtered = withinRetention.filter((p) => {
    if (p.status === "failed") return false;
    if (imageErrorIds.has(p.orderId)) return false;
    if (filter === "Все") return true;
    if (filter === "Избранные") return favorites.has(p.orderId);
    return styleByCode[p.styleCode]?.category === filter;
  });

  const datedItems = filtered.map((photo, index) => {
    const currentLabel = dateLabel(photo.createdAt);
    const previous = filtered[index - 1];
    const previousLabel = previous ? dateLabel(previous.createdAt) : null;
    return {
      photo,
      showDivider: currentLabel !== previousLabel,
      dividerLabel: currentLabel,
    };
  });

  useEffect(() => {
    const photoIds = new Set(photos.map((p) => p.orderId));
    setLoadedImageIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (photoIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
    setImageErrorIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (photoIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [photos]);

  return (
    <section className="screen photos-screen">
      {queuedCount > 1 ? (
        <div className="queue-stack">
          <div className="stack-back-2" />
          <div className="stack-back-1" />
          <div className="stack-front">
            <div className="stack-count">{queuedCount}</div>
            <div className="queue-thumb">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="13" r="4" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="queue-info">
              <div className="queue-title">В очереди</div>
              <div className="queue-detail">{queuedCount} генерации</div>
            </div>
            <div className="queue-dots queue-dots-running"><span /><span /><span /></div>
          </div>
        </div>
      ) : null}

      {queuedCount === 1 ? (() => {
        const activePhoto = photos.find((p) => isGeneratingCard(p))!;
        const activeStyle = styleByCode[activePhoto.styleCode];
        return (
          <div className="queue-single">
            <div className="queue-thumb">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="13" r="4" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="queue-info">
              <div className="queue-title">{activeStyle?.name || activePhoto.styleCode}</div>
              <div className="queue-detail">Генерация</div>
            </div>
            <div className="queue-dots queue-dots-running"><span /><span /><span /></div>
          </div>
        );
      })() : null}

      <div className="photos-filter">
        {filterItems.map((item) => (
          <button
            key={item}
            className={`filter-chip${filter === item ? " active" : ""}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {isLoading && photos.length === 0 ? (
        <div className="photos-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="photo-item skeleton skeleton-photo" aria-hidden="true" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="placeholder-screen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 15l5-5 4 4 3-3 6 6"/>
          </svg>
          <span>Пока нет фото</span>
        </div>
      ) : (
        <div className="photos-grid">
          {datedItems.map(({ photo, showDivider, dividerLabel }) => {
            const style = styleByCode[photo.styleCode];
            const isGenerating = isGeneratingCard(photo);
            const isFailed = photo.status === "failed";
            const bg = style?.gradient || "var(--sem-gradient-photo-fallback)";
            const isImageBroken = imageErrorIds.has(photo.orderId);
            return (
              <div key={photo.orderId} className="display-contents">
                {showDivider ? <div className="photo-date-divider">{dividerLabel}</div> : null}
                <button
                  className="photo-item"
                  onClick={() => onOpenPhoto(photo)}
                  disabled={isGenerating || isFailed || isImageBroken}
                  aria-label={isGenerating ? "Генерация" : (style?.name || photo.styleCode)}
                >
                  {photo.resultUrl && !isFailed && !isImageBroken ? (
                    <img
                      className="photo-bg fill-image-cover"
                      src={photo.resultUrl}
                      alt={style?.name || photo.styleCode}
                      onLoad={() => {
                        setLoadedImageIds((prev) => {
                          if (prev.has(photo.orderId)) return prev;
                          const next = new Set(prev);
                          next.add(photo.orderId);
                          return next;
                        });
                      }}
                      onError={() => {
                        setImageErrorIds((prev) => {
                          const next = new Set(prev);
                          next.add(photo.orderId);
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <div className="photo-bg" style={{ background: bg }} />
                  )}
                  {isGenerating ? (
                    <div className="photo-loading-overlay">
                      <div className="queue-dots queue-dots-running queue-dots-large"><span /><span /><span /></div>
                    </div>
                  ) : isFailed ? (
                    <div className="photo-failed-overlay">
                      <svg className="photo-failed-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="m9 16 6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
                        <path d="M9 10h.01M15 16h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
                      </svg>
                    </div>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="screen-tail-space" />
    </section>
  );
}
