export function isGeneratingPhotoStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return normalized === "queued" || normalized === "processing" || normalized === "submitted";
}

