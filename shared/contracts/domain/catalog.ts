export type ProviderId = "nano_banana" | "stable_diffusion" | "flux" | "openai_image" | "recraft";

export interface StylePromptSpec {
  subject: string;
  styleCore: string;
  context: string;
  camera: string;
  lightColorTexture: string;
  emotion: string;
  outputIntent: string;
  negative: string;
}

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
  promptSpec?: StylePromptSpec;
  stylizationLevel?: 1 | 2 | 3 | 4 | 5;
  styleAnchors?: string[];
  variationAxes?: string[];
  isTrending?: boolean;
  isNew?: boolean;
}

export interface PackageItem {
  code: string;
  title: string;
  credits: number;
  bonusCoins: number;
  bonusPercent: number;
  priceStars: number;
  provider: string;
}

export interface Wallet {
  paidCredits: number;
}

export interface PhotoRecord {
  orderId: string;
  styleCode: string;
  modelId: string;
  status: "queued" | "processing" | "done" | "failed";
  prompt?: string;
  resultUrl?: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  firstName: string | null;
  username: string | null;
  paidCredits: number;
  generationsCount: number;
  referralsCount: number;
  isAdmin: boolean;
}

export interface GenerateRequest {
  userId: string;
  sourceKey: string;
  modelId: string;
  styleCode: string;
  prompt?: string;
  aspectRatio?: string;
  enhancePrompt?: boolean;
}

export interface GenerateOrder {
  orderId: string;
  status: string;
  resultUrl?: string | null;
  creditCost: number;
  [key: string]: unknown;
}

export interface GenerateResult {
  result: "enqueued" | "paywall_required";
  order: GenerateOrder;
  wallet?: Wallet;
}

export interface UploadPhotoResponse {
  sourceKey: string;
  signedPutUrl?: string;
}

export interface ToggleFavoriteResponse {
  orderId: string;
  isFavorite: boolean;
}
