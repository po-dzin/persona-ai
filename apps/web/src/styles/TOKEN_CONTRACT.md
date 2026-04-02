# UI Token Contract (Token System v1)

This project uses a strict 3-layer token architecture:

1. `primitive` (`--pr-*`)
- Raw values only: color literals, opacity, spacing steps, radius steps, font sizes, line-heights.

2. `semantic` (`--sem-*`)
- Meaning-driven tokens: surface/text/accent/border/status/overlay.
- No component should use raw literals directly.

3. `component` (`--cmp-*`)
- UI contracts for layout rhythm and interaction: page/grid edges, radii, type roles, motion, z-index, touch/focus, breakpoints.

## Rules

- Use only `--sem-*` or `--cmp-*` in component/screen styles.
- Keep literals (`#hex`, `rgba`, etc.) in `tokens.css` only.
- Keep transition/animation durations and easing tokenized via `--cmp-motion-*` and `--cmp-ease-*`.
- Prefer CSS classes over inline `style={...}`.
- Inline styles are allowed only for approved dynamic data cases (runtime gradients, runtime ratio geometry, measured panel height) and are enforced by drift-check allowlist.

## Drift Gate

`apps/web/scripts/check-token-drift.mjs` enforces:

- new color literals in UI layer;
- new hardcoded spacing/typography declarations;
- new raw motion durations/easing in non-token CSS;
- forbidden inline style objects (non-dynamic).

## Pre-merge Contract

- Local strict gate: `npm run check:premerge`
- CI strict gate: `.github/workflows/ci.yml` job `validate-web-ui` runs the same contract.
- Any new exception (inline style, literal, hardcoded spacing/type) must be either:
1. removed via tokenization; or
2. intentionally allowlisted via baseline update.

Baseline updates must be intentional:

```bash
cd apps/web
node scripts/check-token-drift.mjs --write-baseline
```
