import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent } from "react";

import { Modal } from "./components/Modal";
import { TabBar } from "./components/TabBar";
import { useCatalog } from "./hooks/useCatalog";
import { useGenerateFlow } from "./hooks/useGenerateFlow";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useScreen, type BaseScreen } from "./hooks/useScreen";
import { useWalletAndPhotos } from "./hooks/useWalletAndPhotos";
import { BalanceScreen } from "./screens/BalanceScreen";
import { CategoryScreen } from "./screens/CategoryScreen";
import { FlowStyleScreen } from "./screens/FlowStyleScreen";
import { FlowUploadScreen } from "./screens/FlowUploadScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LegalDocumentScreen } from "./screens/LegalDocumentScreen";
import { ModelsPricingScreen } from "./screens/ModelsPricingScreen";
import { PhotosScreen } from "./screens/PhotosScreen";
import { PhotoViewerScreen } from "./screens/PhotoViewerScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PurchaseScreen } from "./screens/PurchaseScreen";
import { StylePreviewScreen } from "./screens/StylePreviewScreen";
import type { PackageItem } from "./data/packages";
import type { StyleItem } from "./data/styles";
import type { SourceTab } from "../../../../shared/contracts/ui";
import { createPurchaseInvoice, deletePhoto, getPhotoShareLink, getProfile, getSharedPhoto, sendPhotoToTelegram, toggleFavorite, type GenerateResult, type PhotoRecord, type UserProfile } from "./utils/api";
import { triggerHaptic } from "./utils/haptics";
import { readMotionTokenMs } from "./utils/motionTokens";
import { isPhotoGenerating } from "./utils/photoStatus";

// Telegram WebApp integration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        initData?: string;
        initDataUnsafe?: {
          user?: { id: number; first_name?: string; username?: string };
        };
        viewportHeight?: number;
        viewportStableHeight?: number;
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
        onEvent?(event: string, callback: () => void): void;
        openInvoice?(url: string, callback?: (status: string) => void): void;
        disableVerticalSwipes?(): void;
        enableVerticalSwipes?(): void;
        isVerticalSwipesEnabled?: boolean;
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
type TgUser = { id: number; first_name?: string; username?: string; photo_url?: string };
type SharePreview = { orderId?: string };
type LegalDocId = "privacy" | "terms" | "payments" | "disclaimer";

const LEGAL_DOCS: Record<LegalDocId, { title: string; updatedAt: string; sections: Array<{ heading?: string; paragraphs: string[] }> }> = {
  privacy: {
    title: "Политика конфиденциальности",
    updatedAt: "4 апреля 2026",
    sections: [
      {
        heading: "Какие данные мы обрабатываем",
        paragraphs: [
          "Мы обрабатываем данные Telegram-профиля, технические логи использования сервиса и файлы, которые вы загружаете для генерации.",
          "Данные используются только для работы продукта, улучшения качества сервиса и поддержки пользователей.",
        ],
      },
      {
        heading: "Хранение и удаление",
        paragraphs: [
          "Исходные изображения хранятся ограниченное время, достаточное для обработки и выдачи результата.",
          "Вы можете запросить удаление данных через поддержку; критичные учетные и платежные события хранятся в объеме, требуемом законом и безопасностью.",
        ],
      },
    ],
  },
  terms: {
    title: "Пользовательское соглашение",
    updatedAt: "4 апреля 2026",
    sections: [
      {
        heading: "Условия использования",
        paragraphs: [
          "Используя сервис, вы подтверждаете, что имеете право загружать контент и не нарушаете права третьих лиц.",
          "Запрещено использовать продукт для незаконной деятельности, спама, обхода ограничений и публикации запрещенного контента.",
        ],
      },
      {
        heading: "Ограничение доступа",
        paragraphs: [
          "Мы можем ограничить или приостановить доступ при нарушении правил или при рисках безопасности.",
        ],
      },
    ],
  },
  payments: {
    title: "Политика обработки платежей",
    updatedAt: "4 апреля 2026",
    sections: [
      {
        heading: "Платежи и начисления",
        paragraphs: [
          "Оплата внутри приложения выполняется через доступные платежные провайдеры платформы.",
          "После успешной оплаты монеты начисляются на баланс аккаунта и используются для генераций по тарифам, указанным в интерфейсе.",
        ],
      },
      {
        heading: "Возвраты",
        paragraphs: [
          "Возвраты рассматриваются индивидуально через поддержку с учетом факта оказания услуги и правил платежного провайдера.",
          "При технической ошибке генерации мы можем автоматически компенсировать списание в рамках внутренних правил сервиса.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "Отказ от ответственности",
    updatedAt: "4 апреля 2026",
    sections: [
      {
        heading: "Общий отказ",
        paragraphs: [
          "Сервис предоставляется по модели «как есть» без гарантий абсолютной бесперебойности и отсутствия ошибок.",
          "Результаты генерации могут содержать неточности и не являются профессиональной консультацией любого вида.",
        ],
      },
      {
        heading: "Ответственность пользователя",
        paragraphs: [
          "Пользователь несет ответственность за законность контента, который загружает, публикует и распространяет через сервис.",
        ],
      },
    ],
  },
};

function parseTgUserFromInitData(initData?: string): TgUser | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TgUser>;
    if (typeof parsed?.id !== "number" || !Number.isFinite(parsed.id)) return null;
    return { id: parsed.id, first_name: parsed.first_name, username: parsed.username };
  } catch {
    return null;
  }
}

function readTelegramUser(): TgUser | null {
  // Always read live — module-scope `tg` may be stale if SDK injected after evaluation
  const liveTg = window.Telegram?.WebApp ?? tg;
  const unsafe = liveTg?.initDataUnsafe?.user;
  if (unsafe?.id) return unsafe;
  return parseTgUserFromInitData(liveTg?.initData);
}

function readSharePreviewFromUrl(): SharePreview | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("share_order")?.trim() || undefined;
  if (!orderId) return null;
  return { orderId };
}

function clearSharePreviewFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("share_order");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

const _tgUserSnapshot = readTelegramUser();

function _getWebUserId(): string {
  const key = "persona_web_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.max(1, Math.floor(Math.abs(a)));
  let y = Math.max(1, Math.floor(Math.abs(b)));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function aspectRatioFromSize(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "1:1";
  }
  const gcd = greatestCommonDivisor(width, height);
  const rw = Math.max(1, Math.round(width / gcd));
  const rh = Math.max(1, Math.round(height / gcd));
  return `${rw}:${rh}`;
}

async function readImageAspectRatio(file: File): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const ratio = await new Promise<string | null>((resolve) => {
      const img = new Image();
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(value);
      };
      const timeoutId = window.setTimeout(() => finish(null), 1200);
      img.onload = () => finish(aspectRatioFromSize(img.naturalWidth, img.naturalHeight));
      img.onerror = () => finish(null);
      img.src = objectUrl;
    });
    return ratio;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function App() {
  // Reactive TG user — initDataUnsafe may be empty before tg.ready() on some versions.
  const [tgUser, setTgUser] = useState<TgUser | null>(
    () => _tgUserSnapshot ?? null,
  );
  const [userId, setUserId] = useState<string>(
    () => (_tgUserSnapshot?.id ? String(_tgUserSnapshot.id) : _getWebUserId()),
  );

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const refreshProfile = useCallback(() => {
    getProfile().then(setProfile).catch(() => null);
  }, []);

  useEffect(() => {
    const liveTgInit = window.Telegram?.WebApp ?? tg;
    liveTgInit?.ready();
    liveTgInit?.expand();
    liveTgInit?.disableVerticalSwipes?.();
    try {
      if (liveTgInit) liveTgInit.isVerticalSwipesEnabled = false;
    } catch {
      // no-op: some clients expose read-only API surface
    }

    // Re-read TG user after ready() in case it was populated lazily.
    const u = readTelegramUser();
    if (u) {
      setTgUser(u);
      setUserId(String(u.id));
    }
    // Retry after 300ms — some TG versions populate initDataUnsafe/initData after ready().
    // Always call refreshProfile even if userId didn't change: initData may now be available
    // for auth even when initDataUnsafe.user is null.
    const tUser = setTimeout(() => {
      const u2 = readTelegramUser();
      if (u2?.id) { setTgUser(u2); setUserId(String(u2.id)); }
      refreshProfile();
    }, 300);
    // Second retry at 1200ms for slow TG SDK environments
    const tUser2 = setTimeout(() => {
      const u3 = readTelegramUser();
      if (u3?.id) { setTgUser(u3); setUserId(String(u3.id)); }
      refreshProfile();
    }, 1200);

    const isPhotoZoomTarget = (target: EventTarget | null) => {
      return target instanceof Element && Boolean(target.closest("[data-photo-zoom='true']"));
    };
    // Keep interface stable: block browser pinch except inside dedicated photo zoom areas.
    const preventGesture = (event: Event) => {
      if (isPhotoZoomTarget(event.target)) return;
      event.preventDefault();
    };
    const preventPinchTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1 && !isPhotoZoomTarget(event.target)) {
        event.preventDefault();
      }
    };

    // Calculate top/bottom insets from TG viewport and safe-area metrics.
    // Re-read window.Telegram?.WebApp dynamically — the module-scope `tg` may have
    // been evaluated before Telegram injected its SDK into window.
    const applyInsets = () => {
      const liveTg = window.Telegram?.WebApp ?? tg;
      const root = document.documentElement;

      const safeTop = liveTg?.safeAreaInset?.top ?? 0;
      const contentSafeTop = liveTg?.contentSafeAreaInset?.top ?? 0;

      // safeTop  = device notch/rounded corners (hardware layer)
      // contentSafeTop = TG chrome on top (close button etc.) — must be ADDED, not maxed
      const tgChromeTop = safeTop + contentSafeTop;
      const stableH =
        typeof liveTg?.viewportStableHeight === "number"
          ? liveTg.viewportStableHeight
          : undefined;
      const activeEl = document.activeElement as HTMLElement | null;
      const isKeyboardInputFocused = Boolean(
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable),
      );
      const stableGapTop =
        typeof stableH === "number" && !isKeyboardInputFocused
          ? Math.max(0, window.innerHeight - stableH)
          : 0;
      const topInset = liveTg ? Math.max(tgChromeTop, stableGapTop) : 0;
      root.style.setProperty("--tg-top-inset", `${topInset}px`);

      const safeBottom = Math.max(0, liveTg?.safeAreaInset?.bottom ?? 0);
      const contentSafeBottom = Math.max(0, liveTg?.contentSafeAreaInset?.bottom ?? 0);
      const bottomInset = Math.max(safeBottom, contentSafeBottom);
      root.style.setProperty(
        "--tg-bottom-inset",
        bottomInset > 0 ? String(bottomInset) + "px" : "env(safe-area-inset-bottom, 0px)",
      );
    };

    const applyKeyboardInset = () => {
      const root = document.documentElement;
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty("--keyboard-inset", "0px");
        return;
      }
      const delta = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--keyboard-inset", `${delta}px`);
    };

    applyInsets();
    applyKeyboardInset();
    // Re-apply after short delay — TG SDK may report isFullscreen / safeAreaInset lazily
    const t1 = setTimeout(applyInsets, 150);
    const t2 = setTimeout(applyInsets, 600);
    liveTgInit?.onEvent?.("viewportChanged", applyInsets);
    liveTgInit?.onEvent?.("safeAreaChanged", applyInsets);
    liveTgInit?.onEvent?.("contentSafeAreaChanged", applyInsets);
    liveTgInit?.onEvent?.("fullscreenChanged", applyInsets);
    window.addEventListener("focusin", applyInsets);
    window.addEventListener("focusout", applyInsets);
    window.addEventListener("focusin", applyKeyboardInset);
    window.addEventListener("focusout", applyKeyboardInset);
    window.visualViewport?.addEventListener("resize", applyKeyboardInset);
    window.visualViewport?.addEventListener("scroll", applyKeyboardInset);
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    document.addEventListener("touchmove", preventPinchTouchMove, { passive: false });
    return () => {
      clearTimeout(tUser);
      clearTimeout(tUser2);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("focusin", applyInsets);
      window.removeEventListener("focusout", applyInsets);
      window.removeEventListener("focusin", applyKeyboardInset);
      window.removeEventListener("focusout", applyKeyboardInset);
      window.visualViewport?.removeEventListener("resize", applyKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", applyKeyboardInset);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", preventPinchTouchMove);
    };
  }, [refreshProfile]);

  const { styles, models, packages } = useCatalog();
  const walletAndPhotos = useWalletAndPhotos(userId);
  const { wallet, photos, setPhotos, refresh } = walletAndPhotos;
  const setWallet = walletAndPhotos.setWallet ?? (() => undefined);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile, userId]);
  const { isSubmitting, lastError, clearError, uploadPhoto, runGenerateBackground } = useGenerateFlow();

  const {
    activeScreen,
    setActiveScreen,
    flowStyleOpen,
    setFlowStyleOpen,
    flowUploadOpen,
    setFlowUploadOpen,
    viewerOpen,
    setViewerOpen,
    modelsOpen,
    setModelsOpen,
  } = useScreen();
  const prefersReducedMotion = usePrefersReducedMotion();
  const screenHandoffDelayMs = useMemo(
    () => (prefersReducedMotion ? 0 : readMotionTokenMs("--cmp-motion-external-app-handoff", 260)),
    [prefersReducedMotion],
  );
  const screenTransitionTimerRef = useRef<number | null>(null);

  const [selectedStyle, setSelectedStyle] = useState<StyleItem | null>(styles[0] || null);
  const [selectedModelId, setSelectedModelId] = useState(models[0]?.id || "nano-banana-v1");
  const selectedModelCost = models.find((m) => m.id === selectedModelId)?.coins ?? 10;
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
  const [selectedSourceTab, setSelectedSourceTab] = useState<SourceTab>("styles");
  const [prefilledUploadPhoto, setPrefilledUploadPhoto] = useState<File | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [selectedPhotoShareLink, setSelectedPhotoShareLink] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Тренды");
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const favoriteOrderIds = useMemo(
    () => new Set(photos.filter((p) => p.isFavorite).map((p) => p.orderId)),
    [photos],
  );
  const [flowInitialTab, setFlowInitialTab] = useState<SourceTab>("styles");
  const [flowInitialCustomPrompt, setFlowInitialCustomPrompt] = useState("");
  const [flowInitialCustomModelId, setFlowInitialCustomModelId] = useState<string | undefined>(undefined);

  const [seenDoneOrderIds, setSeenDoneOrderIds] = useState<Set<string>>(new Set());
  const [renderReadyOrderIds, setRenderReadyOrderIds] = useState<Set<string>>(new Set());
  const renderPreloadInFlightRef = useRef<Set<string>>(new Set());
  const photosSeedRef = useRef(false);
  const doneOrderIds = useMemo(
    () =>
      photos
        .filter((p) => p.status === "done" && Boolean(p.resultUrl))
        .map((p) => p.orderId),
    [photos],
  );
  const newPhotosCount = useMemo(
    () => doneOrderIds.filter((orderId) => !seenDoneOrderIds.has(orderId)).length,
    [doneOrderIds, seenDoneOrderIds],
  );
  // Seed baseline on first load so existing photos don't appear as "new"
  useEffect(() => {
    if (photosSeedRef.current) return;
    if (!doneOrderIds.length) return;
    photosSeedRef.current = true;
    setSeenDoneOrderIds(new Set(doneOrderIds));
  }, [doneOrderIds]);
  // Reset badge when user opens/reopens photos tab
  useEffect(() => {
    if (activeScreen !== "photos") return;
    setSeenDoneOrderIds((prev) => {
      const next = new Set(prev);
      doneOrderIds.forEach((id) => next.add(id));
      return next;
    });
  }, [activeScreen, doneOrderIds]);

  // Keep "generating" UI state until image bytes are actually reachable/renderable.
  useEffect(() => {
    photos.forEach((photo) => {
      const isDone = String(photo.status || "").toLowerCase() === "done";
      if (!isDone || !photo.resultUrl) return;
      if (renderReadyOrderIds.has(photo.orderId)) return;
      if (renderPreloadInFlightRef.current.has(photo.orderId)) return;

      renderPreloadInFlightRef.current.add(photo.orderId);
      const img = new Image();
      img.onload = () => {
        renderPreloadInFlightRef.current.delete(photo.orderId);
        setRenderReadyOrderIds((prev) => {
          if (prev.has(photo.orderId)) return prev;
          const next = new Set(prev);
          next.add(photo.orderId);
          return next;
        });
      };
      img.onerror = () => {
        // Stop endless spinners on broken image URLs.
        renderPreloadInFlightRef.current.delete(photo.orderId);
        setRenderReadyOrderIds((prev) => {
          if (prev.has(photo.orderId)) return prev;
          const next = new Set(prev);
          next.add(photo.orderId);
          return next;
        });
      };
      img.src = photo.resultUrl;
    });
  }, [photos, renderReadyOrderIds]);

  const uiGeneratingOrderIds = useMemo(() => {
    const ids = new Set<string>();
    photos.forEach((photo) => {
      if (isPhotoGenerating(photo)) {
        ids.add(photo.orderId);
        return;
      }
      const isDone = String(photo.status || "").toLowerCase() === "done";
      if (isDone && photo.resultUrl && !renderReadyOrderIds.has(photo.orderId)) {
        ids.add(photo.orderId);
      }
    });
    return ids;
  }, [photos, renderReadyOrderIds]);

  const [queuedModalOpen, setQueuedModalOpen] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocId | null>(null);
  const [lastChargedCoins, setLastChargedCoins] = useState<number | null>(null);
  const [asyncFailError, setAsyncFailError] = useState<string | null>(null);
  const [createActionLocked, setCreateActionLocked] = useState(false);
  const [paywallModalOpen, setPaywallModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  // purchaseSuccessOpen removed — Telegram's native openInvoice already shows payment success UI
  const [stylePreviewOpen, setStylePreviewOpen] = useState(false);
  const [stylePreviewBackToFlow, setStylePreviewBackToFlow] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const appliedSharePresetRef = useRef(false);
  const sharedPreviewOrderRef = useRef<string | null>(null);
  const failedSeededRef = useRef(false);
  const notifiedFailedOrdersRef = useRef<Set<string>>(new Set());
  const pendingChargeByOrderRef = useRef<Map<string, number>>(new Map());

  const stylesById = useMemo(() => Object.fromEntries(styles.map((style) => [style.id, style])), [styles]);
  const hasEnoughCoinsForModel = useCallback((modelId: string) => {
    const cost = models.find((m) => m.id === modelId)?.coins ?? 0;
    if (wallet.freeCreditAvailable) return true;
    return wallet.paidCredits >= cost;
  }, [models, wallet.freeCreditAvailable, wallet.paidCredits]);

  const chargeCoinsOptimistically = useCallback((orderId: string, cost: number | null | undefined) => {
    const normalizedCost = typeof cost === "number" && cost > 0 ? Math.round(cost) : 0;
    if (!orderId || normalizedCost <= 0) return;
    if (pendingChargeByOrderRef.current.has(orderId)) return;
    pendingChargeByOrderRef.current.set(orderId, normalizedCost);
    setWallet((prev) => ({
      ...prev,
      paidCredits: Math.max(0, prev.paidCredits - normalizedCost),
    }));
  }, [setWallet]);

  const settleOptimisticCharge = useCallback((orderId: string, finalCost?: number | null) => {
    if (!orderId) return;
    const charged = pendingChargeByOrderRef.current.get(orderId);
    if (typeof charged !== "number") return;
    pendingChargeByOrderRef.current.delete(orderId);
    const normalizedFinal = typeof finalCost === "number" && finalCost > 0 ? Math.round(finalCost) : 0;
    const delta = charged - normalizedFinal;
    if (delta === 0) return;
    setWallet((prev) => ({
      ...prev,
      paidCredits: Math.max(0, prev.paidCredits + delta),
    }));
  }, [setWallet]);

  const cancelPendingScreenTransition = useCallback(() => {
    if (screenTransitionTimerRef.current) {
      window.clearTimeout(screenTransitionTimerRef.current);
      screenTransitionTimerRef.current = null;
    }
  }, []);

  const closeTransientLayers = useCallback(() => {
    setFlowStyleOpen(false);
    setFlowUploadOpen(false);
    setPrefilledUploadPhoto(null);
    setStylePreviewOpen(false);
    setCategoryOpen(false);
    setPurchaseOpen(false);
    setViewerOpen(false);
    setModelsOpen(false);
    setCreateActionLocked(false);
  }, [
    setFlowStyleOpen,
    setFlowUploadOpen,
    setPrefilledUploadPhoto,
    setStylePreviewOpen,
    setCategoryOpen,
    setPurchaseOpen,
    setViewerOpen,
    setModelsOpen,
    setCreateActionLocked,
  ]);

  const transitionToScreen = useCallback(
    (screen: BaseScreen, options?: { closeTransientLayers?: boolean }) => {
      if (options?.closeTransientLayers ?? true) {
        closeTransientLayers();
      }
      setActiveLegalDoc(null);
      cancelPendingScreenTransition();
      if (screenHandoffDelayMs <= 0) {
        setActiveScreen(screen);
        return;
      }
      screenTransitionTimerRef.current = window.setTimeout(() => {
        setActiveScreen(screen);
        screenTransitionTimerRef.current = null;
      }, screenHandoffDelayMs);
    },
    [cancelPendingScreenTransition, closeTransientLayers, screenHandoffDelayMs, setActiveScreen],
  );

  useEffect(() => {
    return () => {
      cancelPendingScreenTransition();
    };
  }, [cancelPendingScreenTransition]);

  useEffect(() => {
    const failedOrderIds = photos.filter((p) => p.status === "failed").map((p) => p.orderId);
    if (!failedSeededRef.current) {
      notifiedFailedOrdersRef.current = new Set(failedOrderIds);
      failedSeededRef.current = true;
      return;
    }
    const unseenFailed = failedOrderIds.find((orderId) => !notifiedFailedOrdersRef.current.has(orderId));
    if (!unseenFailed) return;
    notifiedFailedOrdersRef.current.add(unseenFailed);
    setAsyncFailError("Генерация завершилась с технической ошибкой. Монеты возвращены автоматически.");
  }, [photos]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedPhoto?.orderId) {
      setSelectedPhotoShareLink("");
      return () => {
        cancelled = true;
      };
    }
    if (selectedPhoto.orderId.startsWith("shared-")) {
      const sharedOrderId = sharedPreviewOrderRef.current;
      const fallback = sharedOrderId
        ? `${window.location.origin}${window.location.pathname}?share_order=${encodeURIComponent(sharedOrderId)}`
        : window.location.origin;
      setSelectedPhotoShareLink(fallback);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const share = await getPhotoShareLink(selectedPhoto.orderId);
        if (!cancelled) setSelectedPhotoShareLink(share.appLink);
      } catch {
        if (!cancelled) setSelectedPhotoShareLink(window.location.origin);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPhoto?.orderId]);

  const addOptimisticGeneration = useCallback((payload: {
    styleCode: string;
    modelId: string;
    prompt: string;
  }): string => {
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    setPhotos((prev) => [
      {
        orderId: optimisticId,
        styleCode: payload.styleCode,
        modelId: payload.modelId,
        status: "processing",
        prompt: payload.prompt,
        resultUrl: null,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
    return optimisticId;
  }, [setPhotos]);

  const removeOptimisticGeneration = useCallback((optimisticId: string) => {
    setPhotos((prev) => prev.filter((p) => p.orderId !== optimisticId));
  }, [setPhotos]);

  const replaceOptimisticGeneration = useCallback((optimisticId: string, response: GenerateResult) => {
    const responseOrderId = response.order?.orderId;
    if (!responseOrderId) return;
    const hasResult = Boolean(response.order?.resultUrl);
    const responseStatus = hasResult ? "done" : "queued";
    const now = new Date().toISOString();
    setPhotos((prev) =>
      prev.map((photo) =>
        photo.orderId === optimisticId
          ? {
              ...photo,
              orderId: responseOrderId,
              status: responseStatus,
              resultUrl: response.order?.resultUrl ?? null,
              updatedAt: now,
            }
          : photo,
      ),
    );
  }, [setPhotos]);

  const openCreate = () => {
    setActiveLegalDoc(null);
    cancelPendingScreenTransition();
    // If already in create flow, don't reset — user stays where they are
    if (flowStyleOpen || flowUploadOpen || (stylePreviewOpen && stylePreviewBackToFlow)) return;

    // Photo viewer must not stay on top of create flow.
    setViewerOpen(false);
    setPurchaseOpen(false);
    setStylePreviewOpen(false);
    setCategoryOpen(false);
    setModelsOpen(false);

    // Reset all create-flow state so each session starts clean
    setCreateActionLocked(false);
    setFlowInitialTab("styles");
    setPrefilledUploadPhoto(null);
    setFlowInitialCustomPrompt("");
    setFlowInitialCustomModelId(undefined);
    setSelectedStyle(styles[0] || null);
    setSelectedPrompt("");
    setSelectedModelId(models[0]?.id || "nano-banana-v1");
    setSelectedAspectRatio("1:1");
    setSelectedSourceTab("styles");
    setFlowUploadOpen(false);
    setFlowStyleOpen(true);
  };

  useEffect(() => {
    if (appliedSharePresetRef.current) return;
    if (!styles.length || !models.length) return;

    const preview = readSharePreviewFromUrl();
    if (!preview?.orderId) return;
    appliedSharePresetRef.current = true;

    void (async () => {
      try {
        const shared = await getSharedPhoto(preview.orderId!);
        const sharedPhoto: PhotoRecord = {
          orderId: `shared-${shared.orderId}`,
          styleCode: shared.styleCode || "custom",
          modelId: shared.modelId || (models[0]?.id || "nano-banana-v1"),
          status: "done",
          prompt: "",
          resultUrl: shared.resultUrl,
          isFavorite: false,
          createdAt: shared.createdAt,
          updatedAt: shared.updatedAt,
        };
        sharedPreviewOrderRef.current = shared.orderId;
        setSelectedPhoto(sharedPhoto);
        setSelectedPhotoShareLink(window.location.href);
        setFlowStyleOpen(false);
        setFlowUploadOpen(false);
        setStylePreviewOpen(false);
        setCategoryOpen(false);
        setActiveScreen("photos");
        setViewerOpen(true);
      } catch {
        sharedPreviewOrderRef.current = null;
      } finally {
        clearSharePreviewFromUrl();
      }
    })();
  }, [styles, models]);

  const applyStyleSelection = (style: StyleItem) => {
    setSelectedStyle(style);
    setSelectedPrompt(style.promptTemplate);
    setSelectedModelId("nano-banana-v1");
    setSelectedAspectRatio("1:1");
  };

  const handlePickStyleFromHome = (style: StyleItem) => {
    applyStyleSelection(style);
    setSelectedSourceTab("styles");
    setStylePreviewBackToFlow(false);
    setCategoryOpen(false);
    setStylePreviewOpen(true);
  };

  const handlePickStyleFromCreateTab = (style: StyleItem) => {
    applyStyleSelection(style);
    setSelectedSourceTab("styles");
    setStylePreviewBackToFlow(true);
    setFlowStyleOpen(false);
    setStylePreviewOpen(true);
  };

  const handleFlowContinue = (payload: { modelId: string; prompt: string; aspectRatio: string; sourceTab: SourceTab; photoFile?: File | null }) => {
    setSelectedModelId(payload.modelId);
    setSelectedPrompt(payload.prompt);
    setSelectedAspectRatio(payload.aspectRatio);
    setSelectedSourceTab(payload.sourceTab);

    if (payload.sourceTab === "styles") {
      setStylePreviewBackToFlow(true);
      setFlowStyleOpen(false);
      setStylePreviewOpen(true);
      return;
    }

    // Custom: move to photos immediately, upload/generate in background.
    if (!payload.photoFile) return;
    if (!hasEnoughCoinsForModel(payload.modelId)) {
      setPaywallModalOpen(true);
      return;
    }
    if (createActionLocked) return;
    setCreateActionLocked(true);
    transitionToScreen("photos");
    const optimisticId = addOptimisticGeneration({
      styleCode: "custom",
      modelId: payload.modelId,
      prompt: payload.prompt,
    });
    let generationAccepted = false;
    const expectedCost = models.find((m) => m.id === payload.modelId)?.coins ?? null;
    chargeCoinsOptimistically(optimisticId, expectedCost);
    setLastChargedCoins(expectedCost);
    setQueuedModalOpen(true);

    void (async () => {
      let sourceKey: string;
      try {
        sourceKey = await uploadPhoto(userId, payload.photoFile!);
      } catch {
        // upload error is already set in lastError
        removeOptimisticGeneration(optimisticId);
        settleOptimisticCharge(optimisticId, null);
        setQueuedModalOpen(false);
        setCreateActionLocked(false);
        return;
      }

      runGenerateBackground(
        { userId, sourceKey, modelId: payload.modelId, styleCode: "custom",
          prompt: payload.prompt, aspectRatio: payload.aspectRatio },
        async (response) => {
          if (response.result === "paywall_required") {
            settleOptimisticCharge(optimisticId, null);
            setQueuedModalOpen(false);
            setPaywallModalOpen(true);
            return;
          }
          generationAccepted = true;
          replaceOptimisticGeneration(optimisticId, response);
          settleOptimisticCharge(optimisticId, response.order.creditCost);
          setLastChargedCoins(response.order.creditCost);
          refreshProfile();
          await refresh();
        },
        async () => {
          if (!generationAccepted) {
            removeOptimisticGeneration(optimisticId);
            settleOptimisticCharge(optimisticId, null);
          }
          if (!generationAccepted) setQueuedModalOpen(false);
          setCreateActionLocked(false);
          await refresh();
        },
      );
    })();
  };

  const handleGenerate = async (photoFile?: File | null) => {
    if (!selectedModelId || !photoFile) return;
    if (!hasEnoughCoinsForModel(selectedModelId)) {
      setPaywallModalOpen(true);
      return;
    }
    if (createActionLocked) return;
    setCreateActionLocked(true);

    // Switch to photos first and keep generation queued in the background.
    transitionToScreen("photos");
    const optimisticId = addOptimisticGeneration({
      styleCode: selectedStyle?.id || "hollywood",
      modelId: selectedModelId,
      prompt: selectedPrompt,
    });
    let generationAccepted = false;
    chargeCoinsOptimistically(optimisticId, selectedModelCost);
    setLastChargedCoins(selectedModelCost);
    setQueuedModalOpen(true);

    // In style flow aspect ratio should come from the source photo dimensions.
    const sourceAspectRatio = await readImageAspectRatio(photoFile);
    const aspectRatio = sourceAspectRatio || selectedAspectRatio;

    // Step 1: Upload (~1-2s) — button shows "Загрузка..."
    let sourceKey: string;
    try {
      sourceKey = await uploadPhoto(userId, photoFile);
    } catch {
      // upload error already in lastError
      removeOptimisticGeneration(optimisticId);
      settleOptimisticCharge(optimisticId, null);
      setQueuedModalOpen(false);
      setCreateActionLocked(false);
      return;
    }

    // Step 3: Generate in background — UI is free, photos screen shows polling state
    runGenerateBackground(
      {
        userId,
        sourceKey,
        modelId: selectedModelId,
        styleCode: selectedStyle?.id || "hollywood",
        prompt: selectedPrompt,
        aspectRatio,
      },
      async (response) => {
        if (response.result === "paywall_required") {
          settleOptimisticCharge(optimisticId, null);
          setQueuedModalOpen(false);
          setPaywallModalOpen(true);
          return;
        }
        generationAccepted = true;
        replaceOptimisticGeneration(optimisticId, response);
        settleOptimisticCharge(optimisticId, response.order.creditCost);
        setLastChargedCoins(response.order.creditCost);
        refreshProfile();
        await refresh();
      },
      async () => {
        if (!generationAccepted) {
          removeOptimisticGeneration(optimisticId);
          settleOptimisticCharge(optimisticId, null);
        }
        if (!generationAccepted) setQueuedModalOpen(false);
        setCreateActionLocked(false);
        await refresh();
      },
    );
  };


  const handleOpenCategory = (category: string) => {
    setSelectedCategory(category);
    setCategoryOpen(true);
  };

  const handleSelectPackage = (pkg: PackageItem) => {
    setSelectedPackage(pkg);
    setPurchaseOpen(true);
  };

  const handleConfirmPurchase = async (pkg: PackageItem) => {
    const liveTg = window.Telegram?.WebApp;
    try {
      const result = await createPurchaseInvoice(userId, pkg.code);
      // Real TG Stars: open native payment sheet
      if (!liveTg?.openInvoice) return;
      setPurchaseOpen(false);
      liveTg.openInvoice(result.invoiceLink, async (status: string) => {
        if (status === "paid") {
          // Webhook may arrive with a slight delay — poll a few times
          const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
          await wait(800);
          await refresh();
          refreshProfile();
          await wait(1500);
          await refresh();
          refreshProfile();
          await wait(2500);
          await refresh();
          refreshProfile();
        }
      });
    } catch {
      // Do not auto-credit on errors: payment must go through transaction.
    }
  };

  const handleOpenPhoto = (photo: PhotoRecord) => {
    if (photo.status === "done" && photo.resultUrl) {
      setSeenDoneOrderIds((prev) => {
        if (prev.has(photo.orderId)) return prev;
        const next = new Set(prev);
        next.add(photo.orderId);
        return next;
      });
    }
    setSelectedPhoto(photo);
    setViewerOpen(true);
  };

  const handleToggleFavorite = useCallback(async (orderId: string) => {
    // Optimistic update
    setPhotos((prev) =>
      prev.map((p) => (p.orderId === orderId ? { ...p, isFavorite: !p.isFavorite } : p)),
    );
    try {
      await toggleFavorite(orderId);
    } catch {
      // Revert on error
      setPhotos((prev) =>
        prev.map((p) => (p.orderId === orderId ? { ...p, isFavorite: !p.isFavorite } : p)),
      );
    }
  }, [setPhotos]);

  const handleDownloadPhoto = async () => {
    if (!selectedPhoto?.resultUrl) return;
    const url = selectedPhoto.resultUrl;
    const filename = `persona-${selectedPhoto.orderId}.jpg`;

    // Telegram WebApp native download (Bot API 7.10+)
    const liveTg = window.Telegram?.WebApp as { downloadFile?: (opts: { url: string; file_name: string }) => void } | undefined;
    if (liveTg?.downloadFile) {
      liveTg.downloadFile({ url, file_name: filename });
      return;
    }

    // Fetch as blob → object URL → anchor click (works cross-origin in TWA)
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  };

  const handleSendToTelegram = useCallback(async () => {
    if (!selectedPhoto) return;
    try {
      await sendPhotoToTelegram(selectedPhoto.orderId);
      setTelegramModalOpen(true);
    } catch {
      setTelegramModalOpen(true); // show confirmation even if bot send fails (no bot token in dev)
    }
  }, [selectedPhoto]);

  const handleCopyPhotoLink = async () => {
    try {
      const photoLink =
        selectedPhoto?.resultUrl ||
        selectedPhotoShareLink ||
        `${window.location.origin}${window.location.pathname}`;
      await navigator.clipboard.writeText(photoLink);
    } catch {
      // ignore clipboard/network errors
    }
  };

  const handleUseAsReference = () => {
    if (!selectedPhoto) return;
    setViewerOpen(false);
    setFlowInitialTab("custom");
    setFlowInitialCustomPrompt(selectedPhoto.prompt || selectedPrompt || "");
    setFlowInitialCustomModelId(selectedPhoto.modelId);
    setSelectedModelId(selectedPhoto.modelId);
    setSelectedPrompt(selectedPhoto.prompt || selectedPrompt || "");
    setFlowStyleOpen(true);
  };

  const handleDeletePhoto = useCallback(async () => {
    if (!selectedPhoto) return;
    const orderId = selectedPhoto.orderId;
    setViewerOpen(false);
    setSelectedPhoto(null);
    setPhotos((prev) => prev.filter((p) => p.orderId !== orderId));
    try {
      await deletePhoto(orderId);
    } catch {
      await refresh();
    }
  }, [selectedPhoto, refresh, setPhotos, setViewerOpen]);

  const handleUiTapHaptic = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const clickable = target.closest("button, a, [role=\"button\"]") as HTMLElement | null;
    if (!clickable) return;
    if ((clickable as HTMLButtonElement).disabled) return;
    // Medium haptic for primary action buttons (generate / style go)
    const isMedium =
      clickable.classList.contains("flow-btn") ||
      clickable.classList.contains("style-preview-go-center");
    triggerHaptic(isMedium ? "medium" : "light");
  };

  return (
    <main className="app-shell" onClickCapture={handleUiTapHaptic}>
      {activeScreen === "home" ? (
        <HomeScreen
          styles={styles}
          photos={photos}
          generatingOrderIds={uiGeneratingOrderIds}
          onPreviewStyle={handlePickStyleFromHome}
        />
      ) : null}
      {activeScreen === "photos" ? (
        <PhotosScreen
          photos={photos}
          styles={styles}
          generatingOrderIds={uiGeneratingOrderIds}
          onOpenPhoto={handleOpenPhoto}
          favorites={favoriteOrderIds}
        />
      ) : null}
      {activeScreen === "balance" ? (
        <BalanceScreen
          credits={wallet.paidCredits}
          packages={packages}
          onSelectPackage={handleSelectPackage}
          onOpenPricing={() => setModelsOpen(true)}
        />
      ) : null}
      {activeScreen === "profile" ? (
        activeLegalDoc
          ? (
            <LegalDocumentScreen
              title={LEGAL_DOCS[activeLegalDoc].title}
              updatedAt={LEGAL_DOCS[activeLegalDoc].updatedAt}
              sections={LEGAL_DOCS[activeLegalDoc].sections}
              onBack={() => setActiveLegalDoc(null)}
            />
          )
          : (
            <ProfileScreen
              credits={wallet.paidCredits}
              generations={profile?.generationsCount ?? photos.length}
              firstName={profile?.firstName ?? tgUser?.first_name}
              username={profile?.username ?? tgUser?.username}
              avatarUrl={tgUser?.photo_url}
              onOpenPrivacyPolicy={() => setActiveLegalDoc("privacy")}
              onOpenTermsOfService={() => setActiveLegalDoc("terms")}
              onOpenPaymentsPolicy={() => setActiveLegalDoc("payments")}
              onOpenDisclaimer={() => setActiveLegalDoc("disclaimer")}
            />
          )
      ) : null}

      <FlowStyleScreen
        isOpen={flowStyleOpen}
        styles={styles}
        models={models}
        selectedStyle={selectedStyle}
        initialTab={flowInitialTab}
        initialCustomPrompt={flowInitialCustomPrompt}
        initialCustomModelId={flowInitialCustomModelId}
        isCreating={createActionLocked}
        onSelectStyle={handlePickStyleFromCreateTab}
        onContinue={handleFlowContinue}
        onClose={() => setFlowStyleOpen(false)}
      />
      <FlowUploadScreen
        isOpen={flowUploadOpen}
        selectedStyle={selectedStyle}
        prompt={selectedPrompt}
        aspectRatio={selectedAspectRatio}
        cost={selectedModelCost}
        showPromptBlock={selectedSourceTab === "custom"}
        initialPhotoFile={prefilledUploadPhoto}
        isSubmitting={isSubmitting || createActionLocked}
        onBack={() => {
          setFlowUploadOpen(false);
          setFlowStyleOpen(true);
        }}
        onGenerate={(file) => {
          void handleGenerate(file);
        }}
      />

      <PhotoViewerScreen
        isOpen={viewerOpen}
        photo={selectedPhoto}
        appLink={selectedPhotoShareLink || window.location.origin}
        style={selectedPhoto ? stylesById[selectedPhoto.styleCode] : undefined}
        isFavorite={selectedPhoto ? favoriteOrderIds.has(selectedPhoto.orderId) : false}
        onClose={() => setViewerOpen(false)}
        onSendToTelegram={() => { void handleSendToTelegram(); }}
        onToggleFavorite={() => {
          if (selectedPhoto) void handleToggleFavorite(selectedPhoto.orderId);
        }}
        onDownload={handleDownloadPhoto}
        onCopyLink={handleCopyPhotoLink}
        onUseAsReference={handleUseAsReference}
        onDeletePhoto={() => { void handleDeletePhoto(); }}
      />
      <ModelsPricingScreen isOpen={modelsOpen} models={models} packages={packages} onClose={() => setModelsOpen(false)} />
      <StylePreviewScreen
        isOpen={stylePreviewOpen}
        style={selectedStyle}
        onClose={() => {
          setStylePreviewOpen(false);
          if (stylePreviewBackToFlow) setFlowStyleOpen(true);
        }}
        onCreate={() => {
          setStylePreviewOpen(false);
          setCategoryOpen(false);
          setFlowStyleOpen(false);
          setFlowUploadOpen(true);
        }}
      />
      <CategoryScreen
        isOpen={categoryOpen}
        category={selectedCategory}
        styles={styles}
        onClose={() => setCategoryOpen(false)}
        onPreviewStyle={handlePickStyleFromHome}
      />
      <PurchaseScreen
        isOpen={purchaseOpen}
        selectedPackage={selectedPackage}
        onClose={() => setPurchaseOpen(false)}
        onConfirm={(pkg) => {
          void handleConfirmPurchase(pkg);
        }}
      />

      <TabBar
        activeScreen={activeScreen}
        isCreateActive={flowStyleOpen || flowUploadOpen || (stylePreviewOpen && stylePreviewBackToFlow)}
        photosBadge={activeScreen === "photos" ? 0 : newPhotosCount}
        onChange={(screen) => {
          if (screen === "photos") {
            setSeenDoneOrderIds((prev) => {
              const next = new Set(prev);
              doneOrderIds.forEach((id) => next.add(id));
              return next;
            });
          }
          transitionToScreen(screen);
        }}
        onOpenCreate={openCreate}
      />

      <Modal
        isOpen={queuedModalOpen}
        title="Добавлено в очередь!"
        description="Генерация уже началась. Результат появится в разделе «Мои фото»."
        meta={lastChargedCoins ? `Списано: ${lastChargedCoins} 🪙` : undefined}
        onClose={() => setQueuedModalOpen(false)}
      />

      <Modal
        isOpen={paywallModalOpen}
        title="Нужны монеты"
        description="Баланс недостаточен для генерации. Пополнить Starter пакет?"
        actionLabel="Купить Starter"
        onAction={() => {
          const starter = packages.find((pkg) => pkg.code === "STARTER");
          if (starter) handleSelectPackage(starter);
          setPaywallModalOpen(false);
        }}
        onClose={() => setPaywallModalOpen(false)}
      />

      <Modal
        isOpen={telegramModalOpen}
        title="Отправлено!"
        description="Фото отправлено вам в Telegram. Проверьте сообщения от бота."
        onClose={() => setTelegramModalOpen(false)}
      />

      <Modal
        isOpen={Boolean(lastError || asyncFailError)}
        title="Ошибка"
        description={lastError || asyncFailError || undefined}
        onClose={() => {
          clearError();
          setAsyncFailError(null);
        }}
        isError={true}
      />
    </main>
  );
}
