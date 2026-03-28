import { useEffect, useMemo, useState } from "react";

import type { StyleItem } from "../data/styles";

interface QueueItem { title: string; detail: string; }

interface HomeScreenProps {
  styles: StyleItem[];
  queueItem?: QueueItem | null;
  onPreviewStyle: (style: StyleItem) => void;
}

const CATEGORY_ORDER = ["Тренды", "Бизнес и карьера", "Лайфстайл", "Арт и креатив", "Особый повод"];

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="13" r="4" stroke="#666" strokeWidth="1.5" />
    </svg>
  );
}

export function HomeScreen({ styles, queueItem, onPreviewStyle }: HomeScreenProps) {
  const byCategory = useMemo(() => styles.reduce<Record<string, StyleItem[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {}), [styles]);

  const categories = useMemo(() => {
    const ordered = CATEGORY_ORDER.filter((c) => byCategory[c]);
    Object.keys(byCategory).forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered;
  }, [byCategory]);

  const [activeCategory, setActiveCategory] = useState("ВСЕ");

  useEffect(() => {
    if (!categories.length) {
      setActiveCategory("ВСЕ");
      return;
    }
    if (activeCategory === "ВСЕ") return;
    if (!categories.includes(activeCategory)) {
      setActiveCategory("ВСЕ");
    }
  }, [categories, activeCategory]);

  const activeStyles = activeCategory === "ВСЕ"
    ? styles
    : (byCategory[activeCategory] || []);

  return (
    <section className="screen home-screen">
      {queueItem ? (
        <div className="queue-single">
          <div className="queue-thumb"><CameraIcon /></div>
          <div className="queue-info">
            <div className="queue-title">{queueItem.title}</div>
            <div className="queue-detail">{queueItem.detail}</div>
          </div>
          <div className="queue-dots"><span /><span /><span /></div>
        </div>
      ) : null}

      <div className="home-sticky-header">
        <div className="category-tabs-row">
          <button
            className={"category-tab-link" + (activeCategory === "ВСЕ" ? " active" : "")}
            onClick={() => setActiveCategory("ВСЕ")}
          >
            ВСЕ
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={"category-tab-link" + (activeCategory === category ? " active" : "")}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="styles-grid-2">
        {activeStyles.map((style) => (
          <button key={style.id} className="style-card style-card-grid" onClick={() => onPreviewStyle(style)}>
            <div className="style-preview" style={{ background: style.gradient }}>
              {style.is_trending ? <span className="style-tag fire">Hot</span> : null}
              {style.is_new ? <span className="style-tag new">New</span> : null}
              <div className="style-overlay">
                <div className="style-name">{style.name}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ height: 20 }} />
    </section>
  );
}
