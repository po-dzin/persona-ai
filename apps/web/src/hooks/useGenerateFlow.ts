import { useState } from "react";

import {
  generate,
  uploadFileDirect,
  type GeneratePayload,
  type GenerateResult,
} from "../utils/api";

interface GenerateInput {
  userId: string;
  sourceKey: string;
  modelId: string;
  styleCode: string;
  prompt: string;
  aspectRatio: string;
}

/** Parse raw API error into a user-friendly Russian string. */
function parseApiError(error: unknown): string {
  const str = String(error);
  // Try to extract "detail" from JSON body like '{"detail":"provider_error: gemini_no_image_in_response"}'
  try {
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { detail?: string };
      if (parsed.detail) return friendlyDetail(parsed.detail);
    }
  } catch {
    // not JSON — use raw string
  }
  if (str.includes("rate_limit_exceeded")) return "Слишком много запросов. Попробуйте через минуту.";
  if (str.includes("invalid_file")) return "Неподдерживаемый формат файла. Используйте JPG или PNG.";
  return str;
}

function friendlyDetail(detail: string): string {
  if (detail.includes("gemini_no_image_in_response"))
    return "Gemini не смог создать изображение. Убедитесь, что на фото есть человек, и попробуйте снова.";
  if (detail.includes("gemini_no_candidates"))
    return "Запрос отклонён фильтром безопасности. Попробуйте другой стиль или фото.";
  if (detail.includes("rate_limit"))
    return "Слишком много запросов. Попробуйте через минуту.";
  if (detail.includes("provider_error"))
    return "Ошибка провайдера. Попробуйте ещё раз.";
  if (detail.includes("insufficient"))
    return "Недостаточно монет для генерации.";
  if (detail.includes("invalid_file"))
    return "Неподдерживаемый формат файла. Используйте JPG или PNG.";
  return detail;
}

export function useGenerateFlow() {
  const [isUploading, setIsUploading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const clearError = () => setLastError(null);

  /**
   * Step 1: Upload the photo file and return its source_key.
   * Sets isUploading=true while in flight. Throws on failure.
   */
  const uploadPhoto = async (userId: string, photoFile: File): Promise<string> => {
    setIsUploading(true);
    setLastError(null);
    try {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const uploaded = await uploadFileDirect(userId, uniqueName, photoFile);
      return uploaded.source_key;
    } catch (error) {
      setLastError(parseApiError(error));
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Step 2: Fire generation in the background (no await at call site).
   * Calls onSuccess / onError when done.
   */
  const runGenerateBackground = (
    input: GenerateInput,
    onSuccess: (result: GenerateResult) => void,
    onError: (msg: string) => void,
  ): void => {
    const payload: GeneratePayload = {
      user_id: input.userId,
      source_key: input.sourceKey,
      model_id: input.modelId,
      style_code: input.styleCode,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
    };
    void generate(payload)
      .then(onSuccess)
      .catch((err) => {
        const msg = parseApiError(err);
        setLastError(msg);
        onError(msg);
      });
  };

  return {
    /** True only while the upload is in flight (~1-2s). */
    isSubmitting: isUploading,
    lastError,
    clearError,
    uploadPhoto,
    runGenerateBackground,
  };
}
