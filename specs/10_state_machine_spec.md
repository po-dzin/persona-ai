# 10 · Lifecycle State Machine Spec (L2)

## Purpose

Единый контракт lifecycle state machine для продукта PersonAI.
Source of truth: backend domain (`apps/api`), админка только мониторит и отправляет control-команды.

## Canonical States

- `S0` — новый контакт (бот стартован, miniapp не открыт)
- `S1` — открыл miniapp, но еще не пополнил баланс
- `S2` — платящий активный
- `S3` — платящий спящий (3+ дня без успешной генерации)
- `S4` — low balance для платящих
- `S5` — баланс 0 (максимальный приоритет)

## Core Definitions

- Успешная генерация: `orders.status='done'` и результат корректно доступен в "Мои фото" (наличие `result_url`).
- Неактивность: отсутствие успешных генераций.
- Онбординг-бонус: `20` монет.
- Время во всех вычислениях: UTC.
- Dynamic low balance threshold: `ceil(max_topup_credits * 0.1)`, где `max_topup_credits` — максимальное разовое пополнение пользователя в монетах (base + bonus).

## Priority (single-state invariant)

Один пользователь может находиться только в одном состоянии.
Порядок вычисления (первое совпадение побеждает):

`S5 > S4 > S3 > S2 > S1 > S0`

## Conditions

- `S5`: `balance = 0`
- `S4`: пользователь платящий, `0 < balance <= low_balance_threshold`
- `S3`: пользователь платящий, `days_since(last_success_generation_at) >= 3`, при `balance > low_balance_threshold`
- `S2`: пользователь платящий, не попал в `S3/S4/S5`
- `S1`: miniapp открыт, но успешного платежа нет
- `S0`: default/после `/start`, если условия выше не выполнены

## Events That Trigger Recompute

- `bot_started` (`/v1/tg/webhook`, команда `/start`)
- `miniapp_opened` (`/v1/me/profile` при валидном TG init data)
- `generation_succeeded`
- `payment_succeeded`
- `admin_recompute`
- startup one-time backfill / migration recompute

## Bot Broadcast Copy (Canonical Templates)

### S0 · Новый контакт

- "Привет! Я превращаю обычные фото в 🔥 AI-портреты. Я уже начислил тебе 20 монет 🎁 — открывай приложение и попробуй!"
- "Тебя ждут стили как с обложки журнала 📸 Нажми кнопку и создай первое фото за минуту."

### S1 · Открыл, но не пополнил

- "Готово к старту 😏 Пополни баланс и запусти первую генерацию — результат будет через минуту."
- "Выбери стиль, пополни баланс и получи свое первое AI-фото уже сейчас ✨"

### S2 · Платящий активный (daily rotation)

- "Новый стиль уже в приложении ✨ [название стиля] — попробуй первым!"
- "Сейчас в тренде [название стиля] 🔥 Сделай свой кадр в этом образе."
- "Тебе может зайти [похожий стиль] 🎨 Зайди и создай новую генерацию."

### S3 · Платящий спящий

- "Давно не виделись 👀 Заходи, тебя ждут новые стили и свежие образы."
- "Твои монеты на месте — время сделать новую генерацию ⚡ Выбери стиль и продолжай."

### S4 · Low balance

- "Монет почти не осталось ⚡ Пополни баланс, чтобы не прерывать генерации."
- "Осталось мало монет — пополни сейчас и продолжай делать фото в любимых стилях."

### S5 · Баланс пуст

- "Монеты на нуле 🚨 Пополни баланс и вернись к созданию AI-фото."
- "Баланс = 0. Пополни сейчас, чтобы снова запускать генерации без ограничений."

## Delivery Mechanics (without worker)

- Runtime отправляет сообщения синхронно в API на event-триггерах (`miniapp_opened`, `generation_succeeded`, `payment_succeeded`).
- Для time-based триггеров (24h в `S1`, daily rotation/reminder) используется endpoint:
  - `POST /admin/api/lifecycle/dispatch-due`
- Этот endpoint должен вызываться внешним cron/monitoring-job по расписанию (например, раз в час).
- Anti-spam: не больше 1 сообщения в сутки для одного и того же состояния.
- Dispatch работает батчами с keyset-cursor (`app_meta`), чтобы не сканировать всю таблицу пользователей на каждом тике.
- Каждый запуск ограничен по размеру батча (`limit`) и time-budget (`max_seconds`) для защиты API от пиков.

## Backfill Strategy

- Выполняется один глобальный backfill (`run_backfill_once`) с marker в `app_meta`.
- После успешного marker — только инкрементальные recompute по runtime-событиям.
- При переходе на L2 используется отдельный marker для одноразового migration recompute.

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
