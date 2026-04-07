import type {
  AIModelDto,
  GeneratePayloadDto,
  GenerateResultDto,
  PackageItemDto,
  PhotoRecordDto,
  StyleDto,
  ToggleFavoriteResponseDto,
  UploadPhotoResponseDto,
  UserProfileDto,
  WalletDto,
} from "../../../../shared/contracts/dto";
import type {
  AIModel,
  GenerateRequest,
  GenerateResult,
  PackageItem,
  PhotoRecord,
  Style,
  ToggleFavoriteResponse,
  UploadPhotoResponse,
  UserProfile,
  Wallet,
} from "../../../../shared/contracts/domain";

export function mapStyleDto(dto: StyleDto): Style {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    gradient: dto.gradient,
    promptTemplate: dto.prompt_template,
    isTrending: dto.is_trending,
    isNew: dto.is_new,
  };
}

export function mapAIModelDto(dto: AIModelDto): AIModel {
  return {
    id: dto.id,
    name: dto.name,
    provider: dto.provider,
    coins: dto.coins,
    isActive: dto.is_active,
    officialOnly: dto.official_only,
  };
}

export function mapPackageItemDto(dto: PackageItemDto): PackageItem {
  return {
    code: dto.code,
    title: dto.title,
    credits: dto.credits,
    priceStars: dto.price_stars,
    bonusPercent: dto.bonus_percent,
    provider: dto.provider,
  };
}

export function mapWalletDto(dto: WalletDto): Wallet {
  return {
    paidCredits: dto.paid_credits,
  };
}

export function mapPhotoRecordDto(dto: PhotoRecordDto): PhotoRecord {
  return {
    orderId: dto.order_id,
    styleCode: dto.style_code,
    modelId: dto.model_id,
    status: dto.status,
    prompt: dto.prompt,
    resultUrl: dto.result_url,
    isFavorite: dto.is_favorite,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function mapUserProfileDto(dto: UserProfileDto): UserProfile {
  return {
    userId: dto.user_id,
    firstName: dto.first_name,
    username: dto.username,
    paidCredits: dto.paid_credits,
    generationsCount: dto.generations_count,
    referralsCount: dto.referrals_count,
    isAdmin: dto.is_admin ?? false,
  };
}

export function mapGenerateRequestToDto(input: GenerateRequest): GeneratePayloadDto {
  return {
    user_id: input.userId,
    source_key: input.sourceKey,
    model_id: input.modelId,
    style_code: input.styleCode,
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
  };
}

export function mapGenerateResultDto(dto: GenerateResultDto): GenerateResult {
  const { order_id, result_url, credit_cost, ...restOrder } = dto.order;
  return {
    result: dto.result,
    order: {
      ...restOrder,
      orderId: order_id,
      resultUrl: result_url,
      creditCost: credit_cost,
    },
    wallet: dto.wallet ? mapWalletDto(dto.wallet) : undefined,
  };
}

export function mapUploadPhotoResponseDto(dto: UploadPhotoResponseDto): UploadPhotoResponse {
  return {
    sourceKey: dto.source_key,
    signedPutUrl: dto.signed_put_url,
  };
}

export function mapToggleFavoriteDto(dto: ToggleFavoriteResponseDto): ToggleFavoriteResponse {
  return {
    orderId: dto.order_id,
    isFavorite: dto.is_favorite,
  };
}
