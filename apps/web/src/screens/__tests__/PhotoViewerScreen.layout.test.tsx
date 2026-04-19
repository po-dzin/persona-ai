import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_STYLES } from "../../data/styles";
import type { PhotoRecord } from "../../utils/api";
import { PhotoViewerScreen } from "../PhotoViewerScreen";

const basePhoto: PhotoRecord = {
  orderId: "ord_1",
  styleCode: "hollywood",
  modelId: "nb2-1k",
  status: "done",
  prompt: "cinematic portrait",
  resultUrl: "https://cdn.example.com/photo.jpg",
  isFavorite: false,
  createdAt: "2026-04-02T10:00:00Z",
  updatedAt: "2026-04-02T10:01:00Z",
};

function renderViewer(overrides?: Partial<ComponentProps<typeof PhotoViewerScreen>>) {
  return render(
    <PhotoViewerScreen
      isOpen
      photo={basePhoto}
      appLink="https://personai.app/share/ord_1"
      style={FALLBACK_STYLES[0]}
      isFavorite={false}
      onClose={vi.fn()}
      onSendToTelegram={vi.fn()}
      onToggleFavorite={vi.fn()}
      onDownload={vi.fn()}
      onCopyLink={vi.fn()}
      onUseAsReference={vi.fn()}
      onDeletePhoto={vi.fn()}
      {...overrides}
    />,
  );
}

describe("PhotoViewerScreen layout", () => {
  it("keeps the photo block, actions row, and prompt block order intact", () => {
    const { container } = renderViewer();

    expect(screen.getByRole("button", { name: "Назад" })).toBeInTheDocument();
    expect(screen.getByText("Фото")).toBeInTheDocument();
    expect(screen.getByAltText("Голливуд")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скачать" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить в избранное" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Поделиться" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Действия" })).toBeInTheDocument();

    const photoBlock = container.querySelector(".viewer-photo");
    const body = container.querySelector(".viewer-body");
    const styleBlock = container.querySelector(".viewer-style-block");
    const promptBlock = container.querySelector(".viewer-prompt-block");
    const promptHeader = container.querySelector(".viewer-prompt-header");
    const actionsRow = container.querySelector(".viewer-actions-row");

    expect(photoBlock).toBeTruthy();
    expect(body).toBeTruthy();
    expect(styleBlock).toBeTruthy();
    expect(promptBlock).toBeTruthy();
    expect(promptHeader).toBeTruthy();
    expect(actionsRow).toBeTruthy();
    expect(photoBlock?.nextElementSibling).toBe(body);
    expect(body?.children[0]).toBe(actionsRow);
    expect(body?.children[1]).toBe(styleBlock);
    expect(body?.children[2]).toBe(promptBlock);
    expect(within(actionsRow as HTMLElement).getAllByRole("button")).toHaveLength(4);
    expect(within(actionsRow as HTMLElement).getByRole("button", { name: "Добавить в избранное" })).toBeInTheDocument();
    expect(within(actionsRow as HTMLElement).getByRole("button", { name: "Скачать" })).toBeInTheDocument();
    expect(within(actionsRow as HTMLElement).getByRole("button", { name: "Поделиться" })).toBeInTheDocument();
    expect(within(actionsRow as HTMLElement).getByRole("button", { name: "Действия" })).toBeInTheDocument();
    expect(styleBlock?.children[0]).toHaveTextContent("Стиль");
    expect(styleBlock?.children[1]).toHaveTextContent("Голливуд");
    expect(promptBlock?.firstElementChild).toBe(promptHeader);
    expect(promptHeader?.children[0]).toHaveTextContent("Запрос");
    expect(promptHeader?.children[1]).toHaveAttribute("aria-label", "Копировать промпт");
  });
});
