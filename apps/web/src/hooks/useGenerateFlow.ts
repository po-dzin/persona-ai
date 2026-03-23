import { useState } from "react";

import {
  generate,
  purchasePackage,
  uploadFileToSignedUrl,
  uploadPhoto,
  type GenerateResult,
} from "../utils/api";

interface StartGenerateInput {
  userId: string;
  modelId: string;
  styleCode: string;
  prompt: string;
  aspectRatio: string;
  photoFile: File;
}

export function useGenerateFlow() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const clearError = () => setLastError(null);

  const startGenerate = async (input: StartGenerateInput): Promise<GenerateResult> => {
    setIsSubmitting(true);
    setLastError(null);
    try {
      // Unique filename prevents concurrent uploads from overwriting each other
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const uploaded = await uploadPhoto(input.userId, uniqueName);
      if (uploaded.signed_put_url) {
        await uploadFileToSignedUrl(uploaded.signed_put_url, input.photoFile);
      }
      return await generate({
        user_id: input.userId,
        source_key: uploaded.source_key,
        model_id: input.modelId,
        style_code: input.styleCode,
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
      });
    } catch (error) {
      setLastError(String(error));
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
      setLastError(String(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    lastError,
    clearError,
    startGenerate,
    buyPackage,
  };
}
