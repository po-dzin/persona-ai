import { useEffect, useMemo, useState } from "react";

import { Modal } from "./components/Modal";
import { TabBar } from "./components/TabBar";
import { useCatalog } from "./hooks/useCatalog";
import { useGenerateFlow } from "./hooks/useGenerateFlow";
import { useScreen } from "./hooks/useScreen";
import { useWalletAndPhotos } from "./hooks/useWalletAndPhotos";
import { BalanceScreen } from "./screens/BalanceScreen";
import { FlowStyleScreen } from "./screens/FlowStyleScreen";
import { FlowUploadScreen } from "./screens/FlowUploadScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ModelsPricingScreen } from "./screens/ModelsPricingScreen";
import { PhotosScreen } from "./screens/PhotosScreen";
import { PhotoViewerScreen } from "./screens/PhotoViewerScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import type { StyleItem } from "./data/styles";
import type { PhotoRecord } from "./utils/api";

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
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
const tgUser = tg?.initDataUnsafe?.user;
const USER_ID = tgUser?.id ? String(tgUser.id) : "demo-user";

export function App() {
  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  const { styles, models, packages } = useCatalog();
  const { wallet, photos, refresh } = useWalletAndPhotos(USER_ID);
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

  const [queuedModalOpen, setQueuedModalOpen] = useState(false);
  const [paywallModalOpen, setPaywallModalOpen] = useState(false);

  const stylesById = useMemo(() => Object.fromEntries(styles.map((style) => [style.id, style])), [styles]);
  const selectedModel = useMemo(() => models.find((model) => model.id === selectedModelId) || null, [models, selectedModelId]);

  const openCreate = () => {
    setFlowStyleOpen(true);
    setFlowUploadOpen(false);
  };

  const handlePickStyle = (style: StyleItem) => {
    setSelectedStyle(style);
    setSelectedPrompt(style.prompt_template);
    setSelectedModelId("nano-banana-v1");
    openCreate();
  };

  const handleFlowContinue = (payload: { modelId: string; prompt: string; aspectRatio: string }) => {
    setSelectedModelId(payload.modelId);
    setSelectedPrompt(payload.prompt);
    setSelectedAspectRatio(payload.aspectRatio);
    setFlowStyleOpen(false);
    setFlowUploadOpen(true);
  };

  const handleGenerate = async () => {
    if (!selectedModelId) return;
    const response = (await startGenerate({
      userId: USER_ID,
      modelId: selectedModelId,
      styleCode: selectedStyle?.id || "hollywood",
      prompt: selectedPrompt,
      aspectRatio: selectedAspectRatio,
    })) as { result?: string };

    if (response.result === "paywall_required") {
      setPaywallModalOpen(true);
      return;
    }

    setFlowUploadOpen(false);
    setQueuedModalOpen(true);
    setActiveScreen("photos");
    await refresh();
  };

  const handlePurchase = async (packageCode: string) => {
    await buyPackage(USER_ID, packageCode);
    await refresh();
  };

  const handleOpenPhoto = (photo: PhotoRecord) => {
    setSelectedPhoto(photo);
    setViewerOpen(true);
  };

  return (
    <main className="app-shell">
      {activeScreen === "home" ? <HomeScreen styles={styles} onPickStyle={handlePickStyle} /> : null}
      {activeScreen === "photos" ? <PhotosScreen photos={photos} styles={styles} onOpenPhoto={handleOpenPhoto} /> : null}
      {activeScreen === "balance" ? (
        <BalanceScreen
          credits={wallet.paid_credits}
          packages={packages}
          onPurchase={handlePurchase}
          onOpenModelsPricing={() => setModelsOpen(true)}
        />
      ) : null}
      {activeScreen === "profile" ? <ProfileScreen credits={wallet.paid_credits} generations={photos.length} /> : null}

      <FlowStyleScreen
        isOpen={flowStyleOpen}
        styles={styles}
        models={models}
        selectedStyle={selectedStyle}
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
        onGenerate={() => {
          void handleGenerate();
        }}
      />

      <PhotoViewerScreen
        isOpen={viewerOpen}
        photo={selectedPhoto}
        style={selectedPhoto ? stylesById[selectedPhoto.style_code] : undefined}
        onClose={() => setViewerOpen(false)}
      />
      <ModelsPricingScreen isOpen={modelsOpen} models={models} onClose={() => setModelsOpen(false)} />

      <TabBar
        activeScreen={activeScreen}
        photosBadge={photos.length}
        onChange={setActiveScreen}
        onOpenCreate={openCreate}
      />

      <Modal
        isOpen={queuedModalOpen}
        title="Готово"
        description="Генерация уже началась. Результат появится в разделе «Мои фото»."
        onClose={() => setQueuedModalOpen(false)}
      />

      <Modal
        isOpen={paywallModalOpen}
        title="Нужны монеты"
        description="Баланс недостаточен для генерации. Пополнить Starter пакет?"
        actionLabel="Купить Starter"
        onAction={() => {
          void handlePurchase("STARTER");
          setPaywallModalOpen(false);
        }}
        onClose={() => setPaywallModalOpen(false)}
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
