import { useState } from "react";

import type { StyleItem } from "../data/styles";

interface QueueItem { title: string; detail: string; }

interface HomeScreenProps {
  styles: StyleItem[];
  queueItem?: QueueItem | null;
  onPreviewStyle: (style: StyleItem) => void;
}

const CATEGORY_ORDER = ["Тренды", "Бизнес и карьера", "Лайфстайл", "Арт и креатив", "Особый повод"];

function ChevronIcon() {
  return (
    <svg className="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="13" r="4" stroke="#666" strokeWidth="1.5"/>
    </svg>
  );
}

export function HomeScreen({ styles, queueItem, onPreviewStyle }: HomeScreenProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    "Лайфстайл": true, "Арт и креатив": true, "Особый повод": true,
  });

  const toggle = (category: string) => {
    setCollapsed(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const byCategory = styles.reduce<Record<string, StyleItem[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const categories = CATEGORY_ORDER.filter(c => byCategory[c]);
  Object.keys(byCategory).forEach(c => { if (!categories.includes(c)) categories.push(c); });

  return (
    <section className="screen">
      <div className="top-bar"><div className="logo">Persona</div></div>

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

      {categories.map((category) => {
        const categoryStyles = byCategory[category] || [];
        const isCollapsed = collapsed[category] ?? false;
        return (
          <div key={category}>
            <div
              className={`section-header${isCollapsed ? " collapsed" : ""}`}
              onClick={() => toggle(category)}
            >
              <div className="section-title">{category}</div>
              <ChevronIcon />
            </div>
            <div className={`category-body${isCollapsed ? " collapsed" : ""}`}>
              <div className="styles-scroll">
                {categoryStyles.map((style) => (
                  <button key={style.id} className="style-card" onClick={() => onPreviewStyle(style)}>
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
            </div>
          </div>
        );
      })}

      <div style={{ height: 20 }} />
    </section>
  );
}
