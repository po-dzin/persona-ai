export const EVENT_NAMES = {
  GENERATION_QUEUED: "generation:queued",
  GENERATION_UPDATED: "generation:updated",
  BALANCE_UPDATED: "balance:updated",
  PHOTO_OPENED: "photo:opened",
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];
