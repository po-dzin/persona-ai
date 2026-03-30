export interface AIModel {
  id: string;
  name: string;
  provider: string;
  coins: number;
  is_active: boolean;
  official_only: boolean;
}

export const FALLBACK_MODELS: AIModel[] = [
  { id: "nano-banana-v1",  name: "Nano Banana",     provider: "nano_banana", coins: 10, is_active: true, official_only: true },
  { id: "nano-banana-v2",  name: "Nano Banana 2",   provider: "nano_banana", coins: 20, is_active: true, official_only: true },
  { id: "nano-banana-pro", name: "Nano Banana Pro", provider: "nano_banana", coins: 50, is_active: true, official_only: true },
];
