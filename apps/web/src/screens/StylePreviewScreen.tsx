import type { StyleItem } from "../data/styles";

interface StylePreviewScreenProps {
  isOpen: boolean;
  style: StyleItem | null;
  onClose: () => void;
  onCreate: () => void;
}

export function StylePreviewScreen({ isOpen, style, onClose, onCreate }: StylePreviewScreenProps) {
  if (!isOpen || !style) return null;

  return (
    <div className="overlay-screen style-preview-screen">
      <div className="style-preview-hero" style={{ background: style.gradient }}>
        <div className="style-preview-top">
          <button className="flow-back" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="style-preview-bottom">
          <div className="style-preview-title-row">
            <div className="style-preview-name">{style.name}</div>
            <button className="style-preview-go" onClick={onCreate} aria-label="Создать в этом стиле">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
