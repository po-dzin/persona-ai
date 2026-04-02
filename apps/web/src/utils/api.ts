import type {
  BalanceResponseDto,
  ModelsResponseDto,
  PackagesResponseDto,
  PhotosResponseDto,
  ProfileResponseDto,
  StylesResponseDto,
  GenerateResultDto,
  ToggleFavoriteResponseDto,
  UploadPhotoResponseDto,
} from "../../../../shared/contracts/dto";
import type {
  GenerateRequest,
  GenerateResult,
  PhotoRecord,
  UserProfile,
  Wallet,
} from "../../../../shared/contracts/domain";

import { mapAIModelDto, mapGenerateRequestToDto, mapGenerateResultDto, mapPackageItemDto, mapPhotoRecordDto, mapStyleDto, mapToggleFavoriteDto, mapUploadPhotoResponseDto, mapUserProfileDto, mapWalletDto } from "./mappers";

const API_BASE = "/v1";

function getTgInitData(): string {
  return (window as any).Telegram?.WebApp?.initData ?? "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getTgInitData(),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getStyles() {
  const data = await request<StylesResponseDto>("/styles");
  return data.styles.map(mapStyleDto);
}

export async function getModels() {
  const data = await request<ModelsResponseDto>("/models");
  return data.models.map(mapAIModelDto);
}

export async function getPackages() {
  const data = await request<PackagesResponseDto>("/packages");
  return data.packages.map(mapPackageItemDto);
}

export async function getBalance(userId: string): Promise<Wallet> {
  const data = await request<BalanceResponseDto>(`/me/balance?user_id=${encodeURIComponent(userId)}`);
  return mapWalletDto(data.wallet);
}

export async function getPhotos(userId: string): Promise<PhotoRecord[]> {
  const data = await request<PhotosResponseDto>(`/me/photos?user_id=${encodeURIComponent(userId)}`);
  return data.photos.map(mapPhotoRecordDto);
}

export async function uploadPhoto(userId: string, filename: string) {
  const dto = await request<UploadPhotoResponseDto>("/uploads", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, filename }),
  });
  return mapUploadPhotoResponseDto(dto);
}

export async function uploadFileToSignedUrl(url: string, file: File): Promise<void> {
  if (!url || url.includes("r2.example")) return;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`upload_failed:${res.status}`);
  }
}

export async function uploadFileDirect(userId: string, filename: string, file: File): Promise<{ sourceKey: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const form = new FormData();
    form.append("filename", filename);
    form.append("file", file, filename);
    try {
      const res = await fetch(`${API_BASE}/uploads/file`, {
        method: "POST",
        headers: { "X-Telegram-Init-Data": getTgInitData() },
        body: form,
      });
      if (!res.ok) throw new Error(`upload_failed:${res.status}`);
      const dto = (await res.json()) as { source_key: string };
      return { sourceKey: dto.source_key };
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("upload_failed:network");
}

export async function generate(payload: GenerateRequest): Promise<GenerateResult> {
  const dto = await request<GenerateResultDto>("/generate", {
    method: "POST",
    body: JSON.stringify(mapGenerateRequestToDto(payload)),
  });
  return mapGenerateResultDto(dto);
}

export async function purchasePackage(userId: string, packageCode: string) {
  return await request<Record<string, unknown>>("/purchase", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, package_code: packageCode, provider: "telegram" }),
  });
}

export async function createPurchaseInvoice(userId: string, packageCode: string): Promise<{ invoiceLink: string }> {
  const data = await request<{ invoice_link: string }>("/purchase/invoice", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, package_code: packageCode, provider: "telegram" }),
  });
  return { invoiceLink: data.invoice_link };
}

export async function getProfile(): Promise<UserProfile> {
  const data = await request<ProfileResponseDto>("/me/profile");
  return mapUserProfileDto(data.profile);
}

export async function toggleFavorite(orderId: string) {
  const dto = await request<ToggleFavoriteResponseDto>(
    `/me/photos/${encodeURIComponent(orderId)}/favorite`,
    { method: "POST" },
  );
  return mapToggleFavoriteDto(dto);
}

export async function sendPhotoToTelegram(orderId: string): Promise<void> {
  await request<{ ok: boolean }>(`/me/photos/${encodeURIComponent(orderId)}/send`, {
    method: "POST",
  });
}

export async function getPhotoShareLink(orderId: string): Promise<{ appLink: string; resultUrl?: string | null }> {
  const data = await request<{ app_link: string; result_url?: string | null }>(
    `/me/photos/${encodeURIComponent(orderId)}/share-link`,
  );
  return { appLink: data.app_link, resultUrl: data.result_url };
}

export async function deletePhoto(orderId: string): Promise<void> {
  await request<{ deleted: boolean }>(`/me/photos/${encodeURIComponent(orderId)}`, {
    method: "DELETE",
  });
}

export type {
  GenerateRequest,
  GenerateResult,
  PhotoRecord,
  UserProfile,
  Wallet,
};

export type GeneratePayload = GenerateRequest;
