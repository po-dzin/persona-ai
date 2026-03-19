export interface AIModel {
  id: string;
  name: string;
  provider: string;
  coins: number;
  is_active: boolean;
  official_only: boolean;
}

export const FALLBACK_MODELS: AIModel[] = [
  { id: "nano-banana-v1", name: "Nano Banana", provider: "nano_banana", coins: 10, is_active: true, official_only: true },
  {
    id: "sd-3.5-turbo",
    name: "Stable Diffusion 3.5 Turbo",
    provider: "stable_diffusion",
    coins: 15,
    is_active: true,
    official_only: true,
  },
  { id: "recraft-v4", name: "Recraft V4", provider: "recraft", coins: 25, is_active: true, official_only: true },
  { id: "gpt-image-1.5", name: "OpenAI GPT-image-1.5", provider: "openai_image", coins: 30, is_active: true, official_only: true },
  { id: "flux-kontxt-pro", name: "FLUX.1 Kontext [pro]", provider: "flux", coins: 40, is_active: true, official_only: true },
];
