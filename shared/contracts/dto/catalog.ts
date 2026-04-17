export type ProviderIdDto = "nano_banana" | "flux" | "openai_image" | "recraft";

export interface AIModelDto {
  id: string;
  name: string;
  provider: ProviderIdDto;
  coins: number;
  is_active: boolean;
  official_only: boolean;
}

export interface StylePromptSpecDto {
  subject: string;
  style_core: string;
  context: string;
  camera: string;
  light_color_texture: string;
  emotion: string;
  output_intent: string;
  negative: string;
}

export interface StyleDto {
  id: string;
  name: string;
  category: string;
  gradient: string;
  prompt_template: string;
  prompt_spec?: StylePromptSpecDto;
  stylization_level?: 1 | 2 | 3 | 4 | 5;
  style_anchors?: string[];
  variation_axes?: string[];
  is_trending?: boolean;
  is_new?: boolean;
}

export interface PackageItemDto {
  code: string;
  title: string;
  credits: number;
  bonus_coins: number;
  bonus_percent: number;
  price_stars: number;
  provider: string;
}

export interface WalletDto {
  paid_credits: number;
}

export interface PhotoRecordDto {
  order_id: string;
  style_code: string;
  model_id: string;
  status: "queued" | "processing" | "done" | "failed";
  prompt?: string;
  result_url?: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfileDto {
  user_id: string;
  first_name: string | null;
  username: string | null;
  paid_credits: number;
  generations_count: number;
  referrals_count: number;
  is_admin: boolean;
}

export interface GeneratePayloadDto {
  user_id: string;
  source_key: string;
  model_id: string;
  style_code: string;
  prompt?: string;
  aspect_ratio?: string;
  enhance_prompt?: boolean;
}

export interface GenerateOrderDto {
  order_id: string;
  status: string;
  result_url?: string | null;
  credit_cost: number;
  [key: string]: unknown;
}

export interface GenerateResultDto {
  result: "enqueued" | "paywall_required" | "policy_blocked";
  order: GenerateOrderDto;
  wallet?: WalletDto;
}

export interface UploadPhotoResponseDto {
  source_key: string;
  signed_put_url?: string;
}

export interface ToggleFavoriteResponseDto {
  order_id: string;
  is_favorite: boolean;
}

export interface StylesResponseDto {
  styles: StyleDto[];
}

export interface ModelsResponseDto {
  models: AIModelDto[];
}

export interface PackagesResponseDto {
  packages: PackageItemDto[];
}

export interface PhotosResponseDto {
  photos: PhotoRecordDto[];
}

export interface ProfileResponseDto {
  profile: UserProfileDto;
}

export interface BalanceResponseDto {
  wallet: WalletDto;
}
