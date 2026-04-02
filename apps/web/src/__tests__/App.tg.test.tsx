/**
 * Tests for two root-cause TG integration bugs fixed in fix/tguser-reactivity:
 *
 * 1. Top-inset calculation: safeAreaInset.top + contentSafeAreaInset.top must be
 *    SUMMED (not maxed) — they are separate hardware and TG-chrome layers.
 *
 * 2. TG user reactivity: readTelegramUser() must use live window.Telegram?.WebApp,
 *    not the module-scope `tg` snapshot, and must retry after 300 ms.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getProfile, sendPhotoToTelegram, toggleFavorite } from "../utils/api";

import { FALLBACK_MODELS } from "../data/models";
import { FALLBACK_PACKAGES } from "../data/packages";
import { FALLBACK_STYLES } from "../data/styles";
import { App } from "../App";

// ─── shared mocks ─────────────────────────────────────────────────────────────

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
    wallet: { freeCreditAvailable: false, paidCredits: 0 },
    photos: [],
    setPhotos: vi.fn(),
    refresh: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("../hooks/useGenerateFlow", () => ({
  useGenerateFlow: () => ({
    isSubmitting: false,
    lastError: null,
    clearError: vi.fn(),
    startGenerate: vi.fn().mockResolvedValue({ result: "enqueued" }),
    buyPackage: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

vi.mock("../utils/haptics", () => ({ triggerHaptic: vi.fn() }));

// Profile returns no name/username so TG user values show through as fallback
vi.mock("../utils/api", () => ({
  getProfile: vi.fn(),
  sendPhotoToTelegram: vi.fn(),
  toggleFavorite: vi.fn(),
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeWebApp(overrides: Record<string, unknown> = {}) {
  return {
    ready: vi.fn(),
    expand: vi.fn(),
    onEvent: vi.fn(),
    initData: "",
    initDataUnsafe: {} as Record<string, unknown>,
    viewportHeight: undefined as number | undefined,
    viewportStableHeight: undefined as number | undefined,
    safeAreaInset: undefined as { top: number; bottom: number; left: number; right: number } | undefined,
    contentSafeAreaInset: undefined as { top: number; bottom: number; left: number; right: number } | undefined,
    isFullscreen: false,
    ...overrides,
  };
}

function setTelegramWebApp(webApp: ReturnType<typeof makeWebApp> | null) {
  if (webApp === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Telegram;
  } else {
    Object.defineProperty(window, "Telegram", {
      value: { WebApp: webApp },
      configurable: true,
      writable: true,
    });
  }
}

function getCssInset(): number {
  return parseInt(document.documentElement.style.getPropertyValue("--tg-top-inset") || "0", 10);
}

// vi.restoreAllMocks() in setup.ts resets vi.fn() implementations between tests;
// re-configure here so every test starts with working mocks.
beforeEach(() => {
  vi.mocked(getProfile).mockResolvedValue({
    userId: "0",
    firstName: null,
    username: null,
    paidCredits: 0,
    freeCreditAvailable: false,
    generationsCount: 0,
    referralsCount: 0,
  });
  vi.mocked(sendPhotoToTelegram).mockResolvedValue(undefined);
  vi.mocked(toggleFavorite).mockResolvedValue({ isFavorite: true });
});

afterEach(() => {
  setTelegramWebApp(null);
  document.documentElement.style.removeProperty("--tg-top-inset");
  document.documentElement.style.removeProperty("--tg-bottom-inset");
});

// ─── 1. Top-inset calculation ─────────────────────────────────────────────────

describe("TG safe-area top inset", () => {
  it("sets --tg-top-inset to 0 when window.Telegram is absent", async () => {
    setTelegramWebApp(null);
    render(<App />);
    await waitFor(() => expect(getCssInset()).toBe(0));
  });

  it("sums safeAreaInset.top + contentSafeAreaInset.top (hardware notch + TG chrome)", async () => {
    // iPhone 14: notch ≈ 47 px, TG close-button area ≈ 52 px → must sum to 99 px
    setTelegramWebApp(
      makeWebApp({
        safeAreaInset: { top: 47, bottom: 0, left: 0, right: 0 },
        contentSafeAreaInset: { top: 52, bottom: 0, left: 0, right: 0 },
      }),
    );

    render(<App />);

    await waitFor(() => {
      // Must be the SUM (99), not Math.max (52)
      expect(getCssInset()).toBeGreaterThanOrEqual(99);
    });
  });

  it("uses window.innerHeight - viewportStableHeight when stableH is available", async () => {
    const innerH = window.innerHeight; // jsdom default: 768
    setTelegramWebApp(
      makeWebApp({
        viewportStableHeight: innerH - 110,
        viewportHeight: innerH - 110,
        safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
    );

    render(<App />);

    await waitFor(() => {
      // window.innerHeight - stableH = 110
      expect(getCssInset()).toBeGreaterThanOrEqual(110);
    });
  });

  it("prefers stableH-derived value over tgChromeTop when stableH gap is larger", async () => {
    const innerH = window.innerHeight;
    setTelegramWebApp(
      makeWebApp({
        viewportStableHeight: innerH - 120,
        safeAreaInset: { top: 20, bottom: 0, left: 0, right: 0 },
        contentSafeAreaInset: { top: 30, bottom: 0, left: 0, right: 0 },
      }),
    );

    render(<App />);

    await waitFor(() => {
      // max(20+30=50, 120) → 120
      expect(getCssInset()).toBeGreaterThanOrEqual(120);
    });
  });

  it("re-applies inset after 150ms retry when SDK reports contentSafeAreaInset lazily", async () => {
    vi.useFakeTimers();

    const webApp = makeWebApp({
      safeAreaInset: { top: 44, bottom: 0, left: 0, right: 0 },
      contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    setTelegramWebApp(webApp);

    render(<App />);

    // Initial call: contentSafeTop = 0, so inset = 44
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(getCssInset()).toBe(44);

    // SDK now reports contentSafeAreaInset lazily (simulates real TG behaviour)
    webApp.contentSafeAreaInset = { top: 50, bottom: 0, left: 0, right: 0 };

    // 150ms retry fires — should now sum 44 + 50 = 94
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(getCssInset()).toBeGreaterThanOrEqual(44 + 50);

    vi.useRealTimers();
  });

  it("re-applies inset again after 600ms as final fallback", async () => {
    vi.useFakeTimers();

    const webApp = makeWebApp({
      safeAreaInset: { top: 47, bottom: 0, left: 0, right: 0 },
      contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    setTelegramWebApp(webApp);

    render(<App />);

    await act(async () => { vi.advanceTimersByTime(150); });
    webApp.contentSafeAreaInset = { top: 55, bottom: 0, left: 0, right: 0 };

    await act(async () => { vi.advanceTimersByTime(600); });
    expect(getCssInset()).toBeGreaterThanOrEqual(47 + 55);

    vi.useRealTimers();
  });
});

// ─── 2. TG user reactivity ───────────────────────────────────────────────────

describe("TG user reactivity", () => {
  it("reads TG user from initDataUnsafe.user via live window.Telegram.WebApp", async () => {
    setTelegramWebApp(
      makeWebApp({
        initDataUnsafe: { user: { id: 123, first_name: "Алиса", username: "alice_tg" } },
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Профиль" }));

    // profile API returns null username, so tgUser.username is the fallback
    await waitFor(() => {
      expect(screen.getByText("@alice_tg")).toBeInTheDocument();
    });
  });

  it("parses TG user from initData string when initDataUnsafe is empty", async () => {
    const userObj = { id: 456, first_name: "Борис", username: "boris_tg" };
    const initData = `user=${encodeURIComponent(JSON.stringify(userObj))}`;

    setTelegramWebApp(makeWebApp({ initData, initDataUnsafe: {} }));

    const ue = userEvent.setup();
    render(<App />);

    await ue.click(screen.getByRole("button", { name: "Профиль" }));

    await waitFor(() => {
      expect(screen.getByText("@boris_tg")).toBeInTheDocument();
    });
  });

  it("retries reading TG user after 300ms for lazy SDK population", async () => {
    vi.useFakeTimers();

    const webApp = makeWebApp({ initDataUnsafe: {} });
    setTelegramWebApp(webApp);

    render(<App />);
    await act(async () => { vi.advanceTimersByTime(0); });

    // Navigate to profile using fireEvent (avoids userEvent timer conflicts)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Профиль" }));
      vi.advanceTimersByTime(0);
    });

    // SDK populates user before the 300ms retry fires
    webApp.initDataUnsafe = { user: { id: 789, first_name: "Вера", username: "vera_tg" } };

    // Advance past 300ms retry
    await act(async () => { vi.advanceTimersByTime(350); });

    expect(screen.getByText("@vera_tg")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("shows Пользователь fallback when TG SDK is absent and profile has no name", async () => {
    setTelegramWebApp(null);

    const ue = userEvent.setup();
    render(<App />);

    await ue.click(screen.getByRole("button", { name: "Профиль" }));

    await waitFor(() => {
      expect(screen.getByText("Пользователь")).toBeInTheDocument();
    });
  });
});
