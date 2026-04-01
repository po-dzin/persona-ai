import { useState } from "react";

import {
  generate,
  purchasePackage,
  type GeneratePayload,
  uploadFileDirect,
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

type GenerateDoneHandler = (result: GenerateResult) => void | Promise<void>;
type GenerateFinallyHandler = () => void | Promise<void>;

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

  const uploadPhoto = async (userId: string, photoFile: File): Promise<string> => {
    setIsSubmitting(true);
    setLastError(null);
    try {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const uploaded = await uploadFileDirect(userId, uniqueName, photoFile);
      return uploaded.source_key;
    } catch (error) {
      setLastError(String(error));
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
        const response = await generate(payload);
        if (onDone) await onDone(response);
      } catch (error) {
        setLastError(String(error));
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
