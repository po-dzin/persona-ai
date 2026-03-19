export type ProviderId = "nano_banana" | "stable_diffusion" | "flux" | "openai_image" | "recraft";

export interface AIModel {
  id: string;
  name: string;
  provider: ProviderId;
  coins: number;
  isActive: boolean;
  officialOnly: boolean;
}

export interface Style {
  id: string;
  name: string;
  category: string;
  gradient: string;
  promptTemplate: string;
  isTrending?: boolean;
  isNew?: boolean;
}

export interface Category {
  id: string;
  title: string;
}
