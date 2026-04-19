import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  it("closes on pull-down gesture", () => {
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

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectStyle).not.toHaveBeenCalled();
  });

  it("swipes left to next style", () => {
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

    expect(onSelectStyle).toHaveBeenCalledWith(styles[2]);
  });

  it("swipes right to previous style", () => {
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

    expect(onSelectStyle).toHaveBeenCalledWith(styles[0]);
    expect(screen.getByText("Стиль 2")).toBeInTheDocument();
  });
});
