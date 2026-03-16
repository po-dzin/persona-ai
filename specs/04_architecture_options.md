# 04 · Architecture Options & Recommendation

## Option A — Fastest Launch

- FastAPI + DB + in-process tasks + provider webhook.
- Плюсы: минимальный time-to-market.
- Минусы: слабая устойчивость к рестартам, ограниченный контроль очереди.
- Подходит: быстрый smoke test на очень низкой нагрузке.

## Option B — Balanced (Recommended)

- FastAPI + Postgres + Redis queue + worker + provider webhooks + reconciliation.
- Плюсы: хороший компромисс скорости внедрения и надежности.
- Плюсы: масштабирование через worker replicas.
- Минусы: добавляет операционный слой Redis/worker.
- Подходит: ваш текущий кейс (MVP с реальными платежами и ростом).

## Option C — Reliability-first

- Workflow engine (Temporal/аналог) + event-driven orchestration + multi-provider routing.
- Плюсы: максимальная управляемость сложных процессов.
- Минусы: высокая сложность и стоимость внедрения на старте.
- Подходит: уже подтвержденный объём и команда с platform-фокусом.

## Scorecard (1..5)

| Критерий | Option A | Option B | Option C |
|---|---:|---:|---:|
| Скорость запуска | 5 | 4 | 2 |
| Надежность | 2 | 4 | 5 |
| Масштабируемость | 2 | 4 | 5 |
| Операционная простота | 4 | 3 | 2 |
| Итог для проекта | 2 | 5 | 3 |

## Final recommendation

Берём **Option B (Redis + Celery + Celery Beat)** как базу `v1.0`.

Что это дает прямо сейчас:

- предсказуемая обработка заказов;
- меньше потерь задач;
- готовый путь к горизонтальному росту без переписывания ядра.
