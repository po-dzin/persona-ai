import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StyleItem } from "../../data/styles";
import { StylePreviewScreen } from "../StylePreviewScreen";

const styles: StyleItem[] = [
  {
    id: "s1",
    name: "Стиль 1",
    category: "Тренды",
    gradient: "var(--sem-gradient-style-violet)",
    promptTemplate: "prompt 1",
  },
  {
    id: "s2",
    name: "Стиль 2",
    category: "Тренды",
    gradient: "var(--sem-gradient-style-indigo)",
    promptTemplate: "prompt 2",
  },
  {
    id: "s3",
    name: "Стиль 3",
    category: "Тренды",
    gradient: "var(--sem-gradient-style-green)",
    promptTemplate: "prompt 3",
  },
];

describe("StylePreviewScreen gestures", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes on pull-down gesture", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onSelectStyle = vi.fn();
    render(
      <StylePreviewScreen
        isOpen
        styles={styles}
        style={styles[1]}
        onClose={onClose}
        onSelectStyle={onSelectStyle}
        onCreate={vi.fn()}
      />,
    );

    const hero = document.querySelector(".style-preview-hero") as HTMLElement;
    fireEvent.touchStart(hero, { touches: [{ clientX: 120, clientY: 100 }] });
    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 118, clientY: 190 }] });

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectStyle).not.toHaveBeenCalled();
  });

  it("swipes left to next style", () => {
    vi.useFakeTimers();
    const onSelectStyle = vi.fn();
    render(
      <StylePreviewScreen
        isOpen
        styles={styles}
        style={styles[1]}
        onClose={vi.fn()}
        onSelectStyle={onSelectStyle}
        onCreate={vi.fn()}
      />,
    );

    const hero = document.querySelector(".style-preview-hero") as HTMLElement;
    fireEvent.touchStart(hero, { touches: [{ clientX: 220, clientY: 120 }] });
    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 120, clientY: 124 }] });

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onSelectStyle).toHaveBeenCalledWith(styles[2]);
  });

  it("swipes right to previous style", () => {
    vi.useFakeTimers();
    const onSelectStyle = vi.fn();
    render(
      <StylePreviewScreen
        isOpen
        styles={styles}
        style={styles[1]}
        onClose={vi.fn()}
        onSelectStyle={onSelectStyle}
        onCreate={vi.fn()}
      />,
    );

    const hero = document.querySelector(".style-preview-hero") as HTMLElement;
    fireEvent.touchStart(hero, { touches: [{ clientX: 120, clientY: 120 }] });
    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 220, clientY: 124 }] });

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onSelectStyle).toHaveBeenCalledWith(styles[0]);
    expect(screen.getByText("Стиль 2")).toBeInTheDocument();
  });

  it("resets closing state between open sessions", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(
      <StylePreviewScreen
        isOpen
        styles={styles}
        style={styles[1]}
        onClose={onClose}
        onSelectStyle={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <StylePreviewScreen
        isOpen={false}
        styles={styles}
        style={styles[1]}
        onClose={onClose}
        onSelectStyle={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    rerender(
      <StylePreviewScreen
        isOpen
        styles={styles}
        style={styles[1]}
        onClose={onClose}
        onSelectStyle={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    const screenEl = document.querySelector(".style-preview-screen");
    expect(screenEl).toBeTruthy();
    expect(screenEl?.classList.contains("is-closing-button")).toBe(false);
    expect(screenEl?.classList.contains("is-closing-pull")).toBe(false);
  });

  it("adds card-expand opening animation class when origin rect is provided", async () => {
    render(
      <main className="app-shell">
        <StylePreviewScreen
          isOpen
          styles={styles}
          style={styles[1]}
          originRect={{ left: 40, top: 120, width: 120, height: 160 }}
          onClose={vi.fn()}
          onSelectStyle={vi.fn()}
          onCreate={vi.fn()}
        />
      </main>,
    );

    await waitFor(() => {
      expect(document.querySelector(".style-preview-panel.is-opening-from-card")).toBeTruthy();
    });
  }, 10000);
});
