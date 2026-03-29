import { useMemo, useState } from "react";

import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";

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
  const queuedCount = photos.filter((p) => p.status === "queued" || p.status === "processing").length;
  const styleByCode = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s])), [styles]);
  const filterItems = useMemo(() => ["Все", "Избранное", ...styles.map((s) => s.name)], [styles]);

  const filtered = photos.filter((p) => {
    if (filter === "Все") return true;
    if (filter === "Избранное") return favorites.has(p.order_id);
    return styleByCode[p.style_code]?.name === filter;
  });

  const datedItems = filtered.map((photo, index) => {
    const currentLabel = dateLabel(photo.created_at);
    const previous = filtered[index - 1];
    const previousLabel = previous ? dateLabel(previous.created_at) : null;
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="13" r="4" stroke="#666" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="queue-info">
              <div className="queue-title">В очереди</div>
              <div className="queue-detail">{queuedCount} генерации</div>
            </div>
            <div className="queue-dots"><span /><span /><span /></div>
          </div>
        </div>
      ) : null}

      {queuedCount === 1 ? (() => {
        const activePhoto = photos.find((p) => p.status === "queued" || p.status === "processing")!;
        const activeStyle = styleByCode[activePhoto.style_code];
        return (
          <div className="queue-single">
            <div className="queue-thumb">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="13" r="4" stroke="#666" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="queue-info">
              <div className="queue-title">{activeStyle?.name || activePhoto.style_code}</div>
              <div className="queue-detail">Генерация</div>
            </div>
            <div className="queue-dots"><span /><span /><span /></div>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 15l5-5 4 4 3-3 6 6"/>
          </svg>
          <span>Пока нет фото</span>
        </div>
      ) : (
        <div className="photos-grid">
          {datedItems.map(({ photo, showDivider, dividerLabel }) => {
            const style = styleByCode[photo.style_code];
            const isLoading = photo.status === "queued" || photo.status === "processing";
            const bg = style?.gradient || "linear-gradient(145deg, #2A2A2A, #3A3A3A)";
            return (
              <div key={photo.order_id} style={{ display: "contents" }}>
                {showDivider ? <div className="photo-date-divider">{dividerLabel}</div> : null}
                <button
                  className="photo-item"
                  onClick={() => onOpenPhoto(photo)}
                  disabled={isLoading}
                >
                  {photo.result_url && !isLoading ? (
                    <img
                      className="photo-bg"
                      src={photo.result_url}
                      alt={style?.name || photo.style_code}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div className="photo-bg" style={{ background: bg }} />
                  )}
                  {isLoading ? (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <div className="queue-dots"><span /><span /><span /></div>
                      <div style={{ fontSize: 10, color: "#555", fontWeight: 500 }}>Генерация</div>
                    </div>
                  ) : (
                    <div className="photo-style-label">{style?.name || photo.style_code}</div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ height: 20 }} />
    </section>
  );
}
