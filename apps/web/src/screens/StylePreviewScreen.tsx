import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { StyleItem } from "../data/styles";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { readMotionTokenMs } from "../utils/motionTokens";
import {
  getHorizontalSwipeKeyframeOffsets,
  resolveGestureAxis,
  shouldActivateHorizontalSwipe,
  shouldCommitHorizontalSwipe,
  SWIPE_ACTIVATION_PX,
} from "../utils/swipeGesture";

interface StylePreviewScreenProps {
  isOpen: boolean;
  styles: StyleItem[];
  style: StyleItem | null;
  originRect?: { left: number; top: number; width: number; height: number } | null;
  onClose: () => void;
  onSelectStyle: (style: StyleItem) => void;
  onCreate: () => void;
}

export function StylePreviewScreen({ isOpen, styles, style, originRect = null, onClose, onSelectStyle, onCreate }: StylePreviewScreenProps) {
  const initialStyle = style ?? styles[0] ?? null;
  const [activeStyle, setActiveStyle] = useState<StyleItem | null>(initialStyle);
  const [pendingStyle, setPendingStyle] = useState<StyleItem | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"next" | "prev" | null>(null);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [closeReason, setCloseReason] = useState<"button" | "pull">("button");
  const [isClosingToCard, setIsClosingToCard] = useState(false);
  const [closingVars, setClosingVars] = useState<CSSProperties | null>(null);
  const [pullOffsetY, setPullOffsetY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTs = useRef<number | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef(0);
  const isHorizontalGestureRef = useRef(false);
  const isPullGestureRef = useRef(false);
  const gestureAxisRef = useRef<"none" | "x" | "y">("none");
  const openedAtRef = useRef(0);
  const [isOpeningFromCard, setIsOpeningFromCard] = useState(false);
  const [openingVars, setOpeningVars] = useState<CSSProperties | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const swipeDurationMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-swipe", 280)),
    [prefersReducedMotion],
  );
  const closeDurationMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-enter", 180)),
    [prefersReducedMotion],
  );
  const createTapGuardMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-fast", 140)),
    [prefersReducedMotion],
  );
  const SWIPE_X_THRESHOLD = 56;
  const SWIPE_Y_THRESHOLD = 64;
  const PULL_CLOSE_THRESHOLD = 110;
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
    if (!isOpen) {
      // Reset transient animation state so next open starts from a clean baseline.
      setPendingStyle(null);
      setSwipeDirection(null);
      setIsSwipeAnimating(false);
      setIsDragging(false);
      setDragOffsetPx(0);
      setIsClosing(false);
      setCloseReason("button");
      touchStartX.current = null;
      touchStartY.current = null;
      touchStartTs.current = null;
      dragOffsetRef.current = 0;
      isHorizontalGestureRef.current = false;
      isPullGestureRef.current = false;
      gestureAxisRef.current = "none";
      stageRef.current?.style.removeProperty("--style-preview-enter-from");
      stageRef.current?.style.removeProperty("--style-preview-leave-from");
      setIsOpeningFromCard(false);
      setOpeningVars(null);
      setIsClosingToCard(false);
      setClosingVars(null);
      setIsPulling(false);
      setPullOffsetY(0);
      if (swipeTimerRef.current) {
        window.clearTimeout(swipeTimerRef.current);
        swipeTimerRef.current = null;
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      return;
    }
    openedAtRef.current = performance.now();
    if (!isOpen) return;
    if (style && !activeStyle) {
      setActiveStyle(style);
      return;
    }
    if (isSwipeAnimating || isClosing || isDragging) return;
    if (style && activeStyle && style.id !== activeStyle.id) setActiveStyle(style);
  }, [isOpen, style, activeStyle, isSwipeAnimating, isClosing, isDragging]);

  useEffect(() => {
    if (!isOpen || !originRect || prefersReducedMotion) {
      setIsOpeningFromCard(false);
      setOpeningVars(null);
      return;
    }
    const shell = document.querySelector(".app-shell") as HTMLElement | null;
    if (!shell) {
      setIsOpeningFromCard(false);
      setOpeningVars(null);
      return;
    }
    const shellRect = shell.getBoundingClientRect();
    const shellCenterX = shellRect.left + shellRect.width / 2;
    const shellCenterY = shellRect.top + shellRect.height / 2;
    const originCenterX = originRect.left + originRect.width / 2;
    const originCenterY = originRect.top + originRect.height / 2;
    const tx = originCenterX - shellCenterX;
    const ty = originCenterY - shellCenterY;
    const sx = Math.max(0.08, originRect.width / Math.max(1, shellRect.width));
    const sy = Math.max(0.08, originRect.height / Math.max(1, shellRect.height));
    setOpeningVars({
      "--style-preview-origin-tx": `${tx}px`,
      "--style-preview-origin-ty": `${ty}px`,
      "--style-preview-origin-sx": String(sx),
      "--style-preview-origin-sy": String(sy),
    } as CSSProperties);
    setIsOpeningFromCard(true);
    const timer = window.setTimeout(() => setIsOpeningFromCard(false), Math.max(180, closeDurationMs));
    return () => window.clearTimeout(timer);
  }, [isOpen, originRect, prefersReducedMotion, closeDurationMs]);

  const computeCardTransformVars = (targetRect: { left: number; top: number; width: number; height: number }) => {
    const shell = document.querySelector(".app-shell") as HTMLElement | null;
    if (!shell) return null;
    const shellRect = shell.getBoundingClientRect();
    const shellCenterX = shellRect.left + shellRect.width / 2;
    const shellCenterY = shellRect.top + shellRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const tx = targetCenterX - shellCenterX;
    const ty = targetCenterY - shellCenterY;
    const sx = Math.max(0.08, targetRect.width / Math.max(1, shellRect.width));
    const sy = Math.max(0.08, targetRect.height / Math.max(1, shellRect.height));
    return {
      tx,
      ty,
      sx,
      sy,
    };
  };

  const resolveCloseTargetRect = () => {
    if (originRect) return originRect;
    if (!activeStyle) return null;
    const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(activeStyle.id)
      : activeStyle.id.replace(/"/g, "\\\"");
    const button = document.querySelector(`.style-card[data-style-id="${escapedId}"]`) as HTMLElement | null;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  };

  useEffect(() => {
    return () => {
      if (swipeTimerRef.current) window.clearTimeout(swipeTimerRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (isHorizontalGestureRef.current || isPullGestureRef.current) e.preventDefault();
    };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  const clearTouchTracking = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTs.current = null;
    dragOffsetRef.current = 0;
    isHorizontalGestureRef.current = false;
    isPullGestureRef.current = false;
    gestureAxisRef.current = "none";
    setIsDragging(false);
    setDragOffsetPx(0);
  };

  const requestClose = (reason: "button" | "pull") => {
    if (isClosing) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const closeTargetRect = resolveCloseTargetRect();
    const cardVars =
      !prefersReducedMotion && closeTargetRect ? computeCardTransformVars(closeTargetRect) : null;
    if (cardVars) {
      const pullScale = Math.max(0.84, 1 - pullOffsetY / 1400);
      setClosingVars({
        "--style-preview-origin-tx": `${cardVars.tx}px`,
        "--style-preview-origin-ty": `${cardVars.ty}px`,
        "--style-preview-origin-sx": String(cardVars.sx),
        "--style-preview-origin-sy": String(cardVars.sy),
        "--style-preview-close-from-ty": `${pullOffsetY}px`,
        "--style-preview-close-from-scale": String(reason === "pull" ? pullScale : 1),
      } as CSSProperties);
      setIsClosingToCard(true);
    } else {
      setClosingVars(null);
      setIsClosingToCard(false);
    }
    setCloseReason(reason);
    clearTouchTracking();
    setIsClosing(true);
    if (closeDurationMs <= 0) {
      onClose();
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, closeDurationMs);
  };

  const handleCreate = () => {
    if (isClosing || isSwipeAnimating) return;
    if (createTapGuardMs > 0 && performance.now() - openedAtRef.current < createTapGuardMs) return;
    onCreate();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSwipeAnimating || isClosing) return;
    clearTouchTracking();
    stageRef.current?.style.removeProperty("--style-preview-enter-from");
    stageRef.current?.style.removeProperty("--style-preview-leave-from");
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTs.current = performance.now();
    setIsPulling(false);
    setPullOffsetY(0);
    setPendingStyle(null);
    setSwipeDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSwipeAnimating || isClosing) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const canSwipeNext = currentIndex >= 0 && currentIndex < styles.length - 1;
    const canSwipePrev = currentIndex > 0;
    gestureAxisRef.current = resolveGestureAxis({
      current: gestureAxisRef.current,
      absDx,
      absDy,
      idleThresholdPx: 6,
      horizontalBiasRatio: 0.9,
    });
    if (gestureAxisRef.current === "none") return;

    if (!isHorizontalGestureRef.current && !isPullGestureRef.current) {
      if (gestureAxisRef.current === "x") {
        if (!shouldActivateHorizontalSwipe({ absDx, absDy, activationPx: SWIPE_ACTIVATION_PX, verticalToleranceRatio: 0.95 })) return;
        const direction = dx < 0 ? "next" : "prev";
        if ((direction === "next" && !canSwipeNext) || (direction === "prev" && !canSwipePrev)) return;
        const neighbor = styles[currentIndex + (direction === "next" ? 1 : -1)] ?? null;
        if (!neighbor) return;
        isHorizontalGestureRef.current = true;
        setIsDragging(true);
        setSwipeDirection(direction);
        setPendingStyle(neighbor);
        setIsPulling(false);
        setPullOffsetY(0);
      } else if (dy > 0 && absDy > absDx * 1.05) {
        isPullGestureRef.current = true;
        setIsPulling(true);
      } else {
        return;
      }
    }

    if (isHorizontalGestureRef.current) {
      e.preventDefault();
      const width = Math.max(1, stageRef.current?.clientWidth ?? heroRef.current?.clientWidth ?? 1);
      const clamped = Math.max(-width, Math.min(width, dx));
      dragOffsetRef.current = clamped;
      setDragOffsetPx(clamped);
      const direction = clamped < 0 ? "next" : "prev";
      const nextIndex = currentIndex + (direction === "next" ? 1 : -1);
      const neighbor = styles[nextIndex] ?? null;
      if (neighbor) {
        setSwipeDirection(direction);
        setPendingStyle(neighbor);
      }
      return;
    }

    if (isPullGestureRef.current && dy > 0 && absDy > absDx * 1.05) {
      e.preventDefault();
      const capped = Math.min(dy, Math.max(140, window.innerHeight * 0.72));
      isPullGestureRef.current = true;
      setIsPulling(true);
      setPullOffsetY(capped);
    }
  };

  const handleTouchCancel = () => {
    clearTouchTracking();
    if (isClosing) return;
    setPendingStyle(null);
    setSwipeDirection(null);
    setIsPulling(false);
    setPullOffsetY(0);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isSwipeAnimating || isClosing) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (isPullGestureRef.current || isPulling) {
      if (pullOffsetY >= PULL_CLOSE_THRESHOLD) {
        requestClose("pull");
      } else {
        isPullGestureRef.current = false;
        setIsPulling(false);
        setPullOffsetY(0);
      }
      clearTouchTracking();
      return;
    }

    if (!isHorizontalGestureRef.current && dy > SWIPE_Y_THRESHOLD && absDy > absDx * 1.15) {
      requestClose("pull");
      clearTouchTracking();
      return;
    }

    const swipeDx = isHorizontalGestureRef.current ? dragOffsetRef.current : dx;
    const durationMs = Math.max(1, performance.now() - (touchStartTs.current ?? performance.now()));
    const shouldCommitSwipe = currentIndex >= 0 && shouldCommitHorizontalSwipe({
      dx: swipeDx,
      dy,
      durationMs,
      commitDistancePx: SWIPE_X_THRESHOLD,
      dominantHorizontalRatio: 1 / 1.1,
    }) && (isHorizontalGestureRef.current || Math.abs(swipeDx) > absDy * 1.1);

    if (shouldCommitSwipe) {
      const direction = swipeDx < 0 ? "next" : "prev";
      const nextIndex = currentIndex + (direction === "next" ? 1 : -1);
      const nextStyle = styles[nextIndex] ?? null;
      if (nextStyle) {
        const width = Math.max(1, stageRef.current?.clientWidth ?? heroRef.current?.clientWidth ?? 1);
        const ratio = dragOffsetRef.current / width;
        const { enterFrom, leaveFrom } = getHorizontalSwipeKeyframeOffsets({ ratio, direction });
        stageRef.current?.style.setProperty("--style-preview-enter-from", enterFrom);
        stageRef.current?.style.setProperty("--style-preview-leave-from", leaveFrom);

        setPendingStyle(nextStyle);
        setSwipeDirection(direction);
        setIsSwipeAnimating(true);
        if (swipeDurationMs <= 0) {
          setActiveStyle(nextStyle);
          setPendingStyle(null);
          setSwipeDirection(null);
          setIsSwipeAnimating(false);
          stageRef.current?.style.removeProperty("--style-preview-enter-from");
          stageRef.current?.style.removeProperty("--style-preview-leave-from");
          onSelectStyle(nextStyle);
        } else {
          swipeTimerRef.current = window.setTimeout(() => {
            setActiveStyle(nextStyle);
            setPendingStyle(null);
            setSwipeDirection(null);
            setIsSwipeAnimating(false);
            stageRef.current?.style.removeProperty("--style-preview-enter-from");
            stageRef.current?.style.removeProperty("--style-preview-leave-from");
            onSelectStyle(nextStyle);
          }, swipeDurationMs);
        }
      }
    } else {
      setPendingStyle(null);
      setSwipeDirection(null);
    }

    clearTouchTracking();
  };

  const panelClass = isSwipeAnimating
    ? `style-preview-panel is-active ${swipeDirection === "next" ? "is-outgoing-next" : "is-outgoing-prev"}`
    : `style-preview-panel is-active${isOpeningFromCard ? " is-opening-from-card" : ""}${isClosingToCard ? " is-closing-to-card" : ""}${isPulling && !isClosing ? " is-pulling" : ""}`;

  const incomingClass = isDragging
    ? `style-preview-panel is-incoming ${swipeDirection === "next" ? "is-adjacent-next" : "is-adjacent-prev"}`
    : swipeDirection === "next"
      ? "style-preview-panel is-incoming is-incoming-right"
      : "style-preview-panel is-incoming is-incoming-left";

  const screenClass = [
    "overlay-screen style-preview-screen",
    isOpeningFromCard ? "is-opening-from-card" : "",
    isPulling && !isClosing ? "is-pulling" : "",
    isClosingToCard ? "is-closing-to-card" : "",
    isClosing && !isClosingToCard ? (closeReason === "pull" ? "is-closing-pull" : "is-closing-button") : "",
  ].filter(Boolean).join(" ");

  if (!isOpen || !style || !activeStyle) return null;

  const stageClass = `style-preview-stage${isDragging ? " is-dragging" : ""}`;
  const activePanelStyle: CSSProperties = {
    ...(openingVars ?? {}),
    ...(closingVars ?? {}),
  };
  if (isPulling && !isClosing) {
    const pullScale = Math.max(0.84, 1 - pullOffsetY / 1400);
    activePanelStyle.transform = `translateY(${pullOffsetY}px) scale(${pullScale})`;
  }

  return (
    <div className={screenClass}>
      <div
        className="style-preview-hero"
        ref={heroRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div
          className={stageClass}
          ref={stageRef}
          style={
            {
              "--style-preview-swipe-ratio": `${(dragOffsetPx / Math.max(1, stageRef.current?.clientWidth || heroRef.current?.clientWidth || 1)).toFixed(4)}`,
            } as CSSProperties
          }
        >
          <div className={`${panelClass} ${resolveGradientClass(activeStyle)}`} style={activePanelStyle}>
            <div className="style-preview-top">
              <button className="flow-back" onClick={() => requestClose("button")} aria-label="Назад">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="style-preview-name-top">{activeStyle.name}</div>
            </div>

            <button className="style-preview-go-center" onClick={handleCreate} aria-label="Создать в этом стиле">
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

              <button className="style-preview-go-center" onClick={handleCreate} aria-label="Создать в этом стиле">
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
