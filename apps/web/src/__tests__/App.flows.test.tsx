import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FALLBACK_MODELS } from "../data/models";
import { FALLBACK_PACKAGES } from "../data/packages";
import { FALLBACK_STYLES } from "../data/styles";
import { getProfile, sendPhotoToTelegram, toggleFavorite } from "../utils/api";
import { App } from "../App";

const refreshMock = vi.fn().mockResolvedValue([]);
const setPhotosMock = vi.fn();

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
    wallet: { free_credit_available: true, paid_credits: 47 },
    photos: [],
    setPhotos: setPhotosMock,
    refresh: refreshMock,
  }),
}));

vi.mock("../hooks/useGenerateFlow", () => ({
  useGenerateFlow: () => ({
    isSubmitting: false,
    lastError: null,
    clearError: vi.fn(),
    startGenerate: vi.fn().mockResolvedValue({
      result: "enqueued",
      order: { order_id: "ord-1", status: "queued", credit_cost: 10 },
    }),
    buyPackage: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

vi.mock("../utils/haptics", () => ({
  triggerHaptic: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  getProfile: vi.fn(),
  sendPhotoToTelegram: vi.fn(),
  toggleFavorite: vi.fn(),
}));

describe("App flows", () => {
  // vi.restoreAllMocks() in setup.ts resets vi.fn() implementations between tests;
  // re-configure here so every test starts with working mocks.
  beforeEach(() => {
    vi.mocked(getProfile).mockResolvedValue({
      user_id: "u1",
      first_name: "G",
      username: "g_user",
      paid_credits: 47,
      free_credit_available: true,
      generations_count: 0,
      referrals_count: 0,
    });
    vi.mocked(sendPhotoToTelegram).mockResolvedValue(undefined);
    vi.mocked(toggleFavorite).mockResolvedValue({ is_favorite: true });
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

    // Style preview is open — the preview name appears in the overlay;
    // the grid card is still in DOM so use the specific preview-name selector.
    await waitFor(() => {
      expect(document.querySelector(".style-preview-name")?.textContent).toBe("Голливуд");
    });
    await user.click(screen.getByRole("button", { name: "Создать в этом стиле" }));

    // "2/2" is unique to the FlowUploadScreen header — use it as the sentinel
    expect(await screen.findByText("2/2")).toBeInTheDocument();
  });

  it("uses custom flow and opens upload with prefilled photo", async () => {
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

    // FlowUploadScreen is now open with the photo pre-filled
    expect(await screen.findByText("Выбранный стиль")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Изменить" })).toBeInTheDocument();
    });
  });
});
