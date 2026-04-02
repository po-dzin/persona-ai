import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_STYLES } from "../../data/styles";
import type { PhotoRecord } from "../../utils/api";
import { HomeScreen } from "../HomeScreen";

describe("HomeScreen", () => {
  it("shows all styles in 'ВСЕ' and filters by selected category", async () => {
    const user = userEvent.setup();
    const onPreviewStyle = vi.fn();

    render(<HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={onPreviewStyle} />);

    expect(screen.getByRole("button", { name: "ВСЕ" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: /Голливуд/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Аниме/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Бизнес и карьера" }));

    expect(screen.getByRole("button", { name: /Бизнес-портрет/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Аниме/ })).not.toBeInTheDocument();
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
    const tabsRow = container.querySelector(".category-tabs-row");
    const panels = container.querySelector(".home-styles-panels");

    expect(queueStack).toBeTruthy();
    expect(queueStack?.children[0]).toHaveClass("stack-back-2");
    expect(queueStack?.children[1]).toHaveClass("stack-back-1");
    expect(queueStack?.children[2]).toHaveClass("stack-front");
    expect(screen.getByText("В очереди")).toBeInTheDocument();
    expect(screen.getByText("2 генерации")).toBeInTheDocument();

    expect(container.firstElementChild?.firstElementChild).toBe(queueStack);
    expect(queueStack?.nextElementSibling).toBe(stickyHeader);
    expect(stickyHeader?.nextElementSibling).toBe(panels);
    expect(stickyHeader).toContainElement(tabsRow);
    expect(tabsRow?.children).toHaveLength(1 + 5);
    expect(Array.from(tabsRow?.children ?? []).map((node) => node.textContent)).toEqual([
      "ВСЕ",
      "Тренды",
      "Бизнес и карьера",
      "Лайфстайл",
      "Арт и креатив",
      "Особый повод",
    ]);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
