import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PhotoRecord } from "../../utils/api";
import { PhotoViewerScreen } from "../PhotoViewerScreen";

const basePhoto = {
  orderId: "ord_1",
  styleCode: "hollywood",
  prompt: "cinematic portrait",
  resultUrl: "https://cdn.example.com/photo.jpg",
  createdAt: "2026-04-02T10:00:00Z",
  status: "done",
} as unknown as PhotoRecord;

function renderViewer(overrides?: Partial<ComponentProps<typeof PhotoViewerScreen>>) {
  const onClose = vi.fn();
  const onSendToTelegram = vi.fn();
  const onToggleFavorite = vi.fn();
  const onDownload = vi.fn();
  const onCopyLink = vi.fn();
  const onUseAsReference = vi.fn();
  const onDeletePhoto = vi.fn();

  render(
    <PhotoViewerScreen
      isOpen
      photo={basePhoto}
      appLink="https://personai.app/share/ord_1"
      style={undefined}
      isFavorite={false}
      onClose={onClose}
      onSendToTelegram={onSendToTelegram}
      onToggleFavorite={onToggleFavorite}
      onDownload={onDownload}
      onCopyLink={onCopyLink}
      onUseAsReference={onUseAsReference}
      onDeletePhoto={onDeletePhoto}
      {...overrides}
    />,
  );

  return {
    onClose,
    onSendToTelegram,
    onToggleFavorite,
    onDownload,
    onCopyLink,
    onUseAsReference,
    onDeletePhoto,
  };
}

describe("PhotoViewerScreen share menu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles main share targets and keeps extra socials out of main menu", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });

    renderViewer();

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    expect(screen.queryByRole("button", { name: "X" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Facebook" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "WhatsApp" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Telegram" }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://t.me/share/url?url="),
      "_blank",
    );

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    await user.click(screen.getByRole("button", { name: "TG Stories" }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("tg://stories/post?url="),
      "_blank",
    );

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    await user.click(screen.getByRole("button", { name: "Instagram" }));
    expect(openSpy).toHaveBeenCalledWith("https://www.instagram.com/create/select/", "_blank");

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    await user.click(screen.getByRole("button", { name: "Threads" }));
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining("https://www.threads.net/intent/post?text="),
        "_blank",
      );
    });

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    await user.click(screen.getByRole("button", { name: "Другое" }));
    expect(screen.queryByRole("button", { name: "Другое" })).not.toBeInTheDocument();
  });

  it("uses system share sheet for 'Другое' when available", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockImplementation(() => null);
    const shareSpy = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "share", { configurable: true, value: shareSpy });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });

    renderViewer();

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    await user.click(screen.getByRole("button", { name: "Другое" }));
    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Создано в PersonAI",
          url: "https://personai.app/share/ord_1",
        }),
      );
    });
  });

  it("calls copy-link and upload-to-bot actions", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockImplementation(() => null);
    const { onCopyLink, onSendToTelegram } = renderViewer();

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    await user.click(screen.getByRole("button", { name: "Копировать ссылку" }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Поделиться" }));
    await user.click(screen.getByRole("button", { name: "Выгрузить в бот" }));
    expect(onSendToTelegram).toHaveBeenCalledTimes(1);
  });
});
