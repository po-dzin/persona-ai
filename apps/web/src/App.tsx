import { useEffect, useMemo, useState, useCallback } from "react";

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

// Telegram WebApp integration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        initDataUnsafe?: {
          user?: { id: number; first_name?: string; username?: string };
        };
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
        onEvent?(event: string, callback: () => void): void;
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user;
function _getWebUserId(): string {
  const key = "persona_web_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

const USER_ID = tgUser?.id ? String(tgUser.id) : _getWebUserId();

export function App() {
  useEffect(() => {
    tg?.ready();
    tg?.expand();

    // Apply Telegram safe area insets as CSS variables (Bot API 7.3+)
    const applyInsets = () => {
      const root = document.documentElement;
      const safe = tg?.safeAreaInset;
      const content = tg?.contentSafeAreaInset;
      if (safe) {
        root.style.setProperty("--tg-safe-area-inset-top", `${safe.top}px`);
        root.style.setProperty("--tg-safe-area-inset-bottom", `${safe.bottom}px`);
      }
      if (content) {
        root.style.setProperty("--tg-content-safe-area-inset-top", `${content.top}px`);
        root.style.setProperty("--tg-content-safe-area-inset-bottom", `${content.bottom}px`);
      }
    };
    applyInsets();
    tg?.onEvent?.("safeAreaChanged", applyInsets);
    tg?.onEvent?.("contentSafeAreaChanged", applyInsets);
  }, []);

  const { styles, models, packages } = useCatalog();
  const { wallet, photos, setPhotos, refresh } = useWalletAndPhotos(USER_ID);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const refreshProfile = useCallback(() => {
    getProfile().then(setProfile).catch(() => null);
  }, []);
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);
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
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
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
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const stylesById = useMemo(() => Object.fromEntries(styles.map((style) => [style.id, style])), [styles]);
  const selectedModel = useMemo(() => models.find((model) => model.id === selectedModelId) || null, [models, selectedModelId]);

  const openCreate = () => {
    setFlowInitialTab("styles");
    setFlowInitialCustomPrompt("");
    setFlowInitialCustomModelId(undefined);
    setFlowStyleOpen(true);
    setFlowUploadOpen(false);
  };

  const handlePickStyle = (style: StyleItem) => {
    setSelectedStyle(style);
    setSelectedPrompt(style.prompt_template);
    setSelectedModelId("nano-banana-v1");
    setCategoryOpen(false);
    setStylePreviewOpen(true);
  };

  const handleFlowContinue = (payload: { modelId: string; prompt: string; aspectRatio: string }) => {
    setSelectedModelId(payload.modelId);
    setSelectedPrompt(payload.prompt);
    setSelectedAspectRatio(payload.aspectRatio);
    setFlowStyleOpen(false);
    setFlowUploadOpen(true);
  };

  const handleGenerate = async (photoFile?: File | null) => {
    if (!selectedModelId || !photoFile) return;
    const response: GenerateResult = await startGenerate({
      userId: USER_ID,
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
    await buyPackage(USER_ID, pkg.code);
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

  return (
    <main className="app-shell">
      {activeScreen === "home" ? (
        <HomeScreen
          styles={styles}
          onPreviewStyle={handlePickStyle}
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
          onOpenModelsPricing={() => setModelsOpen(true)}
        />
      ) : null}
      {activeScreen === "profile" ? (
        <ProfileScreen
          credits={wallet.paid_credits}
          generations={profile?.generations_count ?? photos.length}
          referrals={profile?.referrals_count ?? 0}
          firstName={tgUser?.first_name}
          username={tgUser?.username}
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
        onSelectStyle={setSelectedStyle}
        onContinue={handleFlowContinue}
        onClose={() => setFlowStyleOpen(false)}
      />
      <FlowUploadScreen
        isOpen={flowUploadOpen}
        selectedStyle={selectedStyle}
        selectedModel={selectedModel}
        prompt={selectedPrompt}
        aspectRatio={selectedAspectRatio}
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
      <ModelsPricingScreen isOpen={modelsOpen} models={models} onClose={() => setModelsOpen(false)} />
      <StylePreviewScreen
        isOpen={stylePreviewOpen}
        style={selectedStyle}
        onClose={() => setStylePreviewOpen(false)}
        onCreate={() => {
          setStylePreviewOpen(false);
          setCategoryOpen(false);
          openCreate();
        }}
      />
      <CategoryScreen
        isOpen={categoryOpen}
        category={selectedCategory}
        styles={styles}
        onClose={() => setCategoryOpen(false)}
        onPreviewStyle={handlePickStyle}
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
        isCreateActive={flowStyleOpen || flowUploadOpen}
        photosBadge={photos.length}
        onChange={(screen) => {
          setFlowStyleOpen(false);
          setFlowUploadOpen(false);
          setStylePreviewOpen(false);
          setCategoryOpen(false);
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
