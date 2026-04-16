import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

type ChangeListener = (e: { matches: boolean }) => void;

function createMockMql(matches: boolean) {
  const listeners: ChangeListener[] = [];
  const mql = {
    matches,
    addEventListener: vi.fn((_: string, cb: ChangeListener) => { listeners.push(cb); }),
    removeEventListener: vi.fn((_: string, cb: ChangeListener) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    fire(nextMatches: boolean) {
      mql.matches = nextMatches;
      listeners.forEach((cb) => cb({ matches: nextMatches }));
    },
  };
  return mql;
}

describe("usePrefersReducedMotion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when prefers-reduced-motion is not set", () => {
    const mql = createMockMql(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce is active", () => {
    const mql = createMockMql(true);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
  });

  it("updates reactively when the media query changes to reduce", () => {
    const mql = createMockMql(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => { mql.fire(true); });

    expect(result.current).toBe(true);
  });

  it("updates reactively when the media query changes back to no-preference", () => {
    const mql = createMockMql(true);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);

    act(() => { mql.fire(false); });

    expect(result.current).toBe(false);
  });

  it("removes the event listener when the component unmounts", () => {
    const mql = createMockMql(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);

    const { unmount } = renderHook(() => usePrefersReducedMotion());

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("returns false as initial state when matchMedia is unavailable (SSR-like)", () => {
    // Stub the global so typeof window.matchMedia !== "function", which
    // triggers the early-return guard inside the hook.
    vi.stubGlobal("matchMedia", undefined);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);

    vi.unstubAllGlobals();
  });
});
