import { describe, expect, it } from "vitest";

import {
  getHorizontalSwipeKeyframeOffsets,
  shouldActivateHorizontalSwipe,
  shouldCommitHorizontalSwipe,
} from "../swipeGesture";

describe("swipeGesture utils", () => {
  it("activates horizontal swipe only when horizontal movement dominates", () => {
    expect(shouldActivateHorizontalSwipe({ absDx: 14, absDy: 6 })).toBe(true);
    expect(shouldActivateHorizontalSwipe({ absDx: 8, absDy: 2 })).toBe(false);
    expect(shouldActivateHorizontalSwipe({ absDx: 14, absDy: 13 })).toBe(false);
  });

  it("commits swipe by distance or by flick velocity", () => {
    expect(
      shouldCommitHorizontalSwipe({
        dx: 60,
        dy: 12,
        durationMs: 200,
        commitDistancePx: 56,
        dominantHorizontalRatio: 0.9,
      }),
    ).toBe(true);

    expect(
      shouldCommitHorizontalSwipe({
        dx: 28,
        dy: 6,
        durationMs: 50,
        commitDistancePx: 56,
        dominantHorizontalRatio: 0.9,
      }),
    ).toBe(true);

    expect(
      shouldCommitHorizontalSwipe({
        dx: 20,
        dy: 30,
        durationMs: 80,
        commitDistancePx: 56,
        dominantHorizontalRatio: 0.9,
      }),
    ).toBe(false);
  });

  it("builds keyframe offsets from current drag ratio", () => {
    expect(getHorizontalSwipeKeyframeOffsets({ ratio: -0.25, direction: "next" })).toEqual({
      enterFrom: "75.00%",
      leaveFrom: "-25.00%",
    });
    expect(getHorizontalSwipeKeyframeOffsets({ ratio: 0.15, direction: "prev" })).toEqual({
      enterFrom: "-85.00%",
      leaveFrom: "15.00%",
    });
  });
});
