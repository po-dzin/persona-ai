import type { AIModel } from "../../../../shared/contracts/domain";

export const FALLBACK_MODELS: AIModel[] = [
  { id: "nano-banana-v1", name: "Nano Banana", provider: "nano_banana", coins: 10, isActive: true, officialOnly: true },
  { id: "nano-banana-v2", name: "Nano Banana 2", provider: "nano_banana", coins: 20, isActive: true, officialOnly: true },
  { id: "nano-banana-pro", name: "Nano Banana Pro", provider: "nano_banana", coins: 50, isActive: true, officialOnly: true },
];

export type { AIModel };
