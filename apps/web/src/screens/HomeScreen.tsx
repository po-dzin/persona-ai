import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { readMotionTokenMs } from "../utils/motionTokens";
import { isPhotoGenerating } from "../utils/photoStatus";
import {
  GESTURE_IDLE_THRESHOLD_PX,
  HORIZONTAL_BIAS_RATIO,
  getHorizontalSwipeKeyframeOffsets,
  resolveGestureAxis,
  shouldActivateHorizontalSwipe,
  shouldCommitHorizontalSwipe,
} from "../utils/swipeGesture";

interface HomeScreenProps {
  styles: StyleItem[];
  photos: PhotoRecord[];
  generatingOrderIds?: Set<string>;
  onPreviewStyle: (style: StyleItem) => void;
}

const CATEGORY_ORDER = [
  "Тренды",
  "Студийный портрет",
  "Романтика и отношения",
  "Лайфстайл",
  "Праздники",
  "Семья и память",
  "Фешн",
  "Арт и креатив",
  "Бизнес и карьера",
  "Эпохи и ретро",
  "Сезоны и атмосфера",
  "Персонажи и герои",
  "Культуры и страны",
];
function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="13" r="4" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5" />
    </svg>
  );
}

export function HomeScreen({ styles, photos, generatingOrderIds, onPreviewStyle }: HomeScreenProps) {
  const styleByCode = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s])), [styles]);
  const activePhotos = useMemo(
    () => photos.filter((p) => (generatingOrderIds ? generatingOrderIds.has(p.orderId) : isPhotoGenerating(p))),
    [photos, generatingOrderIds],
  );

  const byCategory = useMemo(() => styles.reduce<Record<string, StyleItem[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {}), [styles]);

  const categories = useMemo(() => {
    const hasTrending = styles.some((s) => s.isTrending);
    const ordered = CATEGORY_ORDER.filter((c) => c === "Тренды" ? hasTrending : byCategory[c]);
    Object.keys(byCategory).forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered;
  }, [byCategory, styles]);

  const [activeCategory, setActiveCategory] = useState("ВСЕ");
  const [visitedCategories, setVisitedCategories] = useState<Set<string>>(() => new Set(["ВСЕ"]));
  const [transitionDirection, setTransitionDirection] = useState<"next" | "prev">("next");
  const [isCategoryTransitioning, setIsCategoryTransitioning] = useState(false);
  const [outgoingCategory, setOutgoingCategory] = useState<string | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [panelsHeight, setPanelsHeight] = useState<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const allCategories = useMemo(() => ["ВСЕ", ...categories], [categories]);
  const swipeDurationMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-swipe", 280)),
    [prefersReducedMotion],
  );
  const transitionLockMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-swipe-lock", 320)),
    [prefersReducedMotion],
  );
  const tabsRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevCategoryRef = useRef("ВСЕ");
  const heightRafRef = useRef<number | null>(null);
  const heightTimerRef = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTs = useRef<number | null>(null);
  const gestureAxisRef = useRef<"none" | "x" | "y">("none");
  const isSwipeGestureRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const categoryTransitionTimerRef = useRef<number | null>(null);
  const preloadCategory = (category: string | undefined) => {
    if (!category) return;
    setVisitedCategories((prev) => {
      if (prev.has(category)) return prev;
      const next = new Set(prev);
      next.add(category);
      return next;
    });
  };
  const clearTouchTracking = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTs.current = null;
    gestureAxisRef.current = "none";
    isSwipeGestureRef.current = false;
    dragOffsetRef.current = 0;
    setDragOffsetPx(0);
    setIsDragging(false);
  };

  useEffect(() => {
    if (!categories.length) {
      setActiveCategory("ВСЕ");
      setVisitedCategories(new Set(["ВСЕ"]));
      return;
    }
    if (activeCategory === "ВСЕ") return;
    if (!categories.includes(activeCategory)) {
      setActiveCategory("ВСЕ");
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    setVisitedCategories((prev) => {
      if (prev.has(activeCategory)) return prev;
      const next = new Set(prev);
      next.add(activeCategory);
      return next;
    });
    const idx = allCategories.indexOf(activeCategory);
    preloadCategory(allCategories[idx + 1]);
    preloadCategory(allCategories[idx - 1]);
  }, [activeCategory, allCategories]);

  useLayoutEffect(() => {
    if (prefersReducedMotion || !panelsRef.current) {
      prevCategoryRef.current = activeCategory;
      setPanelsHeight(null);
      return;
    }
    const activePanel = panelRefs.current[activeCategory];
    const activeHeight = activePanel?.offsetHeight ?? 0;

    if (isDragging) {
      const idx = allCategories.indexOf(activeCategory);
      const targetCategory = dragOffsetPx < 0 ? allCategories[idx + 1] : allCategories[idx - 1];
      const targetPanel = targetCategory ? panelRefs.current[targetCategory] : null;
      const targetHeight = targetPanel?.offsetHeight ?? activeHeight;
      setPanelsHeight(Math.max(activeHeight, targetHeight));
      return;
    }

    if (isCategoryTransitioning && outgoingCategory) {
      const outgoingPanel = panelRefs.current[outgoingCategory];
      const outgoingHeight = outgoingPanel?.offsetHeight ?? activeHeight;
      setPanelsHeight(Math.max(activeHeight, outgoingHeight));
      if (heightTimerRef.current) window.clearTimeout(heightTimerRef.current);
      heightTimerRef.current = window.setTimeout(() => {
        setPanelsHeight(null);
      }, swipeDurationMs);
      prevCategoryRef.current = activeCategory;
      return;
    }

    const prevCategory = prevCategoryRef.current;
    const prevPanel = panelRefs.current[prevCategory];
    const nextPanel = panelRefs.current[activeCategory];
    if (!nextPanel) return;

    const from = prevPanel?.offsetHeight ?? nextPanel.offsetHeight;
    const to = nextPanel.offsetHeight;
    prevCategoryRef.current = activeCategory;

    if (from === to) {
      setPanelsHeight(null);
      return;
    }

    setPanelsHeight(from);
    if (heightRafRef.current) cancelAnimationFrame(heightRafRef.current);
    heightRafRef.current = requestAnimationFrame(() => {
      setPanelsHeight(to);
    });

    if (heightTimerRef.current) window.clearTimeout(heightTimerRef.current);
    heightTimerRef.current = window.setTimeout(() => {
      setPanelsHeight(null);
    }, swipeDurationMs);
  }, [
    activeCategory,
    allCategories,
    dragOffsetPx,
    isCategoryTransitioning,
    isDragging,
    outgoingCategory,
    swipeDurationMs,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    return () => {
      if (heightRafRef.current) cancelAnimationFrame(heightRafRef.current);
      if (heightTimerRef.current) window.clearTimeout(heightTimerRef.current);
      if (categoryTransitionTimerRef.current) window.clearTimeout(categoryTransitionTimerRef.current);
    };
  }, []);

  // Non-passive touchmove: prevent vertical scroll while a horizontal swipe is active.
  // React synthetic handlers are passive by default, so preventDefault() there is a no-op.
  useEffect(() => {
    const el = panelsRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (gestureAxisRef.current === "x" || isSwipeGestureRef.current) e.preventDefault();
    };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  // Scroll active tab into view when changed by swipe
  useEffect(() => {
    if (!tabsRef.current) return;
    const active = tabsRef.current.querySelector(".category-tab-link.active") as HTMLElement | null;
    active?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeCategory, prefersReducedMotion]);

  const setCategory = (nextCategory: string) => {
    if (nextCategory === activeCategory || isCategoryTransitioning) return;
    // Scroll the screen container to top so the new category always starts at the beginning
    panelsRef.current?.closest(".screen")?.scrollTo?.({ top: 0, behavior: "instant" });
    // Always reset keyframe offsets so tab-click never inherits a stale swipe position
    panelsRef.current?.style.removeProperty("--panel-enter-from");
    panelsRef.current?.style.removeProperty("--panel-leave-from");
    const currentIdx = allCategories.indexOf(activeCategory);
    const nextIdx = allCategories.indexOf(nextCategory);
    preloadCategory(nextCategory);
    if (currentIdx >= 0 && nextIdx >= 0) {
      setTransitionDirection(nextIdx > currentIdx ? "next" : "prev");
    }
    if (transitionLockMs > 0) {
      setIsCategoryTransitioning(true);
      setOutgoingCategory(activeCategory);
      if (categoryTransitionTimerRef.current) window.clearTimeout(categoryTransitionTimerRef.current);
      categoryTransitionTimerRef.current = window.setTimeout(() => {
        setIsCategoryTransitioning(false);
        setOutgoingCategory(null);
      }, transitionLockMs);
    } else {
      setIsCategoryTransitioning(false);
      setOutgoingCategory(null);
    }
    setActiveCategory(nextCategory);
  };

  const switchCategory = (dir: "prev" | "next") => {
    const idx = allCategories.indexOf(activeCategory);
    const next = dir === "next" ? allCategories[idx + 1] : allCategories[idx - 1];
    if (next) setCategory(next);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (isCategoryTransitioning) return;
    clearTouchTracking();
    // Reset per-swipe animation start positions
    panelsRef.current?.style.removeProperty("--panel-enter-from");
    panelsRef.current?.style.removeProperty("--panel-leave-from");
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTs.current = performance.now();
    const idx = allCategories.indexOf(activeCategory);
    preloadCategory(allCategories[idx + 1]);
    preloadCategory(allCategories[idx - 1]);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      isCategoryTransitioning
    ) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const idx = allCategories.indexOf(activeCategory);
    const atLeftEdge = idx <= 0 && dx > 0;
    const atRightEdge = idx >= allCategories.length - 1 && dx < 0;
    gestureAxisRef.current = resolveGestureAxis({
      current: gestureAxisRef.current,
      absDx,
      absDy,
      idleThresholdPx: GESTURE_IDLE_THRESHOLD_PX,
      horizontalBiasRatio: HORIZONTAL_BIAS_RATIO,
    });
    if (gestureAxisRef.current === "none") return;
    if (gestureAxisRef.current !== "x") return;
    if (!isSwipeGestureRef.current) {
      if (!shouldActivateHorizontalSwipe({ absDx, absDy, verticalToleranceRatio: 0.8 })) return;
      if (atLeftEdge || atRightEdge) return;
      isSwipeGestureRef.current = true;
      setIsDragging(true);
    }
    if (!isSwipeGestureRef.current) return;
    if (atLeftEdge || atRightEdge) return;
    e.preventDefault();
    const width = panelsRef.current?.clientWidth || 1;
    const clamped = Math.max(-width, Math.min(width, dx));
    dragOffsetRef.current = clamped;
    setDragOffsetPx(clamped);
    if (dx < 0) preloadCategory(allCategories[idx + 1]);
    if (dx > 0) preloadCategory(allCategories[idx - 1]);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      touchStartTs.current === null ||
      isCategoryTransitioning
    ) {
      clearTouchTracking();
      return;
    }
    if (gestureAxisRef.current === "y") {
      clearTouchTracking();
      return;
    }
    const dx = isSwipeGestureRef.current ? dragOffsetRef.current : e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dt = Math.max(1, performance.now() - touchStartTs.current);
    const shouldCommit = shouldCommitHorizontalSwipe({
      dx,
      dy,
      durationMs: dt,
      commitDistancePx: 40,
      dominantHorizontalRatio: 0.6,
    });
    if (!shouldCommit) {
      clearTouchTracking();
      return;
    }

    const dir = dx < 0 ? "next" : "prev";

    // Set keyframe start positions from current drag offset so the entering/leaving
    // panels animate from where they already are, not from ±100% (avoids jitter).
    if (panelsRef.current && isSwipeGestureRef.current) {
      const width = panelsRef.current.clientWidth || 1;
      const ratio = dragOffsetRef.current / width;
      const { enterFrom, leaveFrom } = getHorizontalSwipeKeyframeOffsets({ ratio, direction: dir });
      panelsRef.current.style.setProperty("--panel-enter-from", enterFrom);
      panelsRef.current.style.setProperty("--panel-leave-from", leaveFrom);
    }

    clearTouchTracking();
    switchCategory(dir);
  };

  const stylesByCategory = useMemo(() => {
    const result: Record<string, StyleItem[]> = { ВСЕ: styles };
    for (const category of categories) {
      result[category] = category === "Тренды"
        ? styles.filter((s) => s.isTrending)
        : byCategory[category] || [];
    }
    return result;
  }, [styles, categories, byCategory]);

  return (
    <section className="screen home-screen">
      {activePhotos.length > 1 ? (
        <div className="queue-stack">
          <div className="stack-back-2" />
          <div className="stack-back-1" />
          <div className="stack-front">
            <div className="stack-count">{activePhotos.length}</div>
            <div className="queue-thumb"><CameraIcon /></div>
            <div className="queue-info">
              <div className="queue-title">В очереди</div>
              <div className="queue-detail">{activePhotos.length} генерации</div>
            </div>
            <div className="queue-dots queue-dots-running"><span /><span /><span /></div>
          </div>
        </div>
      ) : activePhotos.length === 1 ? (
        <div className="queue-single">
          <div className="queue-thumb"><CameraIcon /></div>
          <div className="queue-info">
            <div className="queue-title">{styleByCode[activePhotos[0].styleCode]?.name || activePhotos[0].styleCode}</div>
            <div className="queue-detail">Генерация</div>
          </div>
          <div className="queue-dots queue-dots-running"><span /><span /><span /></div>
        </div>
      ) : null}

      <div className="home-sticky-header">
        <div className="category-tabs-row" ref={tabsRef} aria-label="Категории стилей">
          <button
            type="button"
            className={"category-tab-link" + (activeCategory === "ВСЕ" ? " active" : "")}
            onClick={() => setCategory("ВСЕ")}
            aria-pressed={activeCategory === "ВСЕ"}
          >
            ВСЕ
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              className={"category-tab-link" + (activeCategory === category ? " active" : "")}
              onClick={() => setCategory(category)}
              aria-pressed={activeCategory === category}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`home-styles-panels dir-${transitionDirection}${isDragging ? " is-dragging" : ""}${isCategoryTransitioning ? " is-transitioning" : ""}`}
        ref={panelsRef}
        style={
          {
            ...(panelsHeight !== null ? { height: `${panelsHeight}px` } : {}),
            "--home-swipe-ratio": `${(dragOffsetPx / Math.max(1, panelsRef.current?.clientWidth || 1)).toFixed(4)}`,
          } as CSSProperties
        }
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={clearTouchTracking}
      >
        {allCategories.map((category) => {
          const activeIdx = allCategories.indexOf(activeCategory);
          const categoryIdx = allCategories.indexOf(category);
          const isOutgoing = outgoingCategory === category;
          // Outgoing panel must not get adjacent classes — their static transform
          // conflicts with the leave-animation and causes a single-frame blink.
          const isAdjacentPrev = !isOutgoing && categoryIdx === activeIdx - 1;
          const isAdjacentNext = !isOutgoing && categoryIdx === activeIdx + 1;
          const shouldRender = visitedCategories.has(category) || isAdjacentPrev || isAdjacentNext || isOutgoing;
          if (!shouldRender) return null;
          const isActive = category === activeCategory;
          const categoryStyles = stylesByCategory[category] || [];
          const transitionClass = isCategoryTransitioning && isOutgoing
            ? transitionDirection === "next"
              ? " is-outgoing-next"
              : " is-outgoing-prev"
            : isCategoryTransitioning && isActive && outgoingCategory
              ? transitionDirection === "next"
                ? " is-entering-next"
                : " is-entering-prev"
              : "";
          return (
            <div
              key={category}
              className={`home-styles-panel${isActive ? " is-active" : ""}${isAdjacentPrev ? " is-adjacent-prev" : ""}${isAdjacentNext ? " is-adjacent-next" : ""}${isOutgoing ? " is-outgoing" : ""}${transitionClass}`}
              aria-hidden={!isActive}
              ref={(node) => {
                panelRefs.current[category] = node;
              }}
            >
              <div className="styles-grid-2 home-styles-grid">
                {categoryStyles.map((style) => (
                  <button
                    type="button"
                    key={style.id}
                    className="style-card style-card-grid"
                    onClick={() => onPreviewStyle(style)}
                    aria-label={style.name}
                  >
                    <div className="style-preview" style={{ background: style.gradient }}>
                      {style.isTrending ? <span className="style-tag fire">Hot</span> : null}
                      {style.isNew ? <span className="style-tag new">New</span> : null}
                      <div className="style-overlay">
                        <div className="style-name">{style.name}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="screen-tail-space" />
    </section>
  );
}
