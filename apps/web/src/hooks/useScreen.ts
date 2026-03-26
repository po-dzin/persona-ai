import { useEffect, useState } from "react";

export type BaseScreen = "home" | "photos" | "balance" | "profile";

const LAST_SCREEN_KEY = "persona_last_screen";

function readInitialScreen(): BaseScreen {
  try {
    const raw = localStorage.getItem(LAST_SCREEN_KEY);
    if (raw === "home" || raw === "photos" || raw === "balance" || raw === "profile") {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return "home";
}

export function useScreen() {
  const [activeScreen, setActiveScreen] = useState<BaseScreen>(() => readInitialScreen());
  const [flowStyleOpen, setFlowStyleOpen] = useState(false);
  const [flowUploadOpen, setFlowUploadOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_SCREEN_KEY, activeScreen);
    } catch {
      // ignore storage errors
    }
  }, [activeScreen]);

  return {
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
  };
}
