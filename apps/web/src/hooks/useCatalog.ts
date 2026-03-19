import { useEffect, useState } from "react";

import { FALLBACK_MODELS, type AIModel } from "../data/models";
import { FALLBACK_PACKAGES, type PackageItem } from "../data/packages";
import { FALLBACK_STYLES, type StyleItem } from "../data/styles";
import { getModels, getPackages, getStyles } from "../utils/api";

export function useCatalog() {
  const [styles, setStyles] = useState<StyleItem[]>(FALLBACK_STYLES);
  const [models, setModels] = useState<AIModel[]>(FALLBACK_MODELS);
  const [packages, setPackages] = useState<PackageItem[]>(FALLBACK_PACKAGES);

  useEffect(() => {
    let active = true;

    Promise.all([getStyles(), getModels(), getPackages()])
      .then(([remoteStyles, remoteModels, remotePackages]) => {
        if (!active) return;
        if (remoteStyles.length > 0) setStyles(remoteStyles);
        if (remoteModels.length > 0) setModels(remoteModels);
        if (remotePackages.length > 0) setPackages(remotePackages);
      })
      .catch(() => {
        // Fallback data keeps the prototype usable when API is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  return { styles, models, packages };
}
