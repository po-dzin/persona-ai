import { useMemo, useState } from "react";

import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";

interface PhotosScreenProps {
  photos: PhotoRecord[];
  styles: StyleItem[];
  onOpenPhoto: (photo: PhotoRecord) => void;
}

export function PhotosScreen({ photos, styles, onOpenPhoto }: PhotosScreenProps) {
  const [filter, setFilter] = useState("Все");
  const queuedCount = photos.filter((p) => p.status === "queued" || p.status === "processing").length;
  const styleByCode = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s])), [styles]);
  const filterItems = useMemo(() => ["Все", ...styles.map((s) => s.name)], [styles]);

  const filtered = photos.filter((p) => {
    if (filter === "Все") return true;
    return styleByCode[p.style_code]?.name === filter;
  });

  return (
    <section className="screen">
      <div className="top-bar"><div className="top-bar-title">Мои фото</div></div>

      {queuedCount > 0 ? (
        <div className="queue-single">
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
      ) : null}

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
          {filtered.map((photo) => {
            const style = styleByCode[photo.style_code];
            const isLoading = photo.status === "queued" || photo.status === "processing";
            const bg = style?.gradient || "linear-gradient(145deg, #2A2A2A, #3A3A3A)";
            return (
              <button
                key={photo.order_id}
                className="photo-item"
                onClick={() => onOpenPhoto(photo)}
                disabled={isLoading}
              >
                <div className="photo-bg" style={{ background: bg }} />
                {isLoading ? (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <div className="queue-dots"><span /><span /><span /></div>
                    <div style={{ fontSize: 10, color: "#555", fontWeight: 500 }}>Генерация</div>
                  </div>
                ) : (
                  <div className="photo-style-label">{style?.name || photo.style_code}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ height: 20 }} />
    </section>
  );
}
