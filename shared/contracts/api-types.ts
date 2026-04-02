import type {
  AIModel,
  Style,
  GenerateRequest,
  GenerateResult,
} from "./domain";

export type GenerationRequest = GenerateRequest;
export type GenerationResult = GenerateResult;

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
