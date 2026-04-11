# Admin UI Token Contract (v1)

Админка использует тот же дисциплинированный подход к стилям:

1. `primitive` (`--pr-*`)
- Сырые значения (цвета, радиусы, шрифты).

2. `semantic` (`--sem-*`)
- Смысловые токены (фон, текст, бордер, статусы).

3. `component` (`--cmp-*`)
- Токены shell/layout (сайдбар, topbar, радиусы компонентов, шрифт).

## Правила

- В компонентах/страницах использовать только классы и токены.
- Inline `style={{...}}` в UI-слое запрещен.
- Для динамики использовать:
  - token-классы/модификаторы;
  - SVG/DOM-атрибуты, если требуется вычисляемая геометрия;
  - маппинг значений на заранее описанные token-классы.

## Drift Gate

- Скрипт: `apps/admin/scripts/check-token-drift.mjs`
- Baseline: `apps/admin/scripts/token-drift-baseline.json`

Проверка:

```bash
npm --prefix apps/admin run check:token-drift
```

Обновление baseline только осознанно:

```bash
cd apps/admin
node scripts/check-token-drift.mjs --write-baseline
```
