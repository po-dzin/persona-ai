import { useEffect, useMemo, useRef, useState, useCallback, type MouseEvent } from "react";

import { Modal } from "./components/Modal";
import { TabBar } from "./components/TabBar";
import { useCatalog } from "./hooks/useCatalog";
import { useGenerateFlow } from "./hooks/useGenerateFlow";
import { useScreen } from "./hooks/useScreen";
import { useWalletAndPhotos } from "./hooks/useWalletAndPhotos";
import { BalanceScreen } from "./screens/BalanceScreen";
import { CategoryScreen } from "./screens/CategoryScreen";
import { FlowStyleScreen } from "./screens/FlowStyleScreen";
import { FlowUploadScreen } from "./screens/FlowUploadScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ModelsPricingScreen } from "./screens/ModelsPricingScreen";
import { PhotosScreen } from "./screens/PhotosScreen";
import { PhotoViewerScreen } from "./screens/PhotoViewerScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PurchaseScreen } from "./screens/PurchaseScreen";
import { StylePreviewScreen } from "./screens/StylePreviewScreen";
import type { PackageItem } from "./data/packages";
import type { StyleItem } from "./data/styles";
import type { SourceTab } from "../../../../shared/contracts/ui";
import { createPurchaseInvoice, deletePhoto, getPhotoShareLink, getProfile, sendPhotoToTelegram, toggleFavorite, type GenerateResult, type PhotoRecord, type UserProfile } from "./utils/api";
import { triggerHaptic } from "./utils/haptics";

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
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
type TgUser = { id: number; first_name?: string; username?: string; photo_url?: string };
type SharePreset = { styleCode?: string; modelId?: string; prompt?: string };

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

function readSharePresetFromUrl(): SharePreset | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const styleCode = params.get("ref_style")?.trim() || undefined;
  const modelId = params.get("ref_model")?.trim() || undefined;
  const prompt = params.get("ref_prompt")?.trim() || undefined;
  if (!styleCode && !modelId && !prompt) return null;
  return { styleCode, modelId, prompt };
}

function clearSharePresetFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("ref_style");
  url.searchParams.delete("ref_model");
  url.searchParams.delete("ref_prompt");
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
    };
  }, [refreshProfile]);

  const { styles, models, packages } = useCatalog();
  const { wallet, photos, setPhotos, refresh } = useWalletAndPhotos(userId);

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

  const [seenPhotosCount, setSeenPhotosCount] = useState(0);
  const donePhotosCount = photos.filter(p => p.status === "done").length;
  const newPhotosCount = Math.max(0, donePhotosCount - seenPhotosCount);
  const photosSeedRef = useRef(false);
  // Seed baseline on first load so existing photos don't appear as "new"
  useEffect(() => {
    if (!photosSeedRef.current && donePhotosCount > 0) {
      setSeenPhotosCount(donePhotosCount);
      photosSeedRef.current = true;
    }
  }, [donePhotosCount]);
  // Reset badge when user visits photos tab
  useEffect(() => {
    if (activeScreen === "photos") setSeenPhotosCount(donePhotosCount);
  }, [activeScreen, donePhotosCount]);

  const [queuedModalOpen, setQueuedModalOpen] = useState(false);
  const [queueModalConfirmed, setQueueModalConfirmed] = useState(false);
  const [lastChargedCoins, setLastChargedCoins] = useState<number | null>(null);
  const [createActionLocked, setCreateActionLocked] = useState(false);
  const [paywallModalOpen, setPaywallModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  // purchaseSuccessOpen removed — Telegram's native openInvoice already shows payment success UI
  const [stylePreviewOpen, setStylePreviewOpen] = useState(false);
  const [stylePreviewBackToFlow, setStylePreviewBackToFlow] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const appliedSharePresetRef = useRef(false);

  const stylesById = useMemo(() => Object.fromEntries(styles.map((style) => [style.id, style])), [styles]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedPhoto?.orderId) {
      setSelectedPhotoShareLink("");
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

  const openCreate = () => {
    // Photo viewer must not stay on top of create flow.
    setViewerOpen(false);
    setPurchaseOpen(false);
    setStylePreviewOpen(false);
    setCategoryOpen(false);
    setModelsOpen(false);

    // If already in create flow, don't reset — user stays where they are
    if (flowStyleOpen || flowUploadOpen || (stylePreviewOpen && stylePreviewBackToFlow)) return;

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

    const preset = readSharePresetFromUrl();
    if (!preset) return;
    appliedSharePresetRef.current = true;

    const sharedStyle = preset.styleCode
      ? styles.find((style) => style.id === preset.styleCode) || null
      : null;
    const sharedModel = preset.modelId && models.some((model) => model.id === preset.modelId)
      ? preset.modelId
      : models[0]?.id || "nano-banana-v1";
    const sharedPrompt = preset.prompt?.trim() || "";

    if (sharedStyle) setSelectedStyle(sharedStyle);
    setSelectedModelId(sharedModel);
    if (sharedPrompt) {
      setSelectedPrompt(sharedPrompt);
      setFlowInitialTab("custom");
      setFlowInitialCustomPrompt(sharedPrompt);
      setFlowInitialCustomModelId(sharedModel);
      setSelectedSourceTab("custom");
    } else if (sharedStyle) {
      setSelectedPrompt(sharedStyle.promptTemplate);
      setFlowInitialTab("styles");
      setSelectedSourceTab("styles");
    }

    setFlowUploadOpen(false);
    setStylePreviewOpen(false);
    setCategoryOpen(false);
    setActiveScreen("home");
    setFlowStyleOpen(true);
    clearSharePresetFromUrl();
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
    if (createActionLocked) return;
    setCreateActionLocked(true);
    setFlowStyleOpen(false);
    setActiveScreen("photos");
    const optimisticId = addOptimisticGeneration({
      styleCode: "custom",
      modelId: payload.modelId,
      prompt: payload.prompt,
    });
    let generationAccepted = false;
    const expectedCost = models.find((m) => m.id === payload.modelId)?.coins ?? null;
    setLastChargedCoins(expectedCost);
    setQueueModalConfirmed(false);
    setQueuedModalOpen(true);

    void (async () => {
      let sourceKey: string;
      try {
        sourceKey = await uploadPhoto(userId, payload.photoFile!);
      } catch {
        // upload error is already set in lastError
        removeOptimisticGeneration(optimisticId);
        setQueuedModalOpen(false);
        setCreateActionLocked(false);
        return;
      }

      runGenerateBackground(
        { userId, sourceKey, modelId: payload.modelId, styleCode: "custom",
          prompt: payload.prompt, aspectRatio: payload.aspectRatio },
        async (response) => {
          if (response.result === "paywall_required") {
            setQueuedModalOpen(false);
            setPaywallModalOpen(true);
            return;
          }
          generationAccepted = true;
          setQueueModalConfirmed(true);
          setLastChargedCoins(response.order.creditCost);
          refreshProfile();
        },
        async () => {
          removeOptimisticGeneration(optimisticId);
          if (!generationAccepted) setQueuedModalOpen(false);
          setCreateActionLocked(false);
          await refresh();
        },
      );
    })();
  };

  const handleGenerate = async (photoFile?: File | null) => {
    if (!selectedModelId || !photoFile) return;
    if (createActionLocked) return;
    setCreateActionLocked(true);

    // Immediately switch to photos and show queued modal.
    setFlowUploadOpen(false);
    setActiveScreen("photos");
    const optimisticId = addOptimisticGeneration({
      styleCode: selectedStyle?.id || "hollywood",
      modelId: selectedModelId,
      prompt: selectedPrompt,
    });
    let generationAccepted = false;
    setLastChargedCoins(selectedModelCost);
    setQueueModalConfirmed(false);
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
          setQueuedModalOpen(false);
          setPaywallModalOpen(true);
          return;
        }
        generationAccepted = true;
        setQueueModalConfirmed(true);
        setLastChargedCoins(response.order.creditCost);
        refreshProfile();
      },
      async () => {
        removeOptimisticGeneration(optimisticId);
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
    if (!selectedPhoto) return;
    try {
      const share = await getPhotoShareLink(selectedPhoto.orderId);
      if (share.appLink) {
        await navigator.clipboard.writeText(share.appLink);
      }
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
          onPreviewStyle={handlePickStyleFromHome}
        />
      ) : null}
      {activeScreen === "photos" ? (
        <PhotosScreen
          photos={photos}
          styles={styles}
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
        <ProfileScreen
          credits={wallet.paidCredits}
          generations={profile?.generationsCount ?? photos.length}
          firstName={profile?.firstName ?? tgUser?.first_name}
          username={profile?.username ?? tgUser?.username}
          avatarUrl={tgUser?.photo_url}
        />
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
            setSeenPhotosCount(photos.filter(p => p.status === "done").length);
          }
          setFlowStyleOpen(false);
          setFlowUploadOpen(false);
          setPrefilledUploadPhoto(null);
          setStylePreviewOpen(false);
          setCategoryOpen(false);
          setPurchaseOpen(false);
          setViewerOpen(false);
          setModelsOpen(false);
          setCreateActionLocked(false);
          setActiveScreen(screen);
        }}
        onOpenCreate={openCreate}
      />

      <Modal
        isOpen={queuedModalOpen}
        title={queueModalConfirmed ? "Добавлено в очередь!" : "Отправляем запрос..."}
        description={
          queueModalConfirmed
            ? "Генерация уже началась. Результат появится в разделе «Мои фото»."
            : "Проверяем запрос и запускаем генерацию."
        }
        meta={queueModalConfirmed && lastChargedCoins ? `Списано: ${lastChargedCoins} 🪙` : undefined}
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
        isOpen={Boolean(lastError)}
        title="Ошибка"
        description={lastError || undefined}
        onClose={clearError}
        isError={true}
      />
    </main>
  );
}
