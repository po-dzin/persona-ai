import type { AIModel, Style } from "./style-types";

export interface GenerationRequest {
  userId: string;
  sourceKey: string;
  styleCode?: string;
  modelId: string;
  prompt?: string;
  aspectRatio?: string;
}

export interface GenerationResult {
  orderId: string;
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  resultUrl?: string | null;
}

export interface ProviderEvent {
  provider: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface StylesResponse {
  styles: Style[];
}

export interface ModelsResponse {
  models: AIModel[];
}
