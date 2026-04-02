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

### PARTIAL

- `B3. Database-enforced isolation is not yet fully active in app runtime`
  - The new migration defaults to compatibility mode. Policies enforce user scoping only when the DB session sets:
    - `SET LOCAL app.rls_mode = 'enforce'`
    - `SET LOCAL app.current_user_id = '<users.id uuid>'`
  - This is intentional to avoid breaking current local/dev flows.

- `B4. App auth/session wiring is not yet aligned to the Postgres migration schema`
  - The checked-in Postgres schema in `infra/db/migrations` uses `users.id uuid`.
  - The current FastAPI vertical slice uses a different ORM schema keyed by string `user_id` and still enforces isolation in application code.
  - Because of that mismatch, hard-enforcing Postgres RLS now would be risky without additional runtime wiring.

## Exact follow-up required for full enforcement

1. Align runtime identity to the Postgres schema:
   - resolve authenticated users to `users.id` UUIDs
   - stop assuming the app-layer string `user_id` is the DB ownership key
2. Set DB session context on every request and worker transaction:
   - `SET LOCAL app.rls_mode = 'enforce'`
   - `SET LOCAL app.current_user_id = '<resolved users.id uuid>'`
3. Add Postgres integration coverage that executes real SQL under two different session identities and proves cross-account denial at the database layer.
4. After runtime validation, remove compatibility fallback and consider `FORCE ROW LEVEL SECURITY` plus dedicated app/db roles.
