# AGENTS.md

## Purpose

Mandatory playbook for any agent before making changes in this repository.

## Read Before Any Edit (Required)

1. [`/Users/G/Documents/Projects/PersonAI/specs/README.md`](/Users/G/Documents/Projects/PersonAI/specs/README.md)  
   Source of truth for specs and priority rules.
2. [`/Users/G/Documents/Projects/PersonAI/apps/web/src/styles/TOKEN_CONTRACT.md`](/Users/G/Documents/Projects/PersonAI/apps/web/src/styles/TOKEN_CONTRACT.md)  
   Token/drift policy and forbidden style patterns.
3. [`/Users/G/Documents/Projects/PersonAI/README.md`](/Users/G/Documents/Projects/PersonAI/README.md)  
   Project structure and baseline checks.

For ownership boundaries in parallel work:

4. [`/Users/G/Documents/Projects/PersonAI/specs/09_multi_agent_spec.md`](/Users/G/Documents/Projects/PersonAI/specs/09_multi_agent_spec.md)

## UI/UX Canon (Required on Every UI Change)

- Preserve visual canon: spacing, hierarchy, motion behavior, and component proportions.
- Do not introduce inline styles for layout/visual values that violate token contract.
- In photo UI:
  - no accidental crop regressions;
  - no edge-spacing regressions;
  - no transient flicker between screens/tabs.
- If UX behavior is changed, keep interaction intent consistent with current product flow.

## Pre-Commit Checklist

For web/UI changes:

1. `npm --prefix apps/web run check:token-drift`
2. `npm --prefix apps/web run check:premerge`

For full repo gate:

3. `make ci-gate`

Do not push if required checks fail.

## Implementation Rules

- Keep changes minimal and scoped to the request.
- Avoid unrelated refactors in the same commit.
- Update/add tests for behavior changes.
- Prefer additive changes to shared contracts.

