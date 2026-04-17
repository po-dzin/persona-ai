import { useState } from "react";

import {
  generate,
  purchasePackage,
  type GeneratePayload,
  uploadFileDirect,
  type GenerateResult,
} from "../utils/api";

const MAX_GENERATE_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1500;

function isRetryableError(error: unknown): boolean {
  const lower = String(error || "").toLowerCase();
  return (
    lower.includes("provider_error") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("load failed") ||
    lower.includes("network_error") ||
    lower.includes("failed to fetch")
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === MAX_GENERATE_ATTEMPTS) throw err;
      await new Promise<void>((r) => setTimeout(r, RETRY_BASE_DELAY_MS * attempt));
    }
  }
  throw lastError;
}

interface StartGenerateInput {
  userId: string;
  modelId: string;
  styleCode: string;
  prompt: string;
  aspectRatio: string;
  photoFile: File;
}

type GenerateDoneHandler = (result: GenerateResult) => void | Promise<void>;
type GenerateFinallyHandler = () => void | Promise<void>;

export function mapGenerateError(error: unknown): string {
  const raw = String(error || "");
  const lower = raw.toLowerCase();

  if (lower.includes("upload_failed")) {
    return "Не удалось загрузить фото. Проверьте интернет и попробуйте снова.";
  }
  if (lower.includes("policy_blocked") || lower.includes("policy_failed")) {
    return "Контент не прошёл проверку безопасности. Попробуйте другое фото или стиль.";
  }
  if (
    lower.includes("provider_error")
    || lower.includes("timed out")
    || lower.includes("timeout")
    || lower.includes("load failed")
    || lower.includes("network_error")
    || lower.includes("failed to fetch")
  ) {
    return "Сервис генерации временно недоступен. Попробуйте еще раз. Монеты при техническом сбое возвращаются автоматически.";
  }
  if (lower.includes("paywall_required")) {
    return "Недостаточно монет для генерации.";
  }
  return "Не удалось запустить генерацию. Попробуйте еще раз.";
}

export function useGenerateFlow() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const clearError = () => setLastError(null);

  const startGenerate = async (input: StartGenerateInput): Promise<GenerateResult> => {
    setIsSubmitting(true);
    setLastError(null);
    try {
      // Upload directly through API server — avoids browser CORS with R2 presigned URLs
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const uploaded = await uploadFileDirect(input.userId, uniqueName, input.photoFile);
      return await withRetry(() => generate({
        userId: input.userId,
        sourceKey: uploaded.sourceKey,
        modelId: input.modelId,
        styleCode: input.styleCode,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
      }));
    } catch (error) {
      setLastError(mapGenerateError(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const buyPackage = async (userId: string, packageCode: string) => {
    setIsSubmitting(true);
    setLastError(null);
    try {
      return await purchasePackage(userId, packageCode);
    } catch (error) {
      setLastError(mapGenerateError(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadPhoto = async (userId: string, photoFile: File): Promise<string> => {
    setIsSubmitting(true);
    setLastError(null);
    try {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const uploaded = await uploadFileDirect(userId, uniqueName, photoFile);
      return uploaded.sourceKey;
    } catch (error) {
      setLastError(mapGenerateError(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const runGenerateBackground = (
    payload: GeneratePayload,
    onDone?: GenerateDoneHandler,
    onFinally?: GenerateFinallyHandler,
  ) => {
    void (async () => {
      setLastError(null);
      try {
        const response = await withRetry(() => generate(payload));
        if (onDone) await onDone(response);
      } catch (error) {
        setLastError(mapGenerateError(error));
      } finally {
        if (onFinally) await onFinally();
      }
    })();
  };

  return {
    isSubmitting,
    lastError,
    clearError,
    startGenerate,
    buyPackage,
    uploadPhoto,
    runGenerateBackground,
  };
}
