import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FALLBACK_STYLES } from "../../data/styles";
import type { PhotoRecord } from "../../utils/api";
import { HomeScreen } from "../HomeScreen";

describe("HomeScreen", () => {
  it("keeps the category rail and panel filtering contract stable", async () => {
    const user = userEvent.setup();
    const onPreviewStyle = vi.fn();

    const { container } = render(
      <HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={onPreviewStyle} />,
    );

    const categoryRail = screen.getByLabelText("Категории стилей");
    const categoryButtons = within(categoryRail).getAllByRole("button");

    const categoryNames = categoryButtons.map((button) => button.textContent);
    expect(categoryNames.slice(0, 5)).toEqual([
      "ВСЕ",
      "Тренды",
      "Студийный портрет",
      "Романтика и отношения",
      "Лайфстайл",
    ]);
    expect(categoryNames).not.toContain("Бизнес");
    expect(within(categoryRail).getByRole("button", { name: "ВСЕ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const activePanel = container.querySelector('.home-styles-panel[aria-hidden="false"]');
    expect(activePanel).toBeTruthy();
    expect(within(activePanel as HTMLElement).getByRole("button", { name: "Голливуд" })).toBeInTheDocument();
    expect(within(activePanel as HTMLElement).getByRole("button", { name: "Аниме-герой" })).toBeInTheDocument();

    await user.click(within(categoryRail).getByRole("button", { name: "Бизнес и карьера" }));

    expect(within(categoryRail).getByRole("button", { name: "Бизнес и карьера" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(categoryRail).getByRole("button", { name: "ВСЕ" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    const businessPanel = container.querySelector('.home-styles-panel[aria-hidden="false"]');
    expect(businessPanel).toBeTruthy();
    expect(within(businessPanel as HTMLElement).getByRole("button", { name: "Бизнес-портрет" })).toBeInTheDocument();
    expect(within(businessPanel as HTMLElement).queryByRole("button", { name: "Аниме-герой" })).not.toBeInTheDocument();
  });

  it("calls onPreviewStyle when style card is clicked", async () => {
    const user = userEvent.setup();
    const onPreviewStyle = vi.fn();

    render(<HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={onPreviewStyle} />);

    await user.click(screen.getAllByRole("button", { name: /Голливуд/ })[0]);

    expect(onPreviewStyle).toHaveBeenCalledTimes(1);
    expect(onPreviewStyle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "hollywood", name: "Голливуд" }),
    );
  });

  it("keeps the queue stack and sticky category rail in canon order when generations are active", () => {
    const activePhotos: PhotoRecord[] = [
      {
        orderId: "ord_1",
        styleCode: "hollywood",
        modelId: "nb2-1k",
        status: "processing",
        prompt: "cinematic portrait",
        resultUrl: null,
        isFavorite: false,
        createdAt: "2026-04-02T08:00:00Z",
        updatedAt: "2026-04-02T08:01:00Z",
      },
      {
        orderId: "ord_2",
        styleCode: "business",
        modelId: "nb2-1k",
        status: "queued",
        prompt: "business headshot",
        resultUrl: null,
        isFavorite: false,
        createdAt: "2026-04-02T08:02:00Z",
        updatedAt: "2026-04-02T08:03:00Z",
      },
    ];

    const { container } = render(
      <HomeScreen styles={FALLBACK_STYLES} photos={activePhotos} onPreviewStyle={vi.fn()} />,
    );

    const queueStack = container.querySelector(".queue-stack");
    const stickyHeader = container.querySelector(".home-sticky-header");
    const tabsRow = screen.getByLabelText("Категории стилей");
    const panels = container.querySelector(".home-styles-panels");

    expect(queueStack).toBeTruthy();
    expect(queueStack).toHaveTextContent("В очереди");
    expect(queueStack).toHaveTextContent("2 генерации");
    expect(queueStack?.children).toHaveLength(3);
    expect(screen.getByText("В очереди")).toBeInTheDocument();
    expect(screen.getByText("2 генерации")).toBeInTheDocument();

    expect(container.firstElementChild?.firstElementChild).toBe(queueStack);
    expect(queueStack?.nextElementSibling).toBe(stickyHeader);
    expect(stickyHeader?.nextElementSibling).toBe(panels);
    expect(stickyHeader).toContainElement(tabsRow);

    const tabButtons = within(tabsRow).getAllByRole("button");
    const tabNames = tabButtons.map((node) => node.textContent);
    expect(tabNames.length).toBeGreaterThan(6);
    expect(tabNames.slice(0, 5)).toEqual([
      "ВСЕ",
      "Тренды",
      "Студийный портрет",
      "Романтика и отношения",
      "Лайфстайл",
    ]);
    expect(tabNames).not.toContain("Бизнес");
    expect(within(tabsRow).getByRole("button", { name: "ВСЕ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });

  it("does not enter dragging state on edge swipe at the first category", () => {
    const { container } = render(
      <HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={vi.fn()} />,
    );

    const panels = container.querySelector(".home-styles-panels") as HTMLElement | null;
    expect(panels).toBeTruthy();

    fireEvent.touchStart(panels as HTMLElement, {
      touches: [{ clientX: 120, clientY: 140 }],
    });
    fireEvent.touchMove(panels as HTMLElement, {
      touches: [{ clientX: 170, clientY: 142 }],
    });

    expect(panels).not.toHaveClass("is-dragging");
  });

  it("enters and exits dragging mode on a valid horizontal swipe gesture", () => {

    const { container } = render(
      <HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={vi.fn()} />,
    );

    const panels = container.querySelector(".home-styles-panels") as HTMLElement | null;
    expect(panels).toBeTruthy();

    fireEvent.touchStart(panels as HTMLElement, {
      touches: [{ clientX: 240, clientY: 160 }],
    });
    fireEvent.touchMove(panels as HTMLElement, {
      touches: [{ clientX: 140, clientY: 164 }],
    });
    expect(panels).toHaveClass("is-dragging");

    fireEvent.touchEnd(panels as HTMLElement, {
      changedTouches: [{ clientX: 140, clientY: 164 }],
    });

    expect(panels).not.toHaveClass("is-dragging");
  });
});

// ---------------------------------------------------------------------------
// Animation state — category transition classes
// ---------------------------------------------------------------------------
// The swipe-lock fallback is 320 ms (readMotionTokenMs returns the fallback
// value in jsdom because CSS custom properties are not evaluated there).
const SWIPE_LOCK_MS = 320;

describe("HomeScreen – category transition animation state", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderHome() {
    const { container } = render(
      <HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={vi.fn()} />,
    );
    const panels = container.querySelector(".home-styles-panels") as HTMLElement;
    const rail = screen.getByLabelText("Категории стилей");
    return { container, panels, rail };
  }

  it("applies is-transitioning and dir-next when clicking a forward category", () => {
    vi.useFakeTimers();
    const { panels, rail } = renderHome();

    expect(panels).not.toHaveClass("is-transitioning");

    fireEvent.click(within(rail).getByRole("button", { name: "Тренды" }));

    expect(panels).toHaveClass("is-transitioning");
    expect(panels).toHaveClass("dir-next");
  });

  it("applies dir-prev when navigating to an earlier category", () => {
    vi.useFakeTimers();
    const { panels, rail } = renderHome();

    // Move forward first so there is a previous category to go back to.
    fireEvent.click(within(rail).getByRole("button", { name: "Тренды" }));
    act(() => { vi.advanceTimersByTime(SWIPE_LOCK_MS); });

    fireEvent.click(within(rail).getByRole("button", { name: "ВСЕ" }));

    expect(panels).toHaveClass("dir-prev");
    expect(panels).toHaveClass("is-transitioning");
  });

  it("marks the leaving panel with is-outgoing and the entering panel with is-entering-next", () => {
    vi.useFakeTimers();
    const { container, rail } = renderHome();

    fireEvent.click(within(rail).getByRole("button", { name: "Тренды" }));

    const outgoing = container.querySelector(".home-styles-panel.is-outgoing");
    const entering = container.querySelector(".home-styles-panel.is-entering-next");

    expect(outgoing).not.toBeNull();
    expect(entering).not.toBeNull();
  });

  it("entering panel is the accessible (aria-hidden=false) panel during transition", () => {
    vi.useFakeTimers();
    const { container, rail } = renderHome();

    fireEvent.click(within(rail).getByRole("button", { name: "Тренды" }));

    const visible = container.querySelector('.home-styles-panel[aria-hidden="false"]');
    expect(visible).toHaveClass("is-entering-next");
  });

  it("keeps adjacent panels visible during transition (adjacent classes not removed)", () => {
    vi.useFakeTimers();
    const { container, rail } = renderHome();

    // Navigate to Студийный портрет (idx 2); Тренды (idx 1) becomes adjacent-prev.
    fireEvent.click(within(rail).getByRole("button", { name: "Студийный портрет" }));

    const adjPrev = container.querySelector(".home-styles-panel.is-adjacent-prev");
    expect(adjPrev).not.toBeNull();
  });

  it("clears is-transitioning and is-outgoing after the swipe-lock timer", () => {
    vi.useFakeTimers();
    const { container, panels, rail } = renderHome();

    fireEvent.click(within(rail).getByRole("button", { name: "Тренды" }));
    expect(panels).toHaveClass("is-transitioning");
    expect(container.querySelector(".home-styles-panel.is-outgoing")).not.toBeNull();

    act(() => { vi.advanceTimersByTime(SWIPE_LOCK_MS); });

    expect(panels).not.toHaveClass("is-transitioning");
    expect(container.querySelector(".home-styles-panel.is-outgoing")).toBeNull();
  });

  it("active tab button reflects the new category immediately after click", () => {
    vi.useFakeTimers();
    const { rail } = renderHome();

    fireEvent.click(within(rail).getByRole("button", { name: "Тренды" }));

    expect(within(rail).getByRole("button", { name: "Тренды" })).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).getByRole("button", { name: "ВСЕ" })).toHaveAttribute("aria-pressed", "false");
  });

  it("blocks a second transition while one is already in progress", () => {
    vi.useFakeTimers();
    const { container, rail } = renderHome();

    // Start transition to Тренды
    fireEvent.click(within(rail).getByRole("button", { name: "Тренды" }));
    const outgoingAfterFirst = container.querySelector(".home-styles-panel.is-outgoing");

    // Try to start another transition before the lock expires
    fireEvent.click(within(rail).getByRole("button", { name: "Студийный портрет" }));

    // Outgoing panel must still be the original one (ВСЕ), not Тренды
    expect(container.querySelector(".home-styles-panel.is-outgoing")).toBe(outgoingAfterFirst);
    // Active category should remain Тренды, not jump to Студийный портрет
    expect(within(rail).getByRole("button", { name: "Тренды" })).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).getByRole("button", { name: "Студийный портрет" })).toHaveAttribute("aria-pressed", "false");
  });

  it("active panel carries only is-active class after transition completes", () => {
    vi.useFakeTimers();
    const { container, rail } = renderHome();

    fireEvent.click(within(rail).getByRole("button", { name: "Студийный портрет" }));
    act(() => { vi.advanceTimersByTime(SWIPE_LOCK_MS); });

    const activePanel = container.querySelector('.home-styles-panel[aria-hidden="false"]') as HTMLElement;
    expect(activePanel).not.toBeNull();
    expect(activePanel).toHaveClass("is-active");
    // Transition artefact classes must all be gone after the lock timer fires
    expect(activePanel).not.toHaveClass("is-outgoing");
    expect(activePanel).not.toHaveClass("is-entering-next");
    expect(activePanel).not.toHaveClass("is-entering-prev");
    expect(activePanel).not.toHaveClass("is-outgoing-next");
    expect(activePanel).not.toHaveClass("is-outgoing-prev");
  });
});
