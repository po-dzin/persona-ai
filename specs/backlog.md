# Product Backlog

## Observability
- [ ] **Sentry error tracking** — подключить когда логов на Render станет много (>1000 MAU).
  - Free tier: 5k errors/month, 10k perf traces/month — достаточно для раннего роста.
  - Setup: `sentry-sdk[fastapi]==2.x` в requirements, `SENTRY_DSN` в env, `sentry_sdk.init()` в `main.py` + Celery `worker_init` signal.
  - Code был реализован 2026-04-14, откатан как преждевременный. Pickup: git history.

## Gallery / My Photos
- [ ] Add search UX for large style catalog in `Мои фото` filters.
  - Context (2026-04-11): style-level chips were replaced with category chips because the style list is too large (~150) and creates horizontal overflow/noise.
  - Goal: support fast lookup by style name (and optionally prompt keywords) without returning to per-style chip rail.
  - Candidate UX: search input above filter chips (sticky), debounced local filtering by style name + prompt, ×-clear button, empty state «Ничего не найдено».
  - Implementation ready (2026-04-13): proof-of-concept done in `PhotosScreen.tsx` + CSS, reverted to backlog by product decision. Pick up from git history or re-implement from scratch.

## Profile
- [ ] Partner program block: restore behind feature flag once referral backend and UX are production-ready.
  - Current temporary state (2026-04-02): hidden from Profile screen.
  - Scope to restore later: partner collapse header, referral metrics, referral link copy action, progress/tier visuals.
- [ ] Referral counter in profile stats: keep hidden until partner program launch.
  - Current temporary state (2026-04-02): "Рефералов" stat removed from Profile summary.
