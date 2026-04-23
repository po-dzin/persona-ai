import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZoomableImage } from "../ZoomableImage";

describe("ZoomableImage", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles zoom class on double click and applies transform via rAF", () => {
    const { container } = render(<ZoomableImage src="https://example.com/a.jpg" alt="photo" />);
    const root = container.querySelector(".zoomable-photo") as HTMLElement;
    const image = container.querySelector(".zoomable-photo-image") as HTMLImageElement;

    expect(root.classList.contains("is-zoomed")).toBe(false);
    expect(image.style.transform).toContain("scale(1)");

    fireEvent.doubleClick(root);
    expect(root.classList.contains("is-zoomed")).toBe(true);
    expect(image.style.transform).toContain("scale(2)");

    fireEvent.doubleClick(root);
    expect(root.classList.contains("is-zoomed")).toBe(false);
    expect(image.style.transform).toContain("scale(1)");
  });

  it("resets zoom and transform when src changes", () => {
    const { container, rerender } = render(<ZoomableImage src="https://example.com/a.jpg" alt="photo" />);
    const root = container.querySelector(".zoomable-photo") as HTMLElement;
    const image = container.querySelector(".zoomable-photo-image") as HTMLImageElement;

    fireEvent.doubleClick(root);
    expect(root.classList.contains("is-zoomed")).toBe(true);
    expect(image.style.transform).toContain("scale(2)");

    rerender(<ZoomableImage src="https://example.com/b.jpg" alt="photo" />);
    const nextRoot = container.querySelector(".zoomable-photo") as HTMLElement;
    const nextImage = container.querySelector(".zoomable-photo-image") as HTMLImageElement;
    expect(nextRoot.classList.contains("is-zoomed")).toBe(false);
    expect(nextImage.style.transform).toContain("scale(1)");
  });
});

