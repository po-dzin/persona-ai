import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FALLBACK_MODELS } from "../data/models";
import { FALLBACK_PACKAGES } from "../data/packages";
import { FALLBACK_STYLES } from "../data/styles";
import { getPhotoShareLink, getProfile, sendPhotoToTelegram, toggleFavorite } from "../utils/api";
import { App } from "../App";

const refreshMock = vi.fn().mockResolvedValue([]);
const setPhotosMock = vi.fn();
const uploadPhotoMock = vi.fn().mockResolvedValue("uploads/custom.png");
const runGenerateBackgroundMock = vi.fn();
let photosState: Array<{
  orderId: string;
  styleCode: string;
  modelId: string;
  status: "queued" | "processing" | "done" | "failed";
  prompt?: string;
  resultUrl?: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}> = [];

vi.mock("../hooks/useCatalog", () => ({
  useCatalog: () => ({
    styles: FALLBACK_STYLES,
    models: FALLBACK_MODELS,
    packages: FALLBACK_PACKAGES,
    isLoading: false,
    catalogError: null,
  }),
}));

vi.mock("../hooks/useWalletAndPhotos", () => ({
  useWalletAndPhotos: () => ({
    wallet: { paidCredits: 47 },
    photos: photosState,
    setPhotos: setPhotosMock,
    refresh: refreshMock,
  }),
}));

