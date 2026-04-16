/**
 * Animation token compliance tests.
 *
 * These tests enforce the contract that all motion timings and easing values
 * in index.css are expressed via design-system CSS custom properties rather
 * than bare numeric literals.  They also verify that specific architectural
 * rules (panel transition fix, reduced-motion reset, etc.) are present and
 * correctly reference the expected tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../..");
const indexCss = fs.readFileSync(path.join(webRoot, "src/styles/index.css"), "utf8");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove block comments from a CSS string. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Remove all @keyframes blocks from the CSS string.
 * Keyframe stops (e.g. `scale(0.98)` mid-animation) are exempt from the
 * token requirement — only interactive-state rules must use tokens.
 */
function stripKeyframes(css: string): string {
  return css.replace(/@keyframes\s+\S+\s*\{[^{}]*(?:\{[^}]*\}[^{}]*)*\}/g, "");
}

/** Remove the :root block where tokens are defined. */
function stripRoot(css: string): string {
  return css.replace(/:root\s*\{[^}]+\}/gs, "");
}

// CSS stripped of comment noise, token definitions and keyframe bodies —
// what remains is the actual rule-set declarations we want to audit.
const rulesCss = stripRoot(stripKeyframes(stripComments(indexCss)));

// ---------------------------------------------------------------------------
// No bare time literals in transition / animation declarations
// ---------------------------------------------------------------------------

