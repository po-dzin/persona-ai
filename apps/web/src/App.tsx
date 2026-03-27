import { useEffect, useMemo, useState, useCallback, type MouseEvent } from "react";

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
import { getProfile, sendPhotoToTelegram, toggleFavorite, type GenerateResult, type PhotoRecord, type UserProfile } from "./utils/api";
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
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
type TgUser = { id: number; first_name?: string; username?: string };

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

export function App() {
  // Reactive TG user — initDataUnsafe may be empty before tg.ready() on some versions.
  const [tgUser, setTgUser] = useState<TgUser | null>(
    () => _tgUserSnapshot ?? null,
  );
  const [userId, setUserId] = useState<string>(
    () => (_tgUserSnapshot?.id ? String(_tgUserSnapshot.id) : _getWebUserId()),
  );

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
    // Retry once after 300ms — some TG versions populate initDataUnsafe after ready()
    const tUser = setTimeout(() => {
      const u2 = readTelegramUser();
      if (u2?.id) { setTgUser(u2); setUserId(String(u2.id)); }
    }, 300);

    // Calculate top/bottom insets from TG viewport and safe-area metrics.
    // Re-read window.Telegram?.WebApp dynamically — the module-scope `tg` may have
    // been evaluated before Telegram injected its SDK into window.
    const applyInsets = () => {
      const liveTg = window.Telegram?.WebApp ?? tg;
      const root = document.documentElement;

      const stableH = liveTg?.viewportStableHeight;
      const viewportH = liveTg?.viewportHeight;
      const safeTop = liveTg?.safeAreaInset?.top ?? 0;
      const contentSafeTop = liveTg?.contentSafeAreaInset?.top ?? 0;
      const isFullscreen = (liveTg as any)?.isFullscreen ?? false;

      // safeTop  = device notch/rounded corners (hardware layer)
      // contentSafeTop = TG chrome on top (close button etc.) — must be ADDED, not maxed
      const tgChromeTop = safeTop + contentSafeTop;
      const topInset = liveTg
        ? stableH
          ? Math.max(
              tgChromeTop,
              window.innerHeight - stableH,
              viewportH ? Math.max(0, window.innerHeight - viewportH) : 0,
              isFullscreen ? 60 : 0,
            )
          : Math.max(tgChromeTop, isFullscreen ? 96 : 0)
        : 0;
      root.style.setProperty("--tg-top-inset", `${topInset}px`);

      const safeBottom = Math.max(0, liveTg?.safeAreaInset?.bottom ?? 0);
      const contentSafeBottom = Math.max(0, liveTg?.contentSafeAreaInset?.bottom ?? 0);
      const bottomInset = Math.max(safeBottom, contentSafeBottom);
      root.style.setProperty(
        "--tg-bottom-inset",
        bottomInset > 0 ? String(bottomInset) + "px" : "env(safe-area-inset-bottom, 0px)",
      );
    };

    applyInsets();
    // Re-apply after short delay — TG SDK may report isFullscreen / safeAreaInset lazily
    const t1 = setTimeout(applyInsets, 150);
    const t2 = setTimeout(applyInsets, 600);
    tg?.onEvent?.("viewportChanged", applyInsets);
    tg?.onEvent?.("safeAreaChanged", applyInsets);
    tg?.onEvent?.("contentSafeAreaChanged", applyInsets);
    tg?.onEvent?.("fullscreenChanged", applyInsets);
    return () => { clearTimeout(tUser); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const { styles, models, packages } = useCatalog();
  const { wallet, photos, setPhotos, refresh } = useWalletAndPhotos(userId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const refreshProfile = useCallback(() => {
    getProfile().then(setProfile).catch(() => null);
  }, []);
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile, userId]);
  const { isSubmitting, lastError, clearError, startGenerate, buyPackage } = useGenerateFlow();

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
  const [selectedSourceTab, setSelectedSourceTab] = useState<"styles" | "custom">("styles");
  const [prefilledUploadPhoto, setPrefilledUploadPhoto] = useState<File | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Тренды");
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const favoriteOrderIds = useMemo(
    () => new Set(photos.filter((p) => p.is_favorite).map((p) => p.order_id)),
    [photos],
  );
  const [flowInitialTab, setFlowInitialTab] = useState<"styles" | "custom">("styles");
  const [flowInitialCustomPrompt, setFlowInitialCustomPrompt] = useState("");
  const [flowInitialCustomModelId, setFlowInitialCustomModelId] = useState<string | undefined>(undefined);

  const [queuedModalOpen, setQueuedModalOpen] = useState(false);
  const [lastChargedCoins, setLastChargedCoins] = useState<number | null>(null);
  const [paywallModalOpen, setPaywallModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);
  const [stylePreviewOpen, setStylePreviewOpen] = useState(false);
  const [stylePreviewBackToFlow, setStylePreviewBackToFlow] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const stylesById = useMemo(() => Object.fromEntries(styles.map((style) => [style.id, style])), [styles]);

  const openCreate = () => {
    setFlowInitialTab("styles");
    setPrefilledUploadPhoto(null);
    setFlowInitialCustomPrompt("");
    setFlowInitialCustomModelId(undefined);
    setFlowStyleOpen(true);
    setFlowUploadOpen(false);
  };

  const applyStyleSelection = (style: StyleItem) => {
    setSelectedStyle(style);
    setSelectedPrompt(style.prompt_template);
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

  const handleFlowContinue = (payload: { modelId: string; prompt: string; aspectRatio: string; sourceTab: "styles" | "custom"; photoFile?: File | null }) => {
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

    setPrefilledUploadPhoto(payload.photoFile || null);
    setFlowStyleOpen(false);
    setFlowUploadOpen(true);
  };

  const handleGenerate = async (photoFile?: File | null) => {
    if (!selectedModelId || !photoFile) return;
    const response: GenerateResult = await startGenerate({
      userId,
      modelId: selectedModelId,
      styleCode: selectedStyle?.id || "hollywood",
      prompt: selectedPrompt,
      aspectRatio: selectedAspectRatio,
      photoFile,
    });

    if (response.result === "paywall_required") {
      setPaywallModalOpen(true);
      return;
    }

    setLastChargedCoins(response.order.credit_cost);
    setFlowUploadOpen(false);
    setQueuedModalOpen(true);
    setActiveScreen("photos");
    await refresh();
    refreshProfile();
  };

  const handlePurchase = async (pkg: PackageItem) => {
    await buyPackage(userId, pkg.code);
    await refresh();
    refreshProfile();
    setPurchaseSuccessOpen(true);
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
    await handlePurchase(pkg);
    setPurchaseOpen(false);
  };

  const handleOpenPhoto = (photo: PhotoRecord) => {
    setSelectedPhoto(photo);
    setViewerOpen(true);
  };

  const handleToggleFavorite = useCallback(async (orderId: string) => {
    // Optimistic update
    setPhotos((prev) =>
      prev.map((p) => (p.order_id === orderId ? { ...p, is_favorite: !p.is_favorite } : p)),
    );
    try {
      await toggleFavorite(orderId);
    } catch {
      // Revert on error
      setPhotos((prev) =>
        prev.map((p) => (p.order_id === orderId ? { ...p, is_favorite: !p.is_favorite } : p)),
      );
    }
  }, [setPhotos]);

  const handleDownloadPhoto = () => {
    if (!selectedPhoto?.result_url) return;
    const link = document.createElement("a");
    link.href = selectedPhoto.result_url;
    link.download = `${selectedPhoto.order_id}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleSendToTelegram = useCallback(async () => {
    if (!selectedPhoto) return;
    try {
      await sendPhotoToTelegram(selectedPhoto.order_id);
      setTelegramModalOpen(true);
    } catch {
      setTelegramModalOpen(true); // show confirmation even if bot send fails (no bot token in dev)
    }
  }, [selectedPhoto]);

  const handleSharePhoto = async () => {
    if (!selectedPhoto?.result_url) return;
    const shareData = {
      title: "Persona photo",
      text: "Сгенерировано в Persona",
      url: selectedPhoto.result_url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(selectedPhoto.result_url);
    } catch {
      // User canceled share or clipboard is unavailable.
    }
  };

  const handleUseAsReference = () => {
    if (!selectedPhoto) return;
    setViewerOpen(false);
    setFlowInitialTab("custom");
    setFlowInitialCustomPrompt(selectedPhoto.prompt || selectedPrompt || "");
    setFlowInitialCustomModelId(selectedPhoto.model_id);
    setSelectedModelId(selectedPhoto.model_id);
    setSelectedPrompt(selectedPhoto.prompt || selectedPrompt || "");
    setFlowStyleOpen(true);
  };

  const handleUiTapHaptic = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const clickable = target.closest("button, a, [role=\"button\"]") as HTMLElement | null;
    if (!clickable) return;
    if ((clickable as HTMLButtonElement).disabled) return;
    triggerHaptic("light");
  };

  return (
    <main className="app-shell" onClickCapture={handleUiTapHaptic}>
      {activeScreen === "home" ? (
        <HomeScreen
          styles={styles}
          onPreviewStyle={handlePickStyleFromHome}
          queueItem={photos.find(p => p.status === "queued" || p.status === "processing")
            ? { title: photos.find(p => p.status === "queued" || p.status === "processing")!.style_code, detail: "Генерация" }
            : null}
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
          credits={wallet.paid_credits}
          packages={packages}
          onSelectPackage={handleSelectPackage}
          onOpenPricing={() => setModelsOpen(true)}
        />
      ) : null}
      {activeScreen === "profile" ? (
        <ProfileScreen
          credits={wallet.paid_credits}
          generations={profile?.generations_count ?? photos.length}
          referrals={profile?.referrals_count ?? 0}
          firstName={profile?.first_name ?? tgUser?.first_name}
          username={profile?.username ?? tgUser?.username}
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
        isSubmitting={isSubmitting}
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
        style={selectedPhoto ? stylesById[selectedPhoto.style_code] : undefined}
        isFavorite={selectedPhoto ? favoriteOrderIds.has(selectedPhoto.order_id) : false}
        onClose={() => setViewerOpen(false)}
        onSendToTelegram={() => { void handleSendToTelegram(); }}
        onToggleFavorite={() => {
          if (selectedPhoto) void handleToggleFavorite(selectedPhoto.order_id);
        }}
        onDownload={handleDownloadPhoto}
        onShare={() => {
          void handleSharePhoto();
        }}
        onUseAsReference={handleUseAsReference}
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
        photosBadge={photos.length}
        onChange={(screen) => {
          setFlowStyleOpen(false);
          setFlowUploadOpen(false);
          setPrefilledUploadPhoto(null);
          setStylePreviewOpen(false);
          setCategoryOpen(false);
          setPurchaseOpen(false);
          setViewerOpen(false);
          setModelsOpen(false);
          setActiveScreen(screen);
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
        isOpen={purchaseSuccessOpen}
        title="Баланс пополнен!"
        description={`Текущий баланс: ${wallet.paid_credits} монет 🪙`}
        onClose={() => setPurchaseSuccessOpen(false)}
      />

      <Modal
        isOpen={Boolean(lastError)}
        title="Ошибка"
        description={lastError || undefined}
        onClose={clearError}
      />
    </main>
  );
}
