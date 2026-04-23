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

  it("animates pull-release back to position when pull threshold is not reached", () => {
    vi.useFakeTimers();
    render(
      <StylePreviewScreen
        isOpen
        styles={styles}
        style={styles[1]}
        onClose={vi.fn()}
        onSelectStyle={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    const hero = document.querySelector(".style-preview-hero") as HTMLElement;
    fireEvent.touchStart(hero, { touches: [{ clientX: 120, clientY: 100 }] });
    fireEvent.touchMove(hero, { touches: [{ clientX: 118, clientY: 150 }] });
    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 118, clientY: 150 }] });

    expect(document.querySelector(".style-preview-panel.is-pull-releasing")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(document.querySelector(".style-preview-panel.is-pull-releasing")).toBeFalsy();
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

  it("sticks to finger during horizontal drag and reveals adjacent style panel", () => {
    render(
      <StylePreviewScreen
        isOpen
        styles={styles}
        style={styles[1]}
        onClose={vi.fn()}
        onSelectStyle={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    const hero = document.querySelector(".style-preview-hero") as HTMLElement;
    const stage = document.querySelector(".style-preview-stage") as HTMLElement;
    expect(stage.classList.contains("is-dragging")).toBe(false);

    fireEvent.touchStart(hero, { touches: [{ clientX: 240, clientY: 140 }] });
    fireEvent.touchMove(hero, { touches: [{ clientX: 150, clientY: 143 }] });

    expect(stage.classList.contains("is-dragging")).toBe(true);
    expect(document.querySelector(".style-preview-panel.is-adjacent-next")).toBeTruthy();

    fireEvent.touchEnd(hero, { changedTouches: [{ clientX: 150, clientY: 143 }] });
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

  it("closes to the currently active grid card when it exists (not stale origin card)", () => {
    vi.useFakeTimers();
    render(
      <main className="app-shell">
        <button className="style-card" data-style-id="s2" />
        <StylePreviewScreen
          isOpen
          styles={styles}
          style={styles[1]}
          originRect={{ left: 8, top: 24, width: 60, height: 80 }}
          onClose={vi.fn()}
          onSelectStyle={vi.fn()}
          onCreate={vi.fn()}
        />
      </main>,
    );

    const shell = document.querySelector(".app-shell") as HTMLElement;
    const targetCard = document.querySelector('.style-card[data-style-id="s2"]') as HTMLElement;
    shell.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 400,
      height: 800,
      right: 400,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
    targetCard.getBoundingClientRect = vi.fn(() => ({
      left: 50,
      top: 500,
      width: 100,
      height: 120,
      right: 150,
      bottom: 620,
      x: 50,
      y: 500,
      toJSON: () => ({}),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));

    const panel = document.querySelector(".style-preview-panel.is-active") as HTMLElement;
    expect(panel.style.getPropertyValue("--style-preview-origin-tx")).toBe("-100px");
    expect(panel.style.getPropertyValue("--style-preview-origin-ty")).toBe("160px");
  });
});
