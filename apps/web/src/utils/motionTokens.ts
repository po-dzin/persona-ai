const CSS_TIME_RE = /^(-?\d*\.?\d+)\s*(ms|s)$/i;

function parseCssTimeToMs(value: string): number | null {
  const normalized = value.trim();
  const match = CSS_TIME_RE.exec(normalized);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return match[2].toLowerCase() === "s" ? amount * 1000 : amount;
}

export function readMotionTokenMs(tokenName: `--${string}`, fallbackMs: number): number {
  if (typeof window === "undefined" || typeof document === "undefined") return fallbackMs;
  const rawValue = getComputedStyle(document.documentElement).getPropertyValue(tokenName);
  const parsed = parseCssTimeToMs(rawValue);
  return parsed ?? fallbackMs;
}
