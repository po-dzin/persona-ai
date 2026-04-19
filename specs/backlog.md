# Product Backlog

## MVP Launch Checklist

- [ ] **Заполнить картинки для стилей** — загрузить preview-изображения для всех стилей каталога перед запуском.

- [ ] **Добавить Stripe** — альтернативный платёжный провайдер помимо Telegram Stars. Нужен для пользователей вне Telegram и для web-surface.

- [ ] **Доработать бота** — аватар, описание (bio), приветственное сообщение при `/start`. Первое впечатление пользователя.

- [ ] **Убрать тестовый тариф** — удалить `TEST` пакет из каталога перед публичным запуском.

- [ ] **Рефанд Stars** — проверить/настроить автоматический возврат Telegram Stars при технических ошибках генерации.

- [ ] **SMM** — запуск продвижения после готовности продукта.

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

## Admin Panel

- [ ] **Worker signals UI** — бэкенд уже возвращает `worker_signals.alerts` (`p95_latency_high`, `tech_failure_rate_high`, `timeout_spike`) в `GET /admin/api/generations`, но фронтенд их игнорирует.
  - Pickup: добавить warning-баннер в `Generations.tsx` когда `alerts` не пустой.
  - Релевантно после настройки Celery в проде под нагрузкой.

- [ ] **Функциональные E2E тесты фронтенда** — сейчас покрыт только мобильный layout-контракт (`mobile-dashboard.spec.ts`). Нет тестов на загрузку данных, фильтры, модалки, обработку ошибок.
  - Приоритет: Lifecycle (admin actions) и Users (search, pagination, user detail modal).
  - Инструмент: Playwright (уже используется).

- [ ] **Спеки для UI админки** — Dashboard, Revenue, Users, Generations реализованы без контрактной спецификации. Актуально перед передачей поддержки или расширением команды.

- [ ] **Авто-рефреш Dashboard** — сейчас данные не обновляются без перезагрузки страницы. Добавить polling ~30с для overview и queue depth.

- [ ] **CSV-экспорт** — Revenue и Users. Phase 1.1+.

## Profile
- [ ] Partner program block: restore behind feature flag once referral backend and UX are production-ready.
  - Current temporary state (2026-04-02): hidden from Profile screen.
  - Scope to restore later: partner collapse header, referral metrics, referral link copy action, progress/tier visuals.
- [ ] Referral counter in profile stats: keep hidden until partner program launch.
  - Current temporary state (2026-04-02): "Рефералов" stat removed from Profile summary.
