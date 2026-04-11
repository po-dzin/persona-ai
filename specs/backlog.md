# Product Backlog

## Gallery / My Photos
- [ ] Add search UX for large style catalog in `Мои фото` filters.
  - Context (2026-04-11): style-level chips were replaced with category chips because the style list is too large (~150) and creates horizontal overflow/noise.
  - Goal: support fast lookup by style name (and optionally prompt keywords) without returning to per-style chip rail.
  - Candidate UX: search input in filter row, debounced local filtering, clear action, empty-state hint.

## Profile
- [ ] Partner program block: restore behind feature flag once referral backend and UX are production-ready.
  - Current temporary state (2026-04-02): hidden from Profile screen.
  - Scope to restore later: partner collapse header, referral metrics, referral link copy action, progress/tier visuals.
- [ ] Referral counter in profile stats: keep hidden until partner program launch.
  - Current temporary state (2026-04-02): "Рефералов" stat removed from Profile summary.
