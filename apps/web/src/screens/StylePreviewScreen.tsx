import { useMemo, useRef } from "react";
import type { StyleItem } from "../data/styles";

interface StylePreviewScreenProps {
  isOpen: boolean;
  styles: StyleItem[];
  style: StyleItem | null;
  onClose: () => void;
  onSelectStyle: (style: StyleItem) => void;
  onCreate: () => void;
}

export function StylePreviewScreen({ isOpen, styles, style, onClose, onSelectStyle, onCreate }: StylePreviewScreenProps) {
  if (!isOpen || !style) return null;

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const SWIPE_X_THRESHOLD = 56;
  const SWIPE_Y_THRESHOLD = 64;
  const currentIndex = useMemo(() => styles.findIndex((item) => item.id === style.id), [styles, style.id]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (dy > SWIPE_Y_THRESHOLD && absDy > absDx * 1.15) {
      onClose();
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    if (absDx >= SWIPE_X_THRESHOLD && absDx > absDy * 1.1 && currentIndex >= 0) {
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextStyle = styles[nextIndex];
      if (nextStyle) onSelectStyle(nextStyle);
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="overlay-screen style-preview-screen">
      <div
        className="style-preview-hero"
        style={{ background: style.gradient }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        <div className="style-preview-top">
          <button className="flow-back" onClick={onClose} aria-label="Назад">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="style-preview-name-top">{style.name}</div>
        </div>

        <button className="style-preview-go-center" onClick={onCreate} aria-label="Создать в этом стиле">
          <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>


      </div>
    </div>
  );
}
