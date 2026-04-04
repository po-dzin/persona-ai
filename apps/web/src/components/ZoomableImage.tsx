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
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const pinchStartMidRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartTxRef = useRef(0);
  const pinchStartTyRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const modeRef = useRef<"none" | "pinch" | "pan">("none");
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const resetTransform = () => {
    setScale(1);
    setTx(0);
    setTy(0);
    modeRef.current = "none";
  };

  useEffect(() => {
    // New photo must always open in natural framing without inherited pan/zoom.
    setScale(1);
    setTx(0);
    setTy(0);
    modeRef.current = "none";
  }, [src]);

  useEffect(() => {
    if (!imageRef.current) return;
    imageRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  }, [tx, ty, scale]);

  const toggleDoubleTapZoom = () => {
    setScale((prev) => {
      const next = prev <= 1.01 ? DOUBLE_TAP_SCALE : 1;
      if (next === 1) {
        setTx(0);
        setTy(0);
      }
      return next;
    });
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touches = event.touches;

    if (touches.length >= 2) {
      const first = touches[0];
      const second = touches[1];
      pinchStartDistRef.current = distance(first, second);
      pinchStartScaleRef.current = scale;
      pinchStartMidRef.current = midpoint(first, second);
      pinchStartTxRef.current = tx;
      pinchStartTyRef.current = ty;
      modeRef.current = "pinch";
      return;
    }

    if (touches.length === 1 && scale > 1) {
      modeRef.current = "pan";
      panStartXRef.current = touches[0].clientX - tx;
      panStartYRef.current = touches[0].clientY - ty;
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
      setScale(nextScale);

      const startMid = pinchStartMidRef.current;
      if (startMid) {
        const currentMid = midpoint(first, second);
        setTx(pinchStartTxRef.current + (currentMid.x - startMid.x));
        setTy(pinchStartTyRef.current + (currentMid.y - startMid.y));
      }

      event.preventDefault();
      return;
    }

    if (modeRef.current === "pan" && touches.length === 1 && scale > 1) {
      setTx(touches[0].clientX - panStartXRef.current);
      setTy(touches[0].clientY - panStartYRef.current);
      event.preventDefault();
      return;
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) {
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
            toggleDoubleTapZoom();
            lastTapRef.current = null;
            modeRef.current = "none";
            return;
          }
        }
        lastTapRef.current = { time: now, x: changed.clientX, y: changed.clientY };
      }
      modeRef.current = "none";
      if (scale <= 1.01) {
        resetTransform();
      }
      return;
    }

    if (event.touches.length === 1 && scale > 1) {
      modeRef.current = "pan";
      panStartXRef.current = event.touches[0].clientX - tx;
      panStartYRef.current = event.touches[0].clientY - ty;
    }
  };

  return (
    <div
      className={`zoomable-photo ${className}`.trim()}
      data-photo-zoom="true"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDoubleClick={toggleDoubleTapZoom}
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
