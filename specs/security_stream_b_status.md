# Security Stream B Status

## Scope

- Repo: `PersonAI`
- Stream: `RLS readiness and second-account verification evidence`

## Checklist mapping

### DONE

- `B1. Baseline Postgres RLS objects are in place`
  - Added [0003_rls_baseline.sql](/Users/G/Documents/Projects/PersonAI/infra/db/migrations/0003_rls_baseline.sql).
  - Enables RLS on user-owned tables.
  - Adds idempotent baseline policies for `users`, `wallets`, `payments`, `orders`, `generation_jobs`, `media_assets`, `wallet_transactions`, `referrals`, and `gift_packages`.
  - Adds session helpers:
    - `app.rls_mode`
    - `app.current_user_id`
    - `public.app_rls_is_enforced()`
    - `public.app_current_user_uuid()`

- `B2. Automated second-account isolation evidence exists`
  - Added explicit end-to-end API evidence in [test_generation_flow.py](/Users/G/Documents/Projects/PersonAI/tests/api/test_generation_flow.py).
  - Coverage now explicitly proves a second account cannot:
    - see another account's order via `GET /v1/orders/{order_id}`
    - favorite another account's photo
    - delete another account's photo
    - observe another account's order in `GET /v1/me/history`
    - observe another account's photo in `GET /v1/me/photos`

### DONE (updated 2026-04-20)

- `B3. RLS auto-propagation via ContextVar`
  - Added `_rls_uuid_var: ContextVar[UUID | None]` and `activate_rls()` to `db.py`.
  - `get_session()` now reads the ContextVar and applies `set_config` automatically on every new transaction — no manual call needed per session.
  - `set_rls_context()` also calls `activate_rls()` so existing explicit calls propagate UUID to future sessions.
  - `get_or_create_user()` calls `activate_rls(user.id)` — covers `get_balance`, `get_profile`, `purchase`, and all paths that start with user resolution.

- `B4. Postgres DB-layer isolation evidence`
  - Added `tests/api/test_rls_db.py` with 5 Postgres-only tests (auto-skipped on SQLite).
  - Covers: `users` self-only read, `orders` cross-account read denied, own-read allowed, compat mode passthrough, ContextVar propagation end-to-end.

- `B5. Strict RLS mode + FORCE ROW LEVEL SECURITY + app roles` (2026-04-21)
  - Migration `0007_rls_strict_mode.sql`:
    - `app_rls_mode()` default changed `'compat'` → `'system'` (no compat fallback)
    - Policy helper functions rewritten: `system` → allow all; `enforce`+UUID → own rows; else → DENY
    - `FORCE ROW LEVEL SECURITY` on all user tables (applies to table owner on Render)
    - `app_api` and `app_worker` NOLOGIN roles created with appropriate GRANTs
  - `get_system_session()` added to `db.py` — explicitly sets `app.rls_mode = 'system'`
  - Workers (`runner.py`) migrated from bare `SessionLocal()` to `get_system_session()`
  - Admin router and app startup migrated to `get_system_session()`
  - `test_rls_db.py` updated: 7 Postgres-only tests covering enforce/system/default/ContextVar propagation

## Remaining post-MVP hardening

1. Create LOGIN variants of `app_api` / `app_worker` roles on Render and update `DATABASE_URL` / `WORKER_DATABASE_URL` to use them (removes reliance on superuser connection).
2. Change default mode from `'system'` → `'deny'` after all system paths are confirmed to use `get_system_session()` — this gives maximum strictness at DB level.
