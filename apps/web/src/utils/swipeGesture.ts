export const SWIPE_ACTIVATION_PX = 10;
export const SWIPE_FLICK_MIN_DISTANCE_PX = 24;
export const SWIPE_FLICK_MIN_VELOCITY_PX_PER_MS = 0.35;

export function shouldActivateHorizontalSwipe(params: {
  absDx: number;
  absDy: number;
  activationPx?: number;
  verticalToleranceRatio?: number;
}): boolean {
  const activationPx = params.activationPx ?? SWIPE_ACTIVATION_PX;
  const verticalToleranceRatio = params.verticalToleranceRatio ?? 0.8;
  if (params.absDx < activationPx) return false;
  return params.absDy <= params.absDx * verticalToleranceRatio;
}

export function shouldCommitHorizontalSwipe(params: {
  dx: number;
  dy: number;
  durationMs: number;
  commitDistancePx: number;
  dominantHorizontalRatio: number;
  flickDistancePx?: number;
  flickVelocityPxPerMs?: number;
}): boolean {
  const absDx = Math.abs(params.dx);
  const absDy = Math.abs(params.dy);
  const durationMs = Math.max(1, params.durationMs);
  const velocityX = absDx / durationMs;
  const flickDistancePx = params.flickDistancePx ?? SWIPE_FLICK_MIN_DISTANCE_PX;
  const flickVelocityPxPerMs = params.flickVelocityPxPerMs ?? SWIPE_FLICK_MIN_VELOCITY_PX_PER_MS;
  const isDominantHorizontal = absDy <= absDx * params.dominantHorizontalRatio;
  const passesDistance = absDx >= params.commitDistancePx;
  const passesFlick = absDx >= flickDistancePx && velocityX >= flickVelocityPxPerMs;
  return isDominantHorizontal && (passesDistance || passesFlick);
}

export function getHorizontalSwipeKeyframeOffsets(params: {
  ratio: number;
  direction: "next" | "prev";
}): { enterFrom: string; leaveFrom: string } {
  const enterFrom = params.direction === "next"
    ? `${((1 + params.ratio) * 100).toFixed(2)}%`
    : `${((-1 + params.ratio) * 100).toFixed(2)}%`;
  const leaveFrom = `${(params.ratio * 100).toFixed(2)}%`;
  return { enterFrom, leaveFrom };
}
