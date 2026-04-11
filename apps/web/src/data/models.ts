import type { AIModel } from "../../../../shared/contracts/domain";

export const FALLBACK_MODELS: AIModel[] = [
  { id: "nb2-1k", name: "Nano Banana 2 · 1k", provider: "nano_banana", coins: 10, isActive: true, officialOnly: true },
  { id: "nb2-2k", name: "Nano Banana 2 · 2k", provider: "nano_banana", coins: 15, isActive: true, officialOnly: true },
  { id: "nb2-4k", name: "Nano Banana 2 · 4k", provider: "nano_banana", coins: 22, isActive: true, officialOnly: true },
  { id: "nb-pro-2k", name: "Nano Banana Pro · 2k", provider: "nano_banana", coins: 20, isActive: true, officialOnly: true },
  { id: "nb-pro-4k", name: "Nano Banana Pro · 4k", provider: "nano_banana", coins: 35, isActive: true, officialOnly: true },
  { id: "flux2-pro-1k", name: "FLUX.2 Pro · 1k", provider: "flux", coins: 7, isActive: true, officialOnly: true },
  { id: "flux2-pro-2k", name: "FLUX.2 Pro · 2k", provider: "flux", coins: 14, isActive: true, officialOnly: true },
  { id: "flux2-pro-4k", name: "FLUX.2 Pro · 4k", provider: "flux", coins: 27, isActive: true, officialOnly: true },
  { id: "flux2-max-1k", name: "FLUX.2 Max · 1k", provider: "flux", coins: 12, isActive: true, officialOnly: true },
  { id: "flux2-max-2k", name: "FLUX.2 Max · 2k", provider: "flux", coins: 22, isActive: true, officialOnly: true },
  { id: "flux2-max-4k", name: "FLUX.2 Max · 4k", provider: "flux", coins: 42, isActive: true, officialOnly: true },
];

export type { AIModel };
