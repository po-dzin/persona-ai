import type { AIModel } from "../data/models";
import type { PackageItem } from "../data/packages";
import type { StyleItem } from "../data/styles";

const API_BASE = "/v1";

export interface Wallet {
  free_credit_available: boolean;
  paid_credits: number;
}

export interface PhotoRecord {
  order_id: string;
  style_code: string;
  model_id: string;
  status: "queued" | "processing" | "done" | "failed";
  result_url?: string | null;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
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

export async function uploadPhoto(userId: string, filename: string): Promise<{ source_key: string }> {
  return await request<{ source_key: string }>("/uploads", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, filename }),
  });
}

export async function generate(payload: GeneratePayload) {
  return await request<Record<string, unknown>>("/generate", {
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
