export function triggerHaptic(kind: "light" | "medium" | "heavy" = "light"): void {
  try {
    const tg = (window as any).Telegram?.WebApp;
    const haptic = tg?.HapticFeedback;
    if (haptic?.impactOccurred) {
      haptic.impactOccurred(kind);
      return;
    }
  } catch {
    // no-op
  }

  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(kind === "heavy" ? 18 : kind === "medium" ? 12 : 8);
    }
  } catch {
    // no-op
  }
}
