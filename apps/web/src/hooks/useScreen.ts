import { useState } from "react";

export type BaseScreen = "home" | "photos" | "balance" | "profile";

export function useScreen() {
  const [activeScreen, setActiveScreen] = useState<BaseScreen>("home");
  const [flowStyleOpen, setFlowStyleOpen] = useState(false);
  const [flowUploadOpen, setFlowUploadOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);

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
