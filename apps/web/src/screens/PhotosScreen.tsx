import { useMemo, useState } from "react";

import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";
import { isGeneratingPhotoStatus } from "../utils/photoStatus";

interface PhotosScreenProps {
  photos: PhotoRecord[];
  styles: StyleItem[];
  onOpenPhoto: (photo: PhotoRecord) => void;
  favorites: Set<string>;
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
}

export function PhotosScreen({ photos, styles, onOpenPhoto, favorites }: PhotosScreenProps) {
  const [filter, setFilter] = useState("Все");
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(new Set());
  const queuedCount = photos.filter((p) => isGeneratingPhotoStatus(p.status)).length;
  const styleByCode = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s])), [styles]);
  const filterItems = useMemo(() => ["Все", "Избранное", ...styles.map((s) => s.name)], [styles]);

  const filtered = photos.filter((p) => {
    if (filter === "Все") return true;
    if (filter === "Избранное") return favorites.has(p.orderId);
    return styleByCode[p.styleCode]?.name === filter;
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
        const activePhoto = photos.find((p) => isGeneratingPhotoStatus(p.status))!;
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

      {filtered.length === 0 ? (
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
            const isLoading = isGeneratingPhotoStatus(photo.status);
            const isFailed = photo.status === "failed";
            const bg = style?.gradient || "var(--sem-gradient-photo-fallback)";
            const isImageBroken = imageErrorIds.has(photo.orderId);
            return (
              <div key={photo.orderId} className="display-contents">
                {showDivider ? <div className="photo-date-divider">{dividerLabel}</div> : null}
                <button
                  className="photo-item"
                  onClick={() => onOpenPhoto(photo)}
                  disabled={isLoading}
                  aria-label={isLoading ? "Генерация" : (style?.name || photo.styleCode)}
                >
                  {photo.resultUrl && !isLoading && !isFailed && !isImageBroken ? (
                    <img
                      className="photo-bg fill-image-cover"
                      src={photo.resultUrl}
                      alt={style?.name || photo.styleCode}
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
                  {isLoading ? (
                    <div className="photo-loading-overlay">
                      <div className="queue-dots queue-dots-running queue-dots-large"><span /><span /><span /></div>
                      <div className="photo-loading-label">Генерация</div>
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
                  ) : (
                    <div className="photo-style-label">{style?.name || photo.styleCode}</div>
                  )}
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