describe("animation token compliance – no hardcoded durations", () => {
  /**
   * Collect every `transition:` and `animation:` declaration from the
   * rule-set CSS (already stripped of comments, :root, and @keyframes).
   */
  function collectTimingDecls(css: string): string[] {
    const re = /(?:transition|animation)\s*:[^;]+;/g;
    return css.match(re) ?? [];
  }

  /**
   * Returns every bare time value (e.g. `0.15s`, `280ms`) that appears
   * OUTSIDE a var() call in a CSS value string.
   */
  function findBareTimeValues(decl: string): string[] {
    // Remove all var(...) references first, then scan for time literals.
    const withoutVars = decl.replace(/var\([^)]+\)/g, "VAR");
    const matches = withoutVars.match(/\b\d+\.?\d*\s*(?:ms|s)\b/gi) ?? [];
    return matches;
  }

  it("has no hardcoded time values in transition declarations", () => {
    const decls = collectTimingDecls(rulesCss).filter((d) =>
      d.trimStart().startsWith("transition"),
    );
    expect(decls.length, "Expected to find transition declarations").toBeGreaterThan(0);

    const violations: string[] = [];
    for (const decl of decls) {
      const bare = findBareTimeValues(decl);
      if (bare.length) violations.push(`"${bare.join(", ")}" in: ${decl.trim()}`);
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });

  it("has no hardcoded time values in animation declarations", () => {
    const decls = collectTimingDecls(rulesCss).filter((d) =>
      d.trimStart().startsWith("animation"),
    );
    expect(decls.length, "Expected to find animation declarations").toBeGreaterThan(0);

    const violations: string[] = [];
    for (const decl of decls) {
      const bare = findBareTimeValues(decl);
      if (bare.length) violations.push(`"${bare.join(", ")}" in: ${decl.trim()}`);
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Key animation rules reference the correct tokens (contract tests)
// ---------------------------------------------------------------------------

describe("animation token compliance – key rule contracts", () => {
  it("home panel swipe animations use --cmp-motion-swipe", () => {
    expect(indexCss).toMatch(
      /animation: homePanelEnterFromRight var\(--cmp-motion-swipe\)/,
    );
    expect(indexCss).toMatch(
      /animation: homePanelEnterFromLeft var\(--cmp-motion-swipe\)/,
    );
    expect(indexCss).toMatch(
      /animation: homePanelLeaveToLeft var\(--cmp-motion-swipe\)/,
    );
    expect(indexCss).toMatch(
      /animation: homePanelLeaveToRight var\(--cmp-motion-swipe\)/,
    );
  });

  it("home panel base transform transition uses --cmp-motion-swipe", () => {
    expect(indexCss).toMatch(
      /\.home-styles-panel\s*\{[^}]*transition: transform var\(--cmp-motion-swipe\)/s,
    );
  });

  it("home panels container height transition uses --cmp-motion-swipe", () => {
    expect(indexCss).toMatch(
      /\.home-styles-panels\s*\{[^}]*transition: height var\(--cmp-motion-swipe\)/s,
    );
  });

  it("styles grid entrance animation uses --cmp-motion-enter", () => {
    expect(indexCss).toMatch(
      /animation: gridFadeIn var\(--cmp-motion-enter\)/,
    );
  });

  it("overlay screen entrance animation uses --cmp-motion-overlay-enter", () => {
    expect(indexCss).toMatch(
      /animation: overlayScreenEnter var\(--cmp-motion-overlay-enter\)/,
    );
  });

  it("overlay backdrop entrance animation uses --cmp-motion-overlay-enter", () => {
    expect(indexCss).toMatch(
      /animation: overlayBackdropEnter var\(--cmp-motion-overlay-enter\)/,
    );
  });

  it("modal card entrance animation uses --cmp-motion-modal-enter", () => {
    expect(indexCss).toMatch(
      /animation: modalCardEnter var\(--cmp-motion-modal-enter\)/,
    );
  });

  it("popover entrance animation uses --cmp-motion-popover-enter", () => {
    expect(indexCss).toMatch(
      /animation: popoverEnter var\(--cmp-motion-popover-enter\)/,
    );
  });

  it("loading dot pulse animation uses --cmp-motion-loader-pulse and --cmp-ease-pulse", () => {
    expect(indexCss).toMatch(
      /animation: dotPulse var\(--cmp-motion-loader-pulse\) var\(--cmp-ease-pulse\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// Transition suppression during category switching (flicker fix)
// ---------------------------------------------------------------------------

describe("animation token compliance – panel flicker fix", () => {
  it("suppresses transition on non-animating panels during is-transitioning", () => {
    // This rule is the core fix for the adjacent-panel flicker: a panel that
    // was adjacent-next of the old active can become adjacent-prev of the new
    // active.  Without transition:none it would animate across the screen.
    expect(indexCss).toMatch(
      /\.home-styles-panels\.is-transitioning\s+\.home-styles-panel:not\(\.is-active\):not\(\.is-outgoing\)\s*\{[^}]*transition:\s*none/s,
    );
  });

  it("suppresses transition during drag for all panels", () => {
    expect(indexCss).toMatch(
      /\.home-styles-panels\.is-dragging\s+\.home-styles-panel\s*\{[^}]*transition:\s*none/s,
    );
  });
});

// ---------------------------------------------------------------------------
// Reduced-motion accessibility reset
// ---------------------------------------------------------------------------

describe("animation token compliance – reduced-motion", () => {
  it("has a prefers-reduced-motion media query", () => {
    expect(indexCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("overrides animation-duration with --cmp-motion-reduced token", () => {
    expect(indexCss).toMatch(
      /animation-duration:\s*var\(--cmp-motion-reduced\)/,
    );
  });

  it("overrides transition-duration with --cmp-motion-reduced token", () => {
    expect(indexCss).toMatch(
      /transition-duration:\s*var\(--cmp-motion-reduced\)/,
    );
  });

  it("limits animation-iteration-count to 1 to prevent infinite loops", () => {
    expect(indexCss).toMatch(/animation-iteration-count:\s*1/);
  });
});

// ---------------------------------------------------------------------------
// Easing functions — no bare cubic-bezier / ease literals outside @keyframes
// ---------------------------------------------------------------------------

describe("animation token compliance – no hardcoded easing in rule-sets", () => {
  it("uses var(--cmp-ease-*) for all easing values in transitions", () => {
    const transitionDecls = (rulesCss.match(/transition\s*:[^;]+;/g) ?? []);

    const violations: string[] = [];
    for (const decl of transitionDecls) {
      // A bare easing value would be cubic-bezier(...) or ease/ease-in/etc.
      // after removing var() tokens.
      const stripped = decl.replace(/var\([^)]+\)/g, "VAR");
      if (/cubic-bezier|(?<!\w)ease(?!-)|\blinear\b/.test(stripped)) {
        violations.push(decl.trim());
      }
    }
    expect(violations, violations.join("\n")).toHaveLength(0);
  });
});
