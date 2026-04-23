import { useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
const DOUBLE_TAP_DELAY_MS = 280;
const DOUBLE_TAP_DISTANCE_PX = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function midpoint(a: Touch, b: Touch): { x: number; y: number } {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export function ZoomableImage({ src, alt, className = "", onError }: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);

  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const pinchStartMidRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartTxRef = useRef(0);
  const pinchStartTyRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const modeRef = useRef<"none" | "pinch" | "pan">("none");
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const suppressDblClickUntilRef = useRef(0);
  const zoomedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const hasPendingTransformRef = useRef(false);

  const flushTransform = () => {
    hasPendingTransformRef.current = false;
    if (!imageRef.current) return;
    imageRef.current.style.transform = `translate3d(${txRef.current}px, ${tyRef.current}px, 0) scale(${scaleRef.current})`;
  };

  const scheduleTransform = () => {
    if (hasPendingTransformRef.current) return;
    hasPendingTransformRef.current = true;
    rafRef.current = requestAnimationFrame(() => {
      flushTransform();
      rafRef.current = null;
    });
  };

  const clampPan = (nextScale: number, nextTx: number, nextTy: number): { tx: number; ty: number } => {
    const root = rootRef.current;
    const image = imageRef.current;
    if (!root || !image || nextScale <= 1) return { tx: 0, ty: 0 };

    const baseWidth = image.clientWidth || root.clientWidth;
    const baseHeight = image.clientHeight || root.clientHeight;
    const maxX = Math.max(0, (baseWidth * (nextScale - 1)) / 2);
    const maxY = Math.max(0, (baseHeight * (nextScale - 1)) / 2);
    return {
      tx: clamp(nextTx, -maxX, maxX),
      ty: clamp(nextTy, -maxY, maxY),
    };
  };

  const applyTransform = (nextScaleRaw: number, nextTxRaw: number, nextTyRaw: number) => {
    const nextScale = clamp(nextScaleRaw, MIN_SCALE, MAX_SCALE);
    const clamped = clampPan(nextScale, nextTxRaw, nextTyRaw);
    scaleRef.current = nextScale;
    txRef.current = clamped.tx;
    tyRef.current = clamped.ty;
    const nextIsZoomed = nextScale > 1.01;
    if (zoomedRef.current !== nextIsZoomed) {
      zoomedRef.current = nextIsZoomed;
      setIsZoomed(nextIsZoomed);
    }
    scheduleTransform();
  };

  useEffect(() => {
    // New photo must always open in natural framing without inherited pan/zoom.
    scaleRef.current = 1;
    txRef.current = 0;
    tyRef.current = 0;
    zoomedRef.current = false;
    setIsZoomed(false);
    setIsPinching(false);
    modeRef.current = "none";
    scheduleTransform();
  }, [src]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const toggleDoubleTapZoom = () => {
    const nextScale = scaleRef.current <= 1.01 ? DOUBLE_TAP_SCALE : 1;
    applyTransform(nextScale, 0, 0);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touches = event.touches;

    if (touches.length >= 2) {
      setIsPinching(true);
      const first = touches[0];
      const second = touches[1];
      pinchStartDistRef.current = distance(first, second);
      pinchStartScaleRef.current = scaleRef.current;
      pinchStartMidRef.current = midpoint(first, second);
      pinchStartTxRef.current = txRef.current;
      pinchStartTyRef.current = tyRef.current;
      modeRef.current = "pinch";
      // Two-finger gesture belongs to image zoom; prevent page scroll.
      event.preventDefault();
      return;
    }

    if (touches.length === 1 && scaleRef.current > 1) {
      modeRef.current = "pan";
      panStartXRef.current = touches[0].clientX - txRef.current;
      panStartYRef.current = touches[0].clientY - tyRef.current;
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const touches = event.touches;

    if (modeRef.current === "pinch" && touches.length >= 2) {
      const first = touches[0];
      const second = touches[1];
      const dist = distance(first, second);
      const startDist = pinchStartDistRef.current || dist;
      const nextScale = clamp((pinchStartScaleRef.current * dist) / startDist, MIN_SCALE, MAX_SCALE);

      const startMid = pinchStartMidRef.current;
      if (startMid) {
        const currentMid = midpoint(first, second);
        applyTransform(
          nextScale,
          pinchStartTxRef.current + (currentMid.x - startMid.x),
          pinchStartTyRef.current + (currentMid.y - startMid.y),
        );
      } else {
        applyTransform(nextScale, txRef.current, tyRef.current);
      }

      event.preventDefault();
      return;
    }

    if (modeRef.current === "pan" && touches.length === 1 && scaleRef.current > 1) {
      applyTransform(
        scaleRef.current,
        touches[0].clientX - panStartXRef.current,
        touches[0].clientY - panStartYRef.current,
      );
      event.preventDefault();
      return;
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) {
      setIsPinching(false);
      const changed = event.changedTouches?.[0];
      if (changed) {
        const now = Date.now();
        const lastTap = lastTapRef.current;
        if (lastTap) {
          const dt = now - lastTap.time;
          const dx = changed.clientX - lastTap.x;
          const dy = changed.clientY - lastTap.y;
          const moved = Math.hypot(dx, dy);
          if (dt <= DOUBLE_TAP_DELAY_MS && moved <= DOUBLE_TAP_DISTANCE_PX) {
            // Mobile browsers can fire both touch double-tap and dblclick.
            // Suppress the upcoming dblclick to avoid immediate zoom reset.
            suppressDblClickUntilRef.current = now + 450;
            toggleDoubleTapZoom();
            lastTapRef.current = null;
            modeRef.current = "none";
            return;
          }
        }
        lastTapRef.current = { time: now, x: changed.clientX, y: changed.clientY };
      }
      modeRef.current = "none";
      return;
    }

    if (event.touches.length === 1 && scaleRef.current > 1) {
      setIsPinching(false);
      modeRef.current = "pan";
      panStartXRef.current = event.touches[0].clientX - txRef.current;
      panStartYRef.current = event.touches[0].clientY - tyRef.current;
      return;
    }

    if (event.touches.length >= 2) {
      setIsPinching(true);
    } else {
      setIsPinching(false);
    }
  };

  const handleDoubleClick = () => {
    if (Date.now() <= suppressDblClickUntilRef.current) return;
    toggleDoubleTapZoom();
  };

  return (
    <div
      ref={rootRef}
      className={`zoomable-photo${isZoomed ? " is-zoomed" : ""}${isPinching ? " is-pinching" : ""} ${className}`.trim()}
      data-photo-zoom="true"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="zoomable-photo-image"
        draggable={false}
        onError={onError}
      />
    </div>
  );
}
