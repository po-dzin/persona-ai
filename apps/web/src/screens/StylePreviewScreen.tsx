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
          <div className="style-preview-name-top">{style.name}</div>
        </div>

        <button className="style-preview-go-center" onClick={onCreate} aria-label="Создать в этом стиле">
          <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

      </div>
    </div>
  );
}
