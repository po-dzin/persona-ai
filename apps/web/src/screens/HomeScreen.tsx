import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { StyleItem } from "../data/styles";
import type { PhotoRecord } from "../utils/api";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { readMotionTokenMs } from "../utils/motionTokens";
import { isGeneratingPhotoStatus } from "../utils/photoStatus";

interface HomeScreenProps {
  styles: StyleItem[];
  photos: PhotoRecord[];
  onPreviewStyle: (style: StyleItem) => void;
}

const CATEGORY_ORDER = ["Тренды", "Бизнес и карьера", "Лайфстайл", "Арт и креатив", "Особый повод"];
function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="13" r="4" stroke="var(--sem-color-text-tertiary)" strokeWidth="1.5" />
    </svg>
  );
}

export function HomeScreen({ styles, photos, onPreviewStyle }: HomeScreenProps) {
  const styleByCode = useMemo(() => Object.fromEntries(styles.map((s) => [s.id, s])), [styles]);
  const activePhotos = useMemo(
    () => photos.filter((p) => isGeneratingPhotoStatus(p.status)),
    [photos],
  );

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
  const [visitedCategories, setVisitedCategories] = useState<Set<string>>(() => new Set(["ВСЕ"]));
  const [transitionDirection, setTransitionDirection] = useState<"next" | "prev">("next");
  const [isCategoryTransitioning, setIsCategoryTransitioning] = useState(false);
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
  const categoryTransitionTimerRef = useRef<number | null>(null);

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
  }, [activeCategory]);

  useLayoutEffect(() => {
    if (prefersReducedMotion) {
      prevCategoryRef.current = activeCategory;
      setPanelsHeight(null);
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
  }, [activeCategory, swipeDurationMs, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (heightRafRef.current) cancelAnimationFrame(heightRafRef.current);
      if (heightTimerRef.current) window.clearTimeout(heightTimerRef.current);
      if (categoryTransitionTimerRef.current) window.clearTimeout(categoryTransitionTimerRef.current);
    };
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
    const currentIdx = allCategories.indexOf(activeCategory);
    const nextIdx = allCategories.indexOf(nextCategory);
    if (currentIdx >= 0 && nextIdx >= 0) {
      setTransitionDirection(nextIdx > currentIdx ? "next" : "prev");
    }
    if (transitionLockMs > 0) {
      setIsCategoryTransitioning(true);
      if (categoryTransitionTimerRef.current) window.clearTimeout(categoryTransitionTimerRef.current);
      categoryTransitionTimerRef.current = window.setTimeout(() => {
        setIsCategoryTransitioning(false);
      }, transitionLockMs);
    } else {
      setIsCategoryTransitioning(false);
    }
    setActiveCategory(nextCategory);
  };

  const switchCategory = (dir: "prev" | "next") => {
    const idx = allCategories.indexOf(activeCategory);
    const next = dir === "next" ? allCategories[idx + 1] : allCategories[idx - 1];
    if (next) setCategory(next);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTs.current = performance.now();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      touchStartTs.current === null ||
      isCategoryTransitioning
    ) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dt = Math.max(1, performance.now() - touchStartTs.current);
    const absDx = Math.abs(dx);
    const velocityX = absDx / dt; // px per ms
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTs.current = null;
    // Trigger on either confident distance or quick flick; keep dominant horizontal axis.
    const isDominantHorizontal = Math.abs(dy) <= absDx * 0.6;
    const passesDistance = absDx >= 40;
    const passesFlick = absDx >= 24 && velocityX >= 0.35;
    if (!isDominantHorizontal || (!passesDistance && !passesFlick)) return;
    switchCategory(dx < 0 ? "next" : "prev");
  };

  const stylesByCategory = useMemo(() => {
    const result: Record<string, StyleItem[]> = { ВСЕ: styles };
    for (const category of categories) {
      result[category] = byCategory[category] || [];
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
            <div className="queue-dots"><span /><span /><span /></div>
          </div>
        </div>
      ) : activePhotos.length === 1 ? (
        <div className="queue-single">
          <div className="queue-thumb"><CameraIcon /></div>
          <div className="queue-info">
            <div className="queue-title">{styleByCode[activePhotos[0].styleCode]?.name || activePhotos[0].styleCode}</div>
            <div className="queue-detail">Генерация</div>
          </div>
          <div className="queue-dots"><span /><span /><span /></div>
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
        className={`home-styles-panels dir-${transitionDirection}`}
        ref={panelsRef}
        style={panelsHeight !== null ? { height: `${panelsHeight}px` } : undefined}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {allCategories.map((category) => {
          if (!visitedCategories.has(category)) return null;
          const isActive = category === activeCategory;
          const categoryStyles = stylesByCategory[category] || [];
          return (
            <div
              key={category}
              className={`home-styles-panel${isActive ? " is-active" : ""}`}
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
