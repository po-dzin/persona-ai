import { useCallback, useState } from "react";

import { UI_SCREENS, type BaseScreen } from "../../../../shared/contracts/ui";
export type { BaseScreen };

const LAST_SCREEN_KEY = "persona_last_screen";
const VALID_SCREENS: BaseScreen[] = Object.values(UI_SCREENS);

function readInitialScreen(): BaseScreen {
  return "home";
}

export function useScreen() {
  const [activeScreen, setActiveScreenState] = useState<BaseScreen>(readInitialScreen);
  const [flowStyleOpen, setFlowStyleOpen] = useState(false);
  const [flowUploadOpen, setFlowUploadOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const setActiveScreen = useCallback((screen: BaseScreen) => {
    setActiveScreenState(screen);
    localStorage.setItem(LAST_SCREEN_KEY, screen);
  }, []);

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
