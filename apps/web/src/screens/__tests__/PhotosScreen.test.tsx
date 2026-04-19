import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StyleItem } from "../../data/styles";
import type { PhotoRecord } from "../../utils/api";
import { PhotosScreen } from "../PhotosScreen";

const styles: StyleItem[] = [
  {
    id: "hollywood",
    name: "Голливуд",
    category: "Студийный портрет",
    gradient: "var(--sem-gradient-style-violet)",
    promptTemplate: "studio",
  },
  {
    id: "business",
    name: "Бизнес-портрет",
    category: "Бизнес и карьера",
    gradient: "var(--sem-gradient-style-indigo)",
    promptTemplate: "business",
  },
  {
    id: "birthday",
    name: "День рождения",
    category: "Праздники",
    gradient: "var(--sem-gradient-style-green)",
    promptTemplate: "party",
  },
];

const photos: PhotoRecord[] = [
  {
    orderId: "o1",
    styleCode: "hollywood",
    modelId: "nb2-1k",
    status: "done",
    prompt: "p1",
    resultUrl: null,
    isFavorite: false,
    createdAt: "2026-04-10T12:00:00Z",
    updatedAt: "2026-04-10T12:00:00Z",
  },
  {
    orderId: "o2",
    styleCode: "business",
    modelId: "nb2-1k",
    status: "done",
    prompt: "p2",
    resultUrl: null,
    isFavorite: true,
    createdAt: "2026-04-10T12:01:00Z",
    updatedAt: "2026-04-10T12:01:00Z",
  },
  {
    orderId: "o3",
    styleCode: "birthday",
    modelId: "nb2-1k",
    status: "done",
    prompt: "p3",
    resultUrl: null,
    isFavorite: false,
    createdAt: "2026-04-10T12:02:00Z",
    updatedAt: "2026-04-10T12:02:00Z",
  },
];

describe("PhotosScreen", () => {
  it("shows filter chips as Все + Избранные + категории (without per-style chips)", () => {
    const { container } = render(
      <PhotosScreen
        photos={photos}
        styles={styles}
        favorites={new Set(["o2"])}
        onOpenPhoto={vi.fn()}
      />,
    );

    const chipLabels = Array.from(container.querySelectorAll(".photos-filter .filter-chip")).map((chip) =>
      chip.textContent?.trim(),
    );

    expect(chipLabels).toEqual([
      "Все",
      "Избранные",
      "Студийный портрет",
      "Бизнес и карьера",
      "Праздники",
    ]);
    expect(chipLabels).not.toContain("Голливуд");
    expect(chipLabels).not.toContain("Бизнес-портрет");
  });

  it("filters photos by category and favorites", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PhotosScreen
        photos={photos}
        styles={styles}
        favorites={new Set(["o2"])}
        onOpenPhoto={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".photo-item")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Праздники" }));
    expect(container.querySelectorAll(".photo-item")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Избранные" }));
    expect(container.querySelectorAll(".photo-item")).toHaveLength(1);
  });

  it("keeps photo card disabled until preview image has loaded", () => {
    const readyPhoto: PhotoRecord = {
      orderId: "o4",
      styleCode: "hollywood",
      modelId: "nb2-1k",
      status: "done",
      prompt: "p4",
      resultUrl: "https://cdn.example.com/o4.jpg",
      isFavorite: false,
      createdAt: "2026-04-10T12:03:00Z",
      updatedAt: "2026-04-10T12:03:00Z",
    };

    render(
      <PhotosScreen
        photos={[readyPhoto]}
        styles={styles}
        favorites={new Set()}
        onOpenPhoto={vi.fn()}
      />,
    );

    const card = screen.getByRole("button", { name: "Генерация" });
    expect(card).toBeDisabled();

    const preview = screen.getByAltText("Голливуд");
    fireEvent.load(preview);

    expect(screen.getByRole("button", { name: "Голливуд" })).not.toBeDisabled();
  });

  it("does not render failed items and removes broken previews from the grid", () => {
    const visibleDone: PhotoRecord = {
      orderId: "ok-1",
      styleCode: "hollywood",
      modelId: "nb2-1k",
      status: "done",
      prompt: "ok",
      resultUrl: "https://cdn.example.com/ok-1.jpg",
      isFavorite: false,
      createdAt: "2026-04-10T12:10:00Z",
      updatedAt: "2026-04-10T12:10:00Z",
    };
    const failed: PhotoRecord = {
      orderId: "failed-1",
      styleCode: "business",
      modelId: "nb2-1k",
      status: "failed",
      prompt: "failed",
      resultUrl: null,
      isFavorite: false,
      createdAt: "2026-04-10T12:09:00Z",
      updatedAt: "2026-04-10T12:09:00Z",
    };

    const { container } = render(
      <PhotosScreen
        photos={[visibleDone, failed]}
        styles={styles}
        favorites={new Set()}
        onOpenPhoto={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".photo-item")).toHaveLength(1);
    expect(screen.queryByText("Пока нет фото")).not.toBeInTheDocument();

    const preview = screen.getByAltText("Голливуд");
    fireEvent.error(preview);

    expect(container.querySelectorAll(".photo-item")).toHaveLength(0);
    expect(screen.getByText("Пока нет фото")).toBeInTheDocument();
  });
});
