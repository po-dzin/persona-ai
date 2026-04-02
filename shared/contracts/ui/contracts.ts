export const UI_SCREENS = {
  HOME: "home",
  PHOTOS: "photos",
  BALANCE: "balance",
  PROFILE: "profile",
} as const;

export type BaseScreen = (typeof UI_SCREENS)[keyof typeof UI_SCREENS];

export const UI_SOURCE_TABS = {
  STYLES: "styles",
  CUSTOM: "custom",
} as const;

export type SourceTab = (typeof UI_SOURCE_TABS)[keyof typeof UI_SOURCE_TABS];

export const UI_A11Y = {
  MIN_TOUCH_TARGET_PX: 44,
  MIN_CONTRAST_TEXT: 4.5,
} as const;

export const UI_VARIANTS = {
  BUTTON: {
    PRIMARY: "primary",
    SECONDARY: "secondary",
    DISABLED: "disabled",
  },
} as const;
