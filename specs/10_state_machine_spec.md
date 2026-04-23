# 10 · Lifecycle State Machine Spec (L1)

## Purpose

Единый контракт lifecycle state machine для продукта PersonAI.
Source of truth: backend domain (`apps/api`), админка только мониторит и отправляет control-команды.

## Canonical States

- `S0` — новый контакт (бот стартован, miniapp не открыт)
- `S1` — открыл miniapp, еще без успешных генераций
- `S2` — триал (есть успешные генерации, но нет платежей)
- `S3` — платящий активный
- `S4` — платящий спящий (7+ дней без успешной генерации при ненулевом балансе)
- `S5` — low balance
- `S6` — баланс 0
- `INACTIVE_30D` — 30+ дней в `S6`

## Core Definitions

- Успешная генерация: `orders.status='done'` и результат корректно доступен в "Мои фото" (наличие `result_url`).
- Неактивность: отсутствие успешных генераций.
- `low_balance_threshold = max(last_model_cost * 2, 20)`.
- Онбординг-бонус: `20` монет.
- Время во всех вычислениях: UTC.
- Legacy model aliases отключены. Поддерживаются только актуальные model IDs из `shared/contracts/status.py`.

## Priority (single-state invariant)

Один пользователь может находиться только в одном состоянии.
Порядок вычисления (первое совпадение побеждает):

`INACTIVE_30D > S6 > S5 > S4 > S3 > S2 > S1 > S0`

## Conditions

- `INACTIVE_30D`: `balance=0` и `zero_balance_since >= 30d`
- `S6`: `balance=0`
- `S5`: `0 < balance < low_balance_threshold`
- `S4`: есть платежи и `days_since(last_success_generation_at) >= 7`, при `balance > 0`
- `S3`: есть платежи, пользователь не попал в `S4/S5/S6/INACTIVE_30D`
- `S2`: есть успешные генерации, но платежей нет
- `S1`: miniapp открыт, но успешных генераций нет
- `S0`: default/после `/start`, если условия выше не выполнены

## Events That Trigger Recompute

- `bot_started` (`/v1/tg/webhook`, команда `/start`)
- `miniapp_opened` (`/v1/me/profile` при валидном TG init data)
- `generation_succeeded`
- `payment_succeeded`
- `admin_recompute`
- startup one-time backfill / migration recompute

## Backfill Strategy

- Выполняется один глобальный backfill (`run_backfill_once`) с marker в `app_meta`.
- После успешного marker — только инкрементальные recompute по runtime-событиям.
- Повторный полный backfill вручную не запускается автоматически при рестартах.

## Admin Control Plane (no local state logic)

Админка использует только backend API:

- Read:
  - `GET /admin/api/lifecycle/overview`
  - `GET /admin/api/lifecycle/users`
  - `GET /admin/api/lifecycle/users/{user_id}/timeline`
- Control:
  - `POST /admin/api/lifecycle/users/{user_id}/transition`
  - `POST /admin/api/lifecycle/users/{user_id}/lock`
  - `POST /admin/api/lifecycle/users/{user_id}/unlock`
  - `POST /admin/api/lifecycle/users/{user_id}/recompute`

## Audit and Safety

- Любой transition логируется в `lifecycle_transitions`.
- Любое ручное действие админа логируется в `lifecycle_admin_actions`.
- При `lifecycle_locked=true` автоматический recompute не меняет состояние до `unlock`.
