import { afterEach, describe, expect, it, vi } from "vitest";

import { readMotionTokenMs } from "../motionTokens";

function mockComputedToken(value: string) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: () => value,
  } as unknown as CSSStyleDeclaration);
}

describe("readMotionTokenMs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts seconds to milliseconds", () => {
    mockComputedToken(" 0.28s");
    expect(readMotionTokenMs("--cmp-motion-swipe", 100)).toBe(280);
  });

  it("returns millisecond values unchanged", () => {
    mockComputedToken(" 280ms");
    expect(readMotionTokenMs("--cmp-motion-swipe", 100)).toBe(280);
  });

  it("handles integer seconds", () => {
    mockComputedToken(" 1s");
    expect(readMotionTokenMs("--cmp-motion-loader-pulse", 100)).toBe(1000);
  });

  it("handles decimal milliseconds (reduced-motion token)", () => {
    mockComputedToken(" 0.01ms");
    expect(readMotionTokenMs("--cmp-motion-reduced", 100)).toBeCloseTo(0.01);
  });

  it("converts the full motion token set correctly", () => {
    const cases: Array<[string, number]> = [
      ["0.15s", 150],
      ["0.12s", 120],
      ["0.18s", 180],
      ["0.2s", 200],
      ["0.22s", 220],
      ["0.24s", 240],
      ["0.25s", 250],
      ["0.28s", 280],
      ["0.32s", 320],
      ["1.2s", 1200],
      ["1.4s", 1400],
    ];
    for (const [input, expected] of cases) {
      mockComputedToken(` ${input}`);
      expect(readMotionTokenMs("--any", 0), `input: ${input}`).toBeCloseTo(expected);
    }
  });

  it("returns fallback when token is empty", () => {
    mockComputedToken("   ");
    expect(readMotionTokenMs("--cmp-motion-swipe", 42)).toBe(42);
  });

  it("returns fallback for non-time value", () => {
    mockComputedToken("auto");
    expect(readMotionTokenMs("--cmp-motion-swipe", 99)).toBe(99);
  });

  it("returns fallback for value without time unit", () => {
    mockComputedToken("280");
    expect(readMotionTokenMs("--cmp-motion-swipe", 55)).toBe(55);
  });

  it("is case-insensitive for the time unit", () => {
    mockComputedToken(" 200MS");
    expect(readMotionTokenMs("--cmp-motion-normal", 0)).toBe(200);
    mockComputedToken(" 0.2S");
    expect(readMotionTokenMs("--cmp-motion-normal", 0)).toBe(200);
  });
});
