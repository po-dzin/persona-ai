import type { AIModel } from "../data/models";
import type { PackageItem } from "../data/packages";
import type { StyleItem } from "../data/styles";

const API_BASE = "/v1";

function getTgInitData(): string {
  return (window as any).Telegram?.WebApp?.initData ?? "";
}

export interface Wallet {
  free_credit_available: boolean;
  paid_credits: number;
}

export interface PhotoRecord {
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

export interface GeneratePayload {
  user_id: string;
  source_key: string;
  model_id: string;
  style_code: string;
  prompt?: string;
  aspect_ratio?: string;
}

export interface GenerateResult {
  result: "enqueued" | "paywall_required";
  order: {
    order_id: string;
    status: string;
    result_url?: string | null;
    credit_cost: number;
    [key: string]: unknown;
  };
  wallet?: Wallet;
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

export async function getStyles(): Promise<StyleItem[]> {
  const data = await request<{ styles: StyleItem[] }>("/styles");
  return data.styles;
}

export async function getModels(): Promise<AIModel[]> {
  const data = await request<{ models: AIModel[] }>("/models");
  return data.models;
}

export async function getPackages(): Promise<PackageItem[]> {
  const data = await request<{ packages: PackageItem[] }>("/packages");
  return data.packages;
}

export async function getBalance(userId: string): Promise<Wallet> {
  const data = await request<{ wallet: Wallet }>(`/me/balance?user_id=${encodeURIComponent(userId)}`);
  return data.wallet;
}

export async function getPhotos(userId: string): Promise<PhotoRecord[]> {
  const data = await request<{ photos: PhotoRecord[] }>(`/me/photos?user_id=${encodeURIComponent(userId)}`);
  return data.photos;
}

export interface UploadPhotoResponse {
  source_key: string;
  signed_put_url?: string;
}

export async function uploadPhoto(userId: string, filename: string): Promise<UploadPhotoResponse> {
  return await request<UploadPhotoResponse>("/uploads", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, filename }),
  });
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

export async function generate(payload: GeneratePayload): Promise<GenerateResult> {
  return await request<GenerateResult>("/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function purchasePackage(userId: string, packageCode: string) {
  return await request<Record<string, unknown>>("/purchase", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, package_code: packageCode, provider: "telegram" }),
  });
}

export interface UserProfile {
  user_id: string;
  paid_credits: number;
  free_credit_available: boolean;
  generations_count: number;
  referrals_count: number;
}

export async function getProfile(): Promise<UserProfile> {
  const data = await request<{ profile: UserProfile }>("/me/profile");
  return data.profile;
}

export async function toggleFavorite(orderId: string): Promise<{ is_favorite: boolean }> {
  return await request<{ order_id: string; is_favorite: boolean }>(
    `/me/photos/${encodeURIComponent(orderId)}/favorite`,
    { method: "POST" },
  );
}

export async function sendPhotoToTelegram(orderId: string): Promise<void> {
  await request<{ ok: boolean }>(`/me/photos/${encodeURIComponent(orderId)}/send`, {
    method: "POST",
  });
}
