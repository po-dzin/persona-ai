import type { StyleItem } from "../data/styles";

interface CategoryScreenProps {
  isOpen: boolean;
  category: string;
  styles: StyleItem[];
  onClose: () => void;
  onPreviewStyle: (style: StyleItem) => void;
}

export function CategoryScreen({ isOpen, category, styles, onClose, onPreviewStyle }: CategoryScreenProps) {
  if (!isOpen) return null;

  const categoryStyles = styles.filter((style) => style.category === category);

  return (
    <div className="overlay-screen category-screen">
      <div className="flow-top">
        <button className="flow-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flow-title">{category}</div>
        <div className="flow-step" />
      </div>

      <div className="category-grid">
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
  );
}
