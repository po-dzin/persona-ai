export const SCREEN_NAMES = {
  HOME: "home",
  PHOTOS: "photos",
  BALANCE: "balance",
  PROFILE: "profile",
  FLOW_STYLE: "flow-style",
  FLOW_UPLOAD: "flow-upload",
  VIEWER: "viewer",
  MODELS_PRICING: "models-pricing",
} as const;

export type ScreenName = (typeof SCREEN_NAMES)[keyof typeof SCREEN_NAMES];
