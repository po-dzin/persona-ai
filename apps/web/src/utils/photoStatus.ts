export function isGeneratingPhotoStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return normalized === "queued" || normalized === "processing" || normalized === "submitted";
}

export function isPhotoGenerating(photo: { status?: string | null; resultUrl?: string | null }): boolean {
  if (isGeneratingPhotoStatus(photo.status)) return true;
  const normalized = String(photo.status || "").toLowerCase();
  // Some providers can transiently mark order as done before result URL is available.
  return normalized === "done" && !photo.resultUrl;
}