vi.mock("../hooks/useGenerateFlow", () => ({
  useGenerateFlow: () => ({
    isSubmitting: false,
    lastError: null,
    clearError: vi.fn(),
    uploadPhoto: uploadPhotoMock,
    runGenerateBackground: runGenerateBackgroundMock,
    startGenerate: vi.fn().mockResolvedValue({
      result: "enqueued",
      order: { orderId: "ord-1", status: "queued", creditCost: 10 },
    }),
    buyPackage: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

vi.mock("../utils/haptics", () => ({
  triggerHaptic: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  getPhotoShareLink: vi.fn(),
  getProfile: vi.fn(),
  sendPhotoToTelegram: vi.fn(),
  toggleFavorite: vi.fn(),
}));

describe("App flows", () => {
  // vi.restoreAllMocks() in setup.ts resets vi.fn() implementations between tests;
  // re-configure here so every test starts with working mocks.
  beforeEach(() => {
    photosState = [];
    refreshMock.mockClear();
    setPhotosMock.mockClear();
    uploadPhotoMock.mockReset();
    uploadPhotoMock.mockResolvedValue("uploads/custom.png");
    runGenerateBackgroundMock.mockReset();
    runGenerateBackgroundMock.mockImplementation(() => {});

    vi.mocked(getProfile).mockResolvedValue({
      userId: "u1",
      firstName: "G",
      username: "g_user",
      paidCredits: 47,
      generationsCount: 0,
      referralsCount: 0,
    });
    vi.mocked(sendPhotoToTelegram).mockResolvedValue(undefined);
    vi.mocked(toggleFavorite).mockResolvedValue({ orderId: 'ord-1', isFavorite: true });
    vi.mocked(getPhotoShareLink).mockResolvedValue({ appLink: "https://persona.example/app?ref_style=hollywood" });
  });
  it("restores last screen from localStorage", async () => {
    localStorage.setItem("persona_last_screen", "balance");

    render(<App />);

    expect(await screen.findByText("Пополнить баланс")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("opens style preview from create flow and moves to upload screen", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Создать" }));
    expect(screen.getByText("Создать")).toBeInTheDocument();

    const styleButtons = screen.getAllByRole("button", { name: /Голливуд/ });
    await user.click(styleButtons[styleButtons.length - 1]);

    expect(await screen.findByRole("button", { name: "Создать в этом стиле" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Создать в этом стиле" }));

    // "2/2" is unique to the FlowUploadScreen header — use it as the sentinel
    expect(await screen.findByText("2/2")).toBeInTheDocument();
  });

  it("uses custom flow and returns to photos after inline upload", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Создать" }));
    await user.click(screen.getByRole("button", { name: "Кастом" }));

    await user.type(
      screen.getByPlaceholderText("Опишите желаемый стиль фотосессии..."),
      "editorial style",
    );

    const overlay = document.querySelector(".overlay-screen");
    expect(overlay).not.toBeNull();

    const fileInput = (overlay as HTMLElement).querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;

    expect(fileInput).not.toBeNull();

    const file = new File(["img"], "custom.png", { type: "image/png" });
    await user.upload(fileInput as HTMLInputElement, file);

    // Wait for the button to become enabled (photo validation passes)
    const overlayEl = document.querySelector(".overlay-screen") as HTMLElement;
    const createButton = await waitFor(() => {
      const btn = within(overlayEl).getByRole("button", { name: "Создать" });
      expect(btn).not.toBeDisabled();
      return btn;
    });
    await user.click(createButton);

    // Custom flow uploads inline and navigates straight to photos
    expect(await screen.findByText("Пока нет фото")).toBeInTheDocument();
  });

  it("style flow redirects to photos and keeps generation indicator out of create button", async () => {
    const user = userEvent.setup();
    photosState = [{
      orderId: "ord-processing-1",
      styleCode: "anime",
      modelId: "nano-banana-v1",
      status: "processing",
      isFavorite: false,
      createdAt: new Date("2026-04-02T10:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-04-02T10:00:00.000Z").toISOString(),
    }];

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Создать" }));
    const styleButtons = screen.getAllByRole("button", { name: /Голливуд/ });
    await user.click(styleButtons[styleButtons.length - 1]);
    await user.click(await screen.findByRole("button", { name: "Создать в этом стиле" }));

    const uploadScreen = await screen.findByText("2/2");
    expect(uploadScreen).toBeInTheDocument();

    const overlay = document.querySelector(".overlay-screen");
    expect(overlay).not.toBeNull();
    const fileInput = (overlay as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(["img"], "style-source.png", { type: "image/png" });
    await user.upload(fileInput as HTMLInputElement, file);

    const createButton = await waitFor(() => {
      const overlayEl = document.querySelector(".overlay-screen") as HTMLElement;
      expect(overlayEl).toBeTruthy();
      const btn = within(overlayEl).getByRole("button", { name: "Создать" });
      expect(btn).not.toBeDisabled();
      return btn;
    });
    await user.click(createButton);

    expect(screen.getAllByText("Генерация").length).toBeGreaterThan(0);
    expect(screen.queryByText("Генерация...")).not.toBeInTheDocument();
  });

  it("opens create flow from tab bar even when photo viewer is open", async () => {
    const user = userEvent.setup();
    photosState = [{
      orderId: "ord-done-1",
      styleCode: "hollywood",
      modelId: "nano-banana-v1",
      status: "done",
      prompt: "cinematic portrait",
      resultUrl: "https://example.com/result.jpg",
      isFavorite: false,
      createdAt: new Date("2026-04-02T10:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-04-02T10:00:00.000Z").toISOString(),
    }];

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Мои фото" }));
    await waitFor(() => {
      expect(document.querySelector(".photos-grid .photo-item")).toBeTruthy();
    });
    const hollywoodButtons = screen.getAllByRole("button", { name: "Голливуд" });
    const photoButton = hollywoodButtons.find((btn) => btn.classList.contains("photo-item"));
    expect(photoButton).toBeTruthy();
    await user.click(photoButton as HTMLButtonElement);
    expect(await screen.findByText("Запрос")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Создать" }));
    expect(await screen.findByRole("button", { name: "Кастом" })).toBeInTheDocument();
    expect(screen.queryByText("Запрос")).not.toBeInTheDocument();
  });

  it("keeps style preview open when create tab is tapped again inside create flow", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Создать" }));
    const styleButtons = screen.getAllByRole("button", { name: /Голливуд/ });
    await user.click(styleButtons[styleButtons.length - 1]);
    expect(await screen.findByRole("button", { name: "Создать в этом стиле" })).toBeInTheDocument();

    const tabBarCreate = document.querySelector(".tab-bar .tab-ai") as HTMLButtonElement | null;
    expect(tabBarCreate).toBeTruthy();
    await user.click(tabBarCreate as HTMLButtonElement);

    expect(screen.getByRole("button", { name: "Создать в этом стиле" })).toBeInTheDocument();
    expect(screen.queryByText("2/2")).not.toBeInTheDocument();
  });
});
