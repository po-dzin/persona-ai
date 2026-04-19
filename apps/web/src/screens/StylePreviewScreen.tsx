import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleItem } from "../data/styles";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { readMotionTokenMs } from "../utils/motionTokens";

interface StylePreviewScreenProps {
  isOpen: boolean;
  styles: StyleItem[];
  style: StyleItem | null;
  onClose: () => void;
  onSelectStyle: (style: StyleItem) => void;
  onCreate: () => void;
}

export function StylePreviewScreen({ isOpen, styles, style, onClose, onSelectStyle, onCreate }: StylePreviewScreenProps) {
  const initialStyle = style ?? styles[0] ?? null;
  const [activeStyle, setActiveStyle] = useState<StyleItem | null>(initialStyle);
  const [pendingStyle, setPendingStyle] = useState<StyleItem | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"next" | "prev" | null>(null);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closeReason, setCloseReason] = useState<"button" | "pull">("button");
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const swipeDurationMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-swipe", 280)),
    [prefersReducedMotion],
  );
  const closeDurationMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-enter", 180)),
    [prefersReducedMotion],
  );
  const SWIPE_X_THRESHOLD = 56;
  const SWIPE_Y_THRESHOLD = 64;
  const currentIndex = useMemo(
    () => (activeStyle ? styles.findIndex((item) => item.id === activeStyle.id) : -1),
    [styles, activeStyle],
  );
  const gradientClassByValue = useMemo(
    () => ({
      "var(--sem-gradient-style-violet)": "style-preview-gradient-violet",
      "var(--sem-gradient-style-amber)": "style-preview-gradient-amber",
      "var(--sem-gradient-style-indigo)": "style-preview-gradient-indigo",
      "var(--sem-gradient-style-rose)": "style-preview-gradient-rose",
      "var(--sem-gradient-style-cyan)": "style-preview-gradient-cyan",
      "var(--sem-gradient-style-magenta)": "style-preview-gradient-magenta",
      "var(--sem-gradient-style-green)": "style-preview-gradient-green",
      "var(--sem-gradient-style-gold)": "style-preview-gradient-gold",
    }),
    [],
  );
  const resolveGradientClass = (styleItem: StyleItem | null) => {
    if (!styleItem) return "style-preview-gradient-violet";
    return gradientClassByValue[styleItem.gradient as keyof typeof gradientClassByValue] ?? "style-preview-gradient-violet";
  };

  useEffect(() => {
    if (!isOpen) return;
    if (style && !activeStyle) {
      setActiveStyle(style);
      return;
    }
    if (isSwipeAnimating || isClosing) return;
    if (style && activeStyle && style.id !== activeStyle.id) setActiveStyle(style);
  }, [isOpen, style, activeStyle, isSwipeAnimating, isClosing]);

  useEffect(() => {
    return () => {
      if (swipeTimerRef.current) window.clearTimeout(swipeTimerRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const requestClose = (reason: "button" | "pull") => {
    if (isClosing) return;
    setCloseReason(reason);
    setIsClosing(true);
    if (closeDurationMs <= 0) {
      onClose();
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, closeDurationMs);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSwipeAnimating || isClosing) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isSwipeAnimating || isClosing) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (dy > SWIPE_Y_THRESHOLD && absDy > absDx * 1.15) {
      requestClose("pull");
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    if (absDx >= SWIPE_X_THRESHOLD && absDx > absDy * 1.1 && currentIndex >= 0) {
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextStyle = styles[nextIndex];
      if (nextStyle) {
        setPendingStyle(nextStyle);
        setSwipeDirection(dx < 0 ? "next" : "prev");
        setIsSwipeAnimating(true);
        if (swipeDurationMs <= 0) {
          setActiveStyle(nextStyle);
          setPendingStyle(null);
          setSwipeDirection(null);
          setIsSwipeAnimating(false);
          onSelectStyle(nextStyle);
        } else {
          swipeTimerRef.current = window.setTimeout(() => {
            setActiveStyle(nextStyle);
            setPendingStyle(null);
            setSwipeDirection(null);
            setIsSwipeAnimating(false);
            onSelectStyle(nextStyle);
          }, swipeDurationMs);
        }
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const panelClass = isSwipeAnimating
    ? `style-preview-panel is-active ${swipeDirection === "next" ? "is-outgoing-next" : "is-outgoing-prev"}`
    : "style-preview-panel is-active";

  const incomingClass = swipeDirection === "next"
    ? "style-preview-panel is-incoming is-incoming-right"
    : "style-preview-panel is-incoming is-incoming-left";

  const screenClass = [
    "overlay-screen style-preview-screen",
    isClosing ? (closeReason === "pull" ? "is-closing-pull" : "is-closing-button") : "",
  ].filter(Boolean).join(" ");

  if (!isOpen || !style || !activeStyle) return null;

  return (
    <div className={screenClass}>
      <div
        className="style-preview-hero"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="style-preview-stage">
          <div className={`${panelClass} ${resolveGradientClass(activeStyle)}`}>
            <div className="style-preview-top">
              <button className="flow-back" onClick={() => requestClose("button")} aria-label="Назад">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="style-preview-name-top">{activeStyle.name}</div>
            </div>

            <button className="style-preview-go-center" onClick={onCreate} aria-label="Создать в этом стиле">
              <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          {pendingStyle ? (
            <div className={`${incomingClass} ${resolveGradientClass(pendingStyle)}`}>
              <div className="style-preview-top">
                <button className="flow-back" onClick={() => requestClose("button")} aria-label="Назад">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="style-preview-name-top">{pendingStyle.name}</div>
              </div>

              <button className="style-preview-go-center" onClick={onCreate} aria-label="Создать в этом стиле">
                <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
