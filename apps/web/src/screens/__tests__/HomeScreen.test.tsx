import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

    expect(categoryButtons.map((button) => button.textContent)).toEqual([
      "ВСЕ",
      "Тренды",
      "Бизнес и карьера",
      "Лайфстайл",
      "Арт и креатив",
      "Особый повод",
    ]);
    expect(within(categoryRail).getByRole("button", { name: "ВСЕ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const activePanel = container.querySelector('.home-styles-panel[aria-hidden="false"]');
    expect(activePanel).toBeTruthy();
    expect(within(activePanel as HTMLElement).getByRole("button", { name: "Голливуд" })).toBeInTheDocument();
    expect(within(activePanel as HTMLElement).getByRole("button", { name: "Аниме" })).toBeInTheDocument();

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
    expect(within(businessPanel as HTMLElement).queryByRole("button", { name: "Аниме" })).not.toBeInTheDocument();
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
        modelId: "nano-banana-v1",
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
        modelId: "nano-banana-v1",
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
    expect(tabButtons).toHaveLength(6);
    expect(tabButtons.map((node) => node.textContent)).toEqual([
      "ВСЕ",
      "Тренды",
      "Бизнес и карьера",
      "Лайфстайл",
      "Арт и креатив",
      "Особый повод",
    ]);
    expect(within(tabsRow).getByRole("button", { name: "ВСЕ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
