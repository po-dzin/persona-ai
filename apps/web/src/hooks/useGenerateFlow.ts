import { useState } from "react";

import { generate, purchasePackage, uploadPhoto } from "../utils/api";

interface StartGenerateInput {
  userId: string;
  modelId: string;
  styleCode: string;
  prompt: string;
  aspectRatio: string;
}

export function useGenerateFlow() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const clearError = () => setLastError(null);

  const startGenerate = async (input: StartGenerateInput) => {
    setIsSubmitting(true);
    setLastError(null);
    try {
      const uploaded = await uploadPhoto(input.userId, "upload.jpg");
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
