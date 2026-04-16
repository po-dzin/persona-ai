/**
 * Chart color tokens — single source of truth.
 * Values mirror --pr-color-* primitives from shared/styles/tokens.css.
 * SVG attributes (stroke=, fill=) can't read CSS vars at runtime, so we
 * keep JS constants in sync with the shared token file manually.
 *
 * Infrastructure colors (grid lines, axis labels) use CSS custom properties
 * via style={{ }} — see Chart.tsx.
 */
export const CHART_COLORS = {
  accent:  "#A78BFA", // --pr-color-accent-400
  success: "#4ADE80", // --pr-color-success-500
  danger:  "#E24B4A", // --pr-color-danger-500
  warning: "#F59E0B", // --pr-color-warning-500
  muted:   "#8A8A8A", // --pr-color-text-muted
  /** @deprecated use style={{ stroke: 'var(--border)' }} on SVG elements */
  border:  "#2A2A2A", // --pr-color-neutral-800 (grid lines fallback)
  /** @deprecated use style={{ fill: 'var(--muted)' }} on SVG elements */
  label:   "#969696", // --pr-color-text-tertiary (bar labels fallback)
} as const;
