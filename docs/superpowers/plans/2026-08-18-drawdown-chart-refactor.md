# График понижения: рефакторинг взаимодействия — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Починить масштаб, панорамирование, касания и свободную прямую на графике понижения, вывести кривую восстановления и разобрать 1591-строчный `DrawdownChart.js` на проверяемые части.

**Architecture:** Всё вычислимое без React переезжает в `calc/` чистыми функциями и покрывается jest. Видимая область становится одним значением с ограничением положения и хранилищем по ключу системы координат. Жесты собираются один раз и читают изменяемые входы из ref. Три несовместимых представления серий (`measurements` + `group`, `extraSeries`, восстановление) сводятся к одной модели.

**Tech Stack:** React Native 0.79.6, React 19, Expo SDK 53, `react-native-svg` 15.11, `react-native-gesture-handler` 2.24, `react-native-reanimated` 3.17, jest + `jest-expo`, `react-test-renderer` (транзитивно).

## Global Constraints

- **Никаких новых зависимостей.** Всё, что нужно, уже в `package.json`.
- **Базовые единицы внутри `calc/` — минуты и метры.** Перевод в выбранные пользователем размерности стоит только на границе экрана (`UnitsContext`: `toBase` / `fromBase`).
- **Комментарии по-русски и о том, ПОЧЕМУ так, а не что делает код.** Это принятый в проекте стиль: см. шапки `calc/chartGeometry.js` и `components/DrawdownChart.js`.
- **Тесты запускаются `npx jest`** из `ANSDIMAT_REPO`. Прогон всего набора — `npx jest`.
- **Функции, вызываемые из жестов, помечаются `'worklet'`** первой строкой тела. Без этого reanimated бросит их на JS-поток, и жест начнёт ждать ре-рендер.
- **Публичный интерфейс `components/DrawdownChart.js` сохраняется** до задачи 8 включительно: экран продолжает импортировать `DrawdownChart` и `FIT_MODES` оттуда же.
- **Коммит после каждой задачи**, сообщение по-русски, в стиле уже существующих: `feat(chart): ...`, `refactor(chart): ...`, `fix(chart): ...`.
- **Пределы масштаба:** `MIN_ZOOM = 0.5`, `MAX_ZOOM = 50` — не менять, они уже проверены тестами.

---

## Структура файлов

| Файл | Ответственность | Задача |
|---|---|---|
| `calc/chartViewport.js` | создать: подгонка, ограничение, зум и сдвиг области как чистые значения | 1 |
| `calc/__tests__/chartViewport.test.js` | создать: тесты области | 1 |
| `calc/chartGeometry.js` | изменить: добавить зажим свободной точки, выбор ближайшей, признак вырожденной прямой | 2 |
| `calc/__tests__/chartGeometry.test.js` | изменить: тесты нового | 2 |
| `calc/chartSeries.js` | создать: единая модель серий и точки восстановления | 3 |
| `calc/__tests__/chartSeries.test.js` | создать | 3 |
| `calc/chartScene.js` | создать: данные + область → сцена; подписи делений | 4 |
| `calc/__tests__/chartScene.test.js` | создать | 4 |
| `components/chart/ChartCanvas.js` | создать: отрисовка готовой сцены | 5 |
| `components/chart/ChartToolbar.js` | создать: шапка, кнопки масштаба, чипы | 6 |
| `components/chart/useChartViewport.js` | создать: область + жесты | 7 |
| `components/chart/DrawdownChart.js` | создать: композиция | 8 |
| `components/DrawdownChart.js` | заменить содержимое реэкспортом | 8 |
| `components/__tests__/DrawdownChart.test.js` | создать: тесты отрисовки | 8 |
| `screens/PumpingTestProcessing/useChartSeries.js` | создать: сборка серий для экрана | 9 |
| `screens/PumpingTestProcessing/__tests__/useChartSeries.test.js` | создать | 9 |
| `screens/PumpingTestProcessing/DataProcessingScreen.js` | изменить: хранилище областей, чип выбора кривой, подсказки | 10 |

---

## Task 1: Видимая область как значение

**Files:**
- Create: `calc/chartViewport.js`
- Create: `calc/__tests__/chartViewport.test.js`

**Interfaces:**
- Consumes: `zoomView`, `panView` из `calc/chartGeometry.js` (существуют, не меняются).
- Produces:
  - `OVERSCAN: number` (0.4)
  - `fitViewport(seriesList, { padX?, padY? }) → {x0,x1,y0,y1}` — `seriesList` это `Array<{points: Array<{x,y}>}>`
  - `clampViewport(view, { base, overscan? }) → {x0,x1,y0,y1}` (worklet)
  - `zoomViewport({ view, scale?, scaleX?, scaleY?, focusX, focusY, base, minZoom, maxZoom, overscan? }) → view` (worklet)
  - `panViewport({ view, dx, dy, plot, base, overscan? }) → view` (worklet)

- [ ] **Step 1: Написать падающие тесты**

Создать `calc/__tests__/chartViewport.test.js`:

```js
/**
 * Проверка видимой области графика
 *
 * Главное свойство здесь одно: как бы геолог ни тянул и ни щипал полотно,
 * данные обязаны остаться в поле зрения. Ровно этого сейчас нет — сдвиг
 * ничем не ограничен, и ряд замеров уводится за край насовсем.
 */

import {
  fitViewport,
  clampViewport,
  zoomViewport,
  panViewport,
  OVERSCAN,
} from '../chartViewport';

const PLOT = { x: 46, y: 14, w: 280, h: 178 };
const BASE = { x0: 0, x1: 4, y0: 0, y1: 25 };

/** Пересечение двух отрезков по длине */
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

describe('fitViewport', () => {
  test('охватывает все серии сразу, а не только первую', () => {
    const view = fitViewport([
      { points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] },
      { points: [{ x: 5, y: 9 }] },
    ]);
    expect(view.x0).toBeLessThanOrEqual(0);
    expect(view.x1).toBeGreaterThanOrEqual(5);
    expect(view.y1).toBeGreaterThanOrEqual(9);
  });

  test('понижение отсчитывается от нуля', () => {
    const view = fitViewport([{ points: [{ x: 0, y: 4 }, { x: 1, y: 9 }] }]);
    expect(view.y0).toBe(0);
  });

  test('пустой список даёт невырожденную область', () => {
    const view = fitViewport([]);
    expect(view.x1 - view.x0).toBeGreaterThan(0);
    expect(view.y1 - view.y0).toBeGreaterThan(0);
  });

  test('одна точка не даёт нулевого размаха', () => {
    const view = fitViewport([{ points: [{ x: 2, y: 3 }] }]);
    expect(view.x1 - view.x0).toBeGreaterThan(0);
    expect(view.y1 - view.y0).toBeGreaterThan(0);
  });

  test('непригодные точки отбрасываются', () => {
    const view = fitViewport([
      { points: [{ x: 0, y: 1 }, { x: NaN, y: 2 }, { x: 1, y: Infinity }] },
    ]);
    expect(isFinite(view.x0)).toBe(true);
    expect(isFinite(view.x1)).toBe(true);
    expect(isFinite(view.y1)).toBe(true);
  });
});

describe('clampViewport', () => {
  test('окно, уведённое далеко вправо, возвращается к данным', () => {
    const lost = { x0: 1000, x1: 1004, y0: 0, y1: 25 };
    const fixed = clampViewport(lost, { base: BASE });
    expect(overlap(fixed.x0, fixed.x1, BASE.x0, BASE.x1)).toBeGreaterThan(0);
  });

  test('окно, уведённое далеко вниз, возвращается к данным', () => {
    const lost = { x0: 0, x1: 4, y0: -900, y1: -875 };
    const fixed = clampViewport(lost, { base: BASE });
    expect(overlap(fixed.y0, fixed.y1, BASE.y0, BASE.y1)).toBeGreaterThan(0);
  });

  test('размах окна при возврате не меняется — масштаб сохраняется', () => {
    const lost = { x0: 1000, x1: 1004, y0: 0, y1: 25 };
    const fixed = clampViewport(lost, { base: BASE });
    expect(fixed.x1 - fixed.x0).toBeCloseTo(4, 10);
    expect(fixed.y1 - fixed.y0).toBeCloseTo(25, 10);
  });

  test('окно внутри данных не трогается', () => {
    const inside = { x0: 1, x1: 3, y0: 5, y1: 20 };
    expect(clampViewport(inside, { base: BASE })).toEqual(inside);
  });

  test('при сильном приближении окно всё равно не отрывается от данных', () => {
    // Размах в пятьдесят раз меньше базового: мера, взятая от базового
    // размаха, здесь разрешила бы уехать туда, где данных нет вовсе
    const tight = { x0: 900, x1: 900.08, y0: 900, y1: 900.5 };
    const fixed = clampViewport(tight, { base: BASE });
    const need = Math.min(0.1 * 0.08, BASE.x1 - BASE.x0);
    expect(overlap(fixed.x0, fixed.x1, BASE.x0, BASE.x1)).toBeGreaterThanOrEqual(need - 1e-9);
  });

  test('вырожденное окно заменяется базовым', () => {
    expect(clampViewport({ x0: 2, x1: 2, y0: 0, y1: 25 }, { base: BASE })).toEqual(BASE);
    expect(clampViewport({ x0: NaN, x1: 4, y0: 0, y1: 25 }, { base: BASE })).toEqual(BASE);
  });
});

describe('panViewport', () => {
  test('обычный сдвиг работает как прежде', () => {
    const moved = panViewport({
      view: BASE, dx: -PLOT.w / 2, dy: 0, plot: PLOT, base: BASE,
    });
    expect(moved.x0).toBeCloseTo(2, 8);
    expect(moved.x1).toBeCloseTo(6, 8);
  });

  test('никакая череда сдвигов не теряет данные', () => {
    let view = BASE;
    for (let i = 0; i < 200; i += 1) {
      view = panViewport({ view, dx: -PLOT.w, dy: PLOT.h, plot: PLOT, base: BASE });
    }
    expect(overlap(view.x0, view.x1, BASE.x0, BASE.x1)).toBeGreaterThan(0);
    expect(overlap(view.y0, view.y1, BASE.y0, BASE.y1)).toBeGreaterThan(0);
  });
});

describe('zoomViewport', () => {
  test('приближение сужает окно', () => {
    const zoomed = zoomViewport({
      view: BASE, scale: 2, focusX: 0.5, focusY: 0.5,
      base: BASE, minZoom: 0.5, maxZoom: 50,
    });
    expect(zoomed.x1 - zoomed.x0).toBeCloseTo(2, 8);
  });

  test('зум у самого края не выбрасывает данные', () => {
    let view = BASE;
    for (let i = 0; i < 30; i += 1) {
      view = zoomViewport({
        view, scale: 1.6, focusX: 1, focusY: 0,
        base: BASE, minZoom: 0.5, maxZoom: 50,
      });
    }
    expect(overlap(view.x0, view.x1, BASE.x0, BASE.x1)).toBeGreaterThan(0);
    expect(overlap(view.y0, view.y1, BASE.y0, BASE.y1)).toBeGreaterThan(0);
  });

  test('мера отступа объявлена и разумна', () => {
    expect(OVERSCAN).toBeGreaterThan(0);
    expect(OVERSCAN).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: Прогнать и убедиться, что тесты падают**

Run: `npx jest calc/__tests__/chartViewport.test.js`
Expected: FAIL — `Cannot find module '../chartViewport'`

- [ ] **Step 3: Написать модуль**

Создать `calc/chartViewport.js`:

```js
/**
 * Видимая область графика как значение
 *
 * Область просмотра — это четыре числа, и все операции над ней должны быть
 * чистыми: только так проверяется свойство, ради которого модуль и заведён —
 * данные нельзя потерять. Раньше сдвиг не был ограничен ничем, и одно
 * движение пальца уводило весь ряд замеров за край полотна; вернуть его можно
 * было только «Сбросом», то есть потеряв заодно и масштаб.
 *
 * Ограничение положения живёт здесь, а не в `zoomView`/`panView`: те считают
 * чистую геометрию и уже покрыты тестами, а решение «как далеко разрешено
 * увести окно» — отдельное, и проверяется отдельно.
 */

import { zoomView, panView } from './chartGeometry';

/**
 * Насколько далеко окно уводится от данных — доля от размаха самого окна
 *
 * Отсчёт от размаха окна, а не базовой области, принципиален: при сильном
 * приближении окно много уже базового, и мера, взятая от базового, разрешила
 * бы уехать туда, где данных нет вовсе.
 *
 * При 0.4 из правила следует проверяемая гарантия: окно всегда пересекается
 * с данными не меньше чем на 10 % своего размера по каждой оси.
 */
export const OVERSCAN = 0.4;

/**
 * Подгоняет область под все точки сразу
 *
 * Считается по всем сериям: кривая соседней скважины, не влезшая в масштаб
 * основной, обрезалась бы краем полотна.
 *
 * @param {Array<{points: Array<{x: number, y: number}>}>} seriesList - серии
 * @param {Object} [options]
 * @param {number} [options.padX] - запас по краям оси абсцисс, доля размаха
 * @param {number} [options.padY] - запас сверху по понижению, доля размаха
 * @returns {{x0: number, x1: number, y0: number, y1: number}} область
 */
export function fitViewport(seriesList, { padX = 0.08, padY = 0.12 } = {}) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (const series of seriesList ?? []) {
    for (const point of series?.points ?? []) {
      if (!isFinite(point?.x) || !isFinite(point?.y)) continue;
      count += 1;
      if (point.x < x0) x0 = point.x;
      if (point.x > x1) x1 = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (count === 0) return { x0: 0, x1: 1, y0: 0, y1: 1 };

  // Все точки на одной вертикали: без раздвижки окно вырождается в линию,
  // и дальше всё деление на размах даёт бесконечности
  if (x1 - x0 < 1e-9) {
    x0 -= 0.5;
    x1 += 0.5;
  }
  const pad = (x1 - x0) * padX;

  return {
    x0: x0 - pad,
    x1: x1 + pad,
    // Понижение отсчитывается от нуля: так построены графики способа прямой
    // линии, и по отсечке на оси считается водоотдача
    y0: 0,
    y1: maxY > 0 ? maxY * (1 + padY) : 1,
  };
}

/**
 * Возвращает окно к данным, если его увели слишком далеко
 *
 * Зажимается центр окна, а не его края: так размах остаётся прежним, и
 * поставленный руками масштаб не теряется при возврате.
 *
 * @param {{x0: number, x1: number, y0: number, y1: number}} view - окно
 * @param {Object} params
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.base - область данных
 * @param {number} [params.overscan] - мера отступа, доля размаха окна
 * @returns {{x0: number, x1: number, y0: number, y1: number}} окно у данных
 */
export function clampViewport(view, { base, overscan = OVERSCAN }) {
  'worklet';
  const rangeX = view.x1 - view.x0;
  const rangeY = view.y1 - view.y0;

  // Окно могло выродиться посреди жеста: щипок двумя пальцами на мгновение
  // даёт нулевой размах. Испорченное окно заменяем видом по данным — иначе
  // деление на размах разносит NaN по всей сцене
  if (
    !(rangeX > 0) || !(rangeY > 0) ||
    !isFinite(view.x0) || !isFinite(view.y0)
  ) {
    return base;
  }

  const shift = (lo, hi, range, baseLo, baseHi) => {
    'worklet';
    const margin = overscan * range;
    const centre = (lo + hi) / 2;
    const bounded = Math.min(baseHi + margin, Math.max(baseLo - margin, centre));
    const delta = bounded - centre;
    return [lo + delta, hi + delta];
  };

  const [x0, x1] = shift(view.x0, view.x1, rangeX, base.x0, base.x1);
  const [y0, y1] = shift(view.y0, view.y1, rangeY, base.y0, base.y1);

  return { x0, x1, y0, y1 };
}

/**
 * Масштабирует окно и возвращает его к данным
 *
 * @param {Object} params - как у zoomView, но базовая область целиком
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новое окно
 */
export function zoomViewport({
  view, scale, scaleX, scaleY, focusX, focusY, base, minZoom, maxZoom,
  overscan = OVERSCAN,
}) {
  'worklet';
  const zoomed = zoomView({
    view,
    scale,
    scaleX,
    scaleY,
    focusX,
    focusY,
    baseRange: { x: base.x1 - base.x0, y: base.y1 - base.y0 },
    minZoom,
    maxZoom,
  });
  return clampViewport(zoomed, { base, overscan });
}

/**
 * Сдвигает окно и возвращает его к данным
 *
 * @param {Object} params - как у panView, плюс базовая область
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новое окно
 */
export function panViewport({ view, dx, dy, plot, base, overscan = OVERSCAN }) {
  'worklet';
  return clampViewport(panView({ view, dx, dy, plot }), { base, overscan });
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx jest calc/__tests__/chartViewport.test.js`
Expected: PASS, все тесты зелёные

- [ ] **Step 5: Убедиться, что старые тесты не сломаны**

Run: `npx jest`
Expected: PASS, 51 тест `chartGeometry` по-прежнему зелёные

- [ ] **Step 6: Коммит**

```bash
git add calc/chartViewport.js calc/__tests__/chartViewport.test.js
git commit -m "feat(chart): область просмотра как значение с ограничением положения

Данные больше нельзя увести за край полотна: центр окна зажимается
мерой от размаха самого окна, поэтому гарантия держится и при сильном
приближении. Размах при возврате не меняется — масштаб не теряется.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Свободная прямая, которую нельзя потерять

**Files:**
- Modify: `calc/chartGeometry.js` — дописать в конец файла
- Modify: `calc/__tests__/chartGeometry.test.js` — дописать в конец файла

**Interfaces:**
- Consumes: `lineThroughPoints` из `calc/cooperJacob.js`; `plot` вида `{x, y, w, h}`.
- Produces:
  - `ANCHOR_INSET: number` (10)
  - `clampAnchorToPlot({ px, py, plot, inset? }) → {px, py}` (worklet)
  - `nearestAnchorIndex({ px, py, ax0, ay0, ax1, ay1 }) → 0 | 1` (worklet)
  - `freeLine(anchors) → { slope, intercept, ready }`

- [ ] **Step 1: Написать падающие тесты**

Дописать в конец `calc/__tests__/chartGeometry.test.js`:

```js
describe('clampAnchorToPlot', () => {
  const PLOT_A = { x: 46, y: 14, w: 280, h: 178 };

  test('точка внутри полотна не двигается', () => {
    expect(clampAnchorToPlot({ px: 100, py: 100, plot: PLOT_A })).toEqual({
      px: 100,
      py: 100,
    });
  });

  test('точку, утащенную за левый край, возвращает на полотно', () => {
    // Координаты жеста продолжают приходить и за пределами View: без зажима
    // свободная точка уезжает туда, где её больше нечем поймать пальцем
    const fixed = clampAnchorToPlot({ px: -500, py: 100, plot: PLOT_A });
    expect(fixed.px).toBeGreaterThanOrEqual(PLOT_A.x);
    expect(fixed.px).toBeLessThanOrEqual(PLOT_A.x + PLOT_A.w);
  });

  test('точку, утащенную вниз и вправо, возвращает на полотно', () => {
    const fixed = clampAnchorToPlot({ px: 9999, py: 9999, plot: PLOT_A });
    expect(fixed.px).toBeLessThanOrEqual(PLOT_A.x + PLOT_A.w);
    expect(fixed.py).toBeLessThanOrEqual(PLOT_A.y + PLOT_A.h);
  });

  test('точка остаётся в пределах досягаемости пальца от края', () => {
    const fixed = clampAnchorToPlot({ px: -500, py: -500, plot: PLOT_A });
    expect(fixed.px).toBeGreaterThanOrEqual(PLOT_A.x);
    expect(fixed.py).toBeGreaterThanOrEqual(PLOT_A.y);
  });

  test('NaN не пролезает наружу', () => {
    const fixed = clampAnchorToPlot({ px: NaN, py: NaN, plot: PLOT_A });
    expect(Number.isNaN(fixed.px)).toBe(false);
    expect(Number.isNaN(fixed.py)).toBe(false);
  });
});

describe('nearestAnchorIndex', () => {
  test('выбирает ту точку, что ближе к пальцу', () => {
    const anchors = { ax0: 100, ay0: 100, ax1: 300, ay1: 100 };
    expect(nearestAnchorIndex({ px: 120, py: 100, ...anchors })).toBe(0);
    expect(nearestAnchorIndex({ px: 280, py: 100, ...anchors })).toBe(1);
  });

  test('непоставленная точка не выигрывает у поставленной', () => {
    const index = nearestAnchorIndex({
      px: 120, py: 100, ax0: NaN, ay0: NaN, ax1: 300, ay1: 100,
    });
    expect(index).toBe(1);
  });
});

describe('freeLine', () => {
  test('две точки дают прямую', () => {
    const line = freeLine([{ x: 0, y: 0 }, { x: 2, y: 4 }]);
    expect(line.ready).toBe(true);
    expect(line.slope).toBeCloseTo(2, 10);
  });

  test('точки на одной вертикали прямой не дают', () => {
    // Здесь прямая пропадала с полотна, а расчёт молча уезжал на МНК:
    // число T в карточке менялось, и понять почему было неоткуда
    const line = freeLine([{ x: 1, y: 0 }, { x: 1, y: 4 }]);
    expect(line.ready).toBe(false);
  });

  test('без пары точек прямой нет', () => {
    expect(freeLine(null).ready).toBe(false);
    expect(freeLine([{ x: 0, y: 0 }]).ready).toBe(false);
  });
});
```

Дописать имена в блок импорта наверху того же файла (строки 9–23), в существующий список: `clampAnchorToPlot`, `nearestAnchorIndex`, `freeLine`.

- [ ] **Step 2: Прогнать и убедиться, что тесты падают**

Run: `npx jest calc/__tests__/chartGeometry.test.js`
Expected: FAIL — `clampAnchorToPlot is not a function`

- [ ] **Step 3: Дописать функции**

В конец `calc/chartGeometry.js` (после `pickDragTarget`), и добавить импорт наверху файла:

```js
import { lineThroughPoints } from './cooperJacob';
```

```js
/**
 * Отступ свободной точки от края области построения, px
 *
 * Не ноль: точка, севшая ровно на край, наполовину уходит под ось, и попасть
 * по ней пальцем становится нечем.
 */
export const ANCHOR_INSET = 10;

/**
 * Не даёт свободной точке уйти за полотно
 *
 * RNGH продолжает отдавать координаты жеста и за пределами View, поэтому
 * точку можно было утащить в область, которой на экране нет. Поймать её там
 * пальцем было нечем, а «Сброс» возвращает видимую область, но не точки, —
 * прямая пропадала насовсем.
 *
 * @param {Object} params
 * @param {number} params.px - куда утащил палец, px
 * @param {number} params.py - куда утащил палец, px
 * @param {{x: number, y: number, w: number, h: number}} params.plot - область построения
 * @param {number} [params.inset] - отступ от края, px
 * @returns {{px: number, py: number}} точка в пределах полотна
 */
export function clampAnchorToPlot({ px, py, plot, inset = ANCHOR_INSET }) {
  'worklet';
  // NaN пролезает, пока точки ещё не поставлены: без подмены он расползается
  // по всей сцене через обратный перевод в координаты данных
  const safeX = isFinite(px) ? px : plot.x + plot.w / 2;
  const safeY = isFinite(py) ? py : plot.y + plot.h / 2;

  // Отступ ужимается под узкое полотно: на планшете в портрете область
  // построения бывает уже двух отступов, и границы разошлись бы местами
  const padX = Math.min(inset, plot.w / 2);
  const padY = Math.min(inset, plot.h / 2);

  return {
    px: Math.min(plot.x + plot.w - padX, Math.max(plot.x + padX, safeX)),
    py: Math.min(plot.y + plot.h - padY, Math.max(plot.y + padY, safeY)),
  };
}

/**
 * Какая из двух свободных точек ближе к пальцу
 *
 * Нужна касанию в свободном режиме: тап переносит под палец ближайшую точку,
 * и это единственный способ вернуть прямую, если точки разъехались по краям.
 *
 * @param {Object} params
 * @param {number} params.px - касание, px
 * @param {number} params.py - касание, px
 * @param {number} params.ax0 - первая точка, px
 * @param {number} params.ay0 - первая точка, px
 * @param {number} params.ax1 - вторая точка, px
 * @param {number} params.ay1 - вторая точка, px
 * @returns {number} 0 или 1
 */
export function nearestAnchorIndex({ px, py, ax0, ay0, ax1, ay1 }) {
  'worklet';
  const d0 = Math.hypot(px - ax0, py - ay0);
  const d1 = Math.hypot(px - ax1, py - ay1);
  // Пока точки не поставлены, расстояние до них NaN: непоставленная точка не
  // должна выигрывать у поставленной только потому, что сравнение с NaN ложно
  if (!isFinite(d0)) return isFinite(d1) ? 1 : 0;
  if (!isFinite(d1)) return 0;
  return d0 <= d1 ? 0 : 1;
}

/**
 * Прямая через две свободные точки — с честным признаком «прямой нет»
 *
 * Точки, вставшие на одну вертикаль, прямой не задают. Раньше это выражалось
 * молчаливым NaN: путь прямой пропадал с полотна, а обработка переходила на
 * метод наименьших квадратов и показывала другое T. Признак `ready` даёт
 * экрану возможность сказать об этом вслух.
 *
 * @param {Array<{x: number, y: number}>} anchors - две свободные точки
 * @returns {{slope: number, intercept: number, ready: boolean}} прямая
 */
export function freeLine(anchors) {
  if (anchors?.length !== 2) {
    return { slope: NaN, intercept: NaN, ready: false };
  }
  const line = lineThroughPoints(anchors[0], anchors[1]);
  return {
    ...line,
    ready: isFinite(line.slope) && isFinite(line.intercept),
  };
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx jest calc/__tests__/chartGeometry.test.js`
Expected: PASS, включая 51 прежний тест

- [ ] **Step 5: Коммит**

```bash
git add calc/chartGeometry.js calc/__tests__/chartGeometry.test.js
git commit -m "feat(chart): свободную точку нельзя утащить за полотно

Плюс честный признак вырожденной прямой: точки на одной вертикали
прямой не задают, и обработка больше не уезжает молча на МНК.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Единая модель серий и кривая восстановления

**Files:**
- Create: `calc/chartSeries.js`
- Create: `calc/__tests__/chartSeries.test.js`

**Interfaces:**
- Consumes: `transformTime`, `X_MODES` из `calc/cooperJacob.js`.
- Produces:
  - `SERIES_ROLES = { FIT: 'fit', REFERENCE: 'reference' }`
  - `SERIES_COLORS: string[]`
  - `buildSeries({ raw, mode, palette? }) → Array<{id, name, color, role, points: Array<{x, y, index}>}>`
    где `raw` — `Array<{id, name, role, color?, measurements: Array<{t, s, group?, groupName?}>}>`
  - `residualDrawdown({ measurements, finalDrawdown }) → Array<{t, s}>`

- [ ] **Step 1: Написать падающие тесты**

Создать `calc/__tests__/chartSeries.test.js`:

```js
/**
 * Проверка модели серий графика
 *
 * До этого на полотне жили три несовместимых представления: ряд с признаком
 * скважины, отдельный список соседних кривых и ничего для восстановления.
 * Здесь проверяется, что все три сводятся к одному списку серий.
 */

import {
  buildSeries,
  residualDrawdown,
  SERIES_ROLES,
  SERIES_COLORS,
} from '../chartSeries';
import { X_MODES } from '../cooperJacob';

const raw = (measurements, extra = {}) => ({
  id: 'main',
  name: 'Откачка',
  role: SERIES_ROLES.FIT,
  measurements,
  ...extra,
});

describe('buildSeries', () => {
  test('переводит время по выбранной оси', () => {
    const [series] = buildSeries({
      raw: [raw([{ t: 10, s: 1 }, { t: 100, s: 2 }])],
      mode: X_MODES.LOG,
    });
    expect(series.points[0].x).toBeCloseTo(1, 10);
    expect(series.points[1].x).toBeCloseTo(2, 10);
  });

  test('точки помнят своё место в журнале, а не в отфильтрованном ряду', () => {
    // На логарифмической оси замер с t = 0 выпадает, и нумерация разошлась бы
    // с журналом — отметка точки в таблице встала бы не на ту строку
    const [series] = buildSeries({
      raw: [raw([{ t: 0, s: 1 }, { t: 10, s: 2 }, { t: 100, s: 3 }])],
      mode: X_MODES.LOG,
    });
    expect(series.points.map((p) => p.index)).toEqual([1, 2]);
  });

  test('непригодные замеры отбрасываются', () => {
    const [series] = buildSeries({
      raw: [raw([{ t: 10, s: NaN }, { t: 10, s: 1 }])],
      mode: X_MODES.LINEAR,
    });
    expect(series.points).toHaveLength(1);
  });

  test('ряд с признаком скважины разбивается на серии по скважинам', () => {
    const series = buildSeries({
      raw: [
        raw([
          { t: 10, s: 1, group: 'w1', groupName: '1p' },
          { t: 10, s: 2, group: 'w2', groupName: '2p' },
          { t: 20, s: 3, group: 'w1', groupName: '1p' },
        ]),
      ],
      mode: X_MODES.LOG,
    });
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.name)).toEqual(['1p', '2p']);
    expect(series[0].points).toHaveLength(2);
  });

  test('разбитые по скважинам серии остаются серией подбора', () => {
    // Прямая на комбинированном прослеживании ведётся по всем точкам сразу,
    // а цвет только показывает, чья точка
    const series = buildSeries({
      raw: [raw([{ t: 10, s: 1, group: 'w1', groupName: '1p' }])],
      mode: X_MODES.LOG,
    });
    expect(series[0].role).toBe(SERIES_ROLES.FIT);
  });

  test('цвета серий не повторяются, пока хватает палитры', () => {
    const series = buildSeries({
      raw: [
        raw([{ t: 10, s: 1 }]),
        { id: 'b', name: 'B', role: SERIES_ROLES.REFERENCE, measurements: [{ t: 10, s: 2 }] },
        { id: 'c', name: 'C', role: SERIES_ROLES.REFERENCE, measurements: [{ t: 10, s: 3 }] },
      ],
      mode: X_MODES.LOG,
    });
    const colors = series.map((s) => s.color);
    expect(new Set(colors).size).toBe(3);
  });

  test('заданный цвет серии не подменяется палитрой', () => {
    const [series] = buildSeries({
      raw: [raw([{ t: 10, s: 1 }], { color: '#123456' })],
      mode: X_MODES.LOG,
    });
    expect(series.color).toBe('#123456');
  });

  test('пустая серия в список не попадает', () => {
    const series = buildSeries({
      raw: [raw([]), { id: 'b', name: 'B', role: SERIES_ROLES.REFERENCE, measurements: [{ t: 10, s: 1 }] }],
      mode: X_MODES.LOG,
    });
    expect(series.map((s) => s.id)).toEqual(['b']);
  });

  test('палитра объявлена и непустая', () => {
    expect(SERIES_COLORS.length).toBeGreaterThan(2);
  });
});

describe('residualDrawdown', () => {
  test('остаточное понижение убывает от понижения на остановке к нулю', () => {
    // Журнал восстановления хранит величину подъёма уровня; на общей оси с
    // откачкой её надо читать как остаток понижения, иначе кривые смотрят
    // в разные стороны и вместе не читаются
    const points = residualDrawdown({
      measurements: [{ t: 1, s: 0 }, { t: 10, s: 2 }, { t: 100, s: 4.9 }],
      finalDrawdown: 5,
    });
    expect(points.map((p) => p.s)).toEqual([5, 3, expect.closeTo(0.1, 10)]);
  });

  test('без понижения на остановке кривой нет', () => {
    expect(
      residualDrawdown({ measurements: [{ t: 1, s: 0 }], finalDrawdown: 0 })
    ).toEqual([]);
    expect(
      residualDrawdown({ measurements: [{ t: 1, s: 0 }], finalDrawdown: NaN })
    ).toEqual([]);
  });

  test('подъём больше понижения на остановке не даёт отрицательного остатка', () => {
    // Замер мог быть введён с опечаткой; отрицательное понижение на графике
    // означало бы уровень выше исходного, чего при восстановлении не бывает
    const points = residualDrawdown({
      measurements: [{ t: 10, s: 7 }],
      finalDrawdown: 5,
    });
    expect(points[0].s).toBe(0);
  });

  test('непригодные замеры отбрасываются', () => {
    const points = residualDrawdown({
      measurements: [{ t: NaN, s: 1 }, { t: 10, s: NaN }, { t: 10, s: 1 }],
      finalDrawdown: 5,
    });
    expect(points).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Прогнать и убедиться, что тесты падают**

Run: `npx jest calc/__tests__/chartSeries.test.js`
Expected: FAIL — `Cannot find module '../chartSeries'`

- [ ] **Step 3: Написать модуль**

Создать `calc/chartSeries.js`:

```js
/**
 * Серии графика понижения
 *
 * На полотне до этого жили три несовместимых представления кривых: ряд замеров
 * с признаком скважины (комбинированное прослеживание), отдельный список
 * соседних кривых куста и ничего для восстановления уровня. Каждое со своими
 * цветами, своей отрисовкой и своим местом в масштабе. Здесь они сводятся к
 * одному списку серий, и кривая восстановления становится просто ещё одной.
 *
 * Роль серии решает, участвует ли она в подборе прямой. Серий подбора может
 * быть несколько: на комбинированном прослеживании прямая ведётся по точкам
 * всего куста сразу, а цвет только показывает, чья точка.
 */

import { transformTime } from './cooperJacob';

/** Участвует ли серия в подборе прямой и отметке точек */
export const SERIES_ROLES = { FIT: 'fit', REFERENCE: 'reference' };

/**
 * Цвета кривых
 *
 * Фиксированный набор, а не цвета темы: кривых на плоскости столько, сколько
 * в кусте наблюдательных скважин, и различать их надо между собой. Оттенки
 * подобраны так, чтобы читались и на светлом, и на тёмном фоне.
 */
export const SERIES_COLORS = [
  '#2E86AB',
  '#E07A5F',
  '#3D9970',
  '#B5179E',
  '#F4A261',
  '#5C6BC0',
];

/**
 * Собирает серии для отрисовки
 *
 * Серия с признаком группы разбивается на несколько — по одной на скважину, —
 * и все они остаются сериями подбора: прямая ведётся по ним сразу.
 *
 * @param {Object} params
 * @param {Array<Object>} params.raw - описания серий: id, name, role, color,
 *   measurements вида [{t, s, group?, groupName?}]
 * @param {string} params.mode - ось абсцисс, см. X_MODES
 * @param {Array<string>} [params.palette] - цвета; повторяются по кругу
 * @returns {Array<{id: string, name: string, color: string, role: string,
 *   points: Array<{x: number, y: number, index: number}>}>} серии
 */
export function buildSeries({ raw, mode, palette = SERIES_COLORS }) {
  const result = [];
  let colorSlot = 0;

  /** Следующий цвет палитры; серия со своим цветом слот не занимает */
  const nextColor = () => palette[colorSlot++ % palette.length];

  for (const entry of raw ?? []) {
    // Точки помнят место в исходном журнале, а не в отфильтрованном ряду: по
    // этим же номерам идёт отметка точек в таблице замеров, и сдвиг нумерации
    // ставил бы галочку не на ту строку
    const points = (entry?.measurements ?? [])
      .map((m, index) => ({
        x: transformTime(m.t, mode),
        y: m.s,
        index,
        group: m.group,
        groupName: m.groupName,
      }))
      .filter((p) => p.x != null && isFinite(p.x) && isFinite(p.y));

    if (points.length === 0) continue;

    const grouped = points.some((p) => p.group != null);

    if (!grouped) {
      result.push({
        id: entry.id,
        name: entry.name,
        color: entry.color ?? nextColor(),
        role: entry.role ?? SERIES_ROLES.REFERENCE,
        points: points.map(({ x, y, index }) => ({ x, y, index })),
      });
      continue;
    }

    // Серии идут в порядке первого появления, а не по алфавиту: порядок
    // задаёт список скважин, и цвет скважины не должен меняться от
    // переименования соседней
    const byGroup = new Map();
    for (const point of points) {
      const key = point.group ?? '';
      if (!byGroup.has(key)) {
        byGroup.set(key, {
          id: `${entry.id}:${key}`,
          name: point.groupName ?? entry.name,
          color: nextColor(),
          role: entry.role ?? SERIES_ROLES.FIT,
          points: [],
        });
      }
      byGroup.get(key).points.push({
        x: point.x,
        y: point.y,
        index: point.index,
      });
    }
    result.push(...byGroup.values());
  }

  return result;
}

/**
 * Переводит журнал восстановления в остаточное понижение
 *
 * В журнале лежит величина подъёма уровня, отсчитанная от момента остановки
 * насоса. На общей с откачкой оси понижения её надо читать как остаток:
 * иначе кривые смотрят в разные стороны и вместе не читаются. Остаток
 * начинается с понижения на остановке и сходит к нулю — уровень вернулся.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - журнал
 *   восстановления: t от остановки насоса, s — подъём уровня
 * @param {number} params.finalDrawdown - понижение на момент остановки
 * @returns {Array<{t: number, s: number}>} остаточное понижение
 */
export function residualDrawdown({ measurements, finalDrawdown }) {
  // Без понижения на остановке остаток не с чем считать: кривой нет, и экран
  // объясняет, какого поля не хватает
  if (!(finalDrawdown > 0)) return [];

  return (measurements ?? [])
    .map((m) => ({
      t: m.t,
      // Ниже нуля остаток не опускается: это означало бы уровень выше
      // исходного, чего при восстановлении не бывает, — а на графике
      // выглядело бы как настоящий замер
      s: Math.max(0, finalDrawdown - m.s),
    }))
    .filter((p) => isFinite(p.t) && isFinite(p.s));
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx jest calc/__tests__/chartSeries.test.js`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add calc/chartSeries.js calc/__tests__/chartSeries.test.js
git commit -m "feat(chart): единая модель серий и остаточное понижение

Ряд с признаком скважины, соседние кривые куста и восстановление
уровня становятся одним списком серий. Журнал восстановления читается
как остаток понижения — на общей оси с откачкой кривые смотрят в одну
сторону.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Сцена — данные и область в геометрию отрисовки

**Files:**
- Create: `calc/chartScene.js`
- Create: `calc/__tests__/chartScene.test.js`
- Modify: `components/DrawdownChart.js` — удалить `niceStep` (строки 97–110), `formatTick` (112–127), `formatLogTick` (129–144); импортировать их из нового модуля

**Interfaces:**
- Consumes: `valueToPixelX`, `valueToPixelY`, `logTicks` из `calc/chartGeometry.js`; `SERIES_ROLES` из `calc/chartSeries.js`; `X_MODES` из `calc/cooperJacob.js`.
- Produces:
  - `niceStep(range) → number`
  - `formatTick(value) → string`
  - `formatLogTick(value) → string`
  - `buildScene({ series, view, base, plot, mode, fit, anchors }) → { hasData, shapes, anchorDots, fitPath, xTicks, yTicks }`
    Отметка точек сюда не входит: `selected` — это состояние отрисовки, а не геометрии, и применяется в `ChartCanvas`. Иначе смена отметки пересчитывала бы всю сцену.
    - `shapes`: `Array<{id, color, role, path, dots: Array<{cx, cy, index}>}>`
    - `xTicks`: `Array<{x: number, label: string|null}>`
    - `yTicks`: `Array<{y: number, label: string}>`

- [ ] **Step 1: Написать падающие тесты**

Создать `calc/__tests__/chartScene.test.js`:

```js
/**
 * Проверка сцены графика
 *
 * Сцена — это всё, что зависит от видимой области: положения точек, ломаные,
 * деления осей и путь прямой. Раньше это был стопятидесятистрочный useMemo
 * внутри компонента, и проверить его можно было только глазами.
 */

import { buildScene, niceStep, formatTick, formatLogTick } from '../chartScene';
import { SERIES_ROLES } from '../chartSeries';
import { X_MODES } from '../cooperJacob';

const PLOT = { x: 46, y: 14, w: 280, h: 178 };
const VIEW = { x0: 0, x1: 4, y0: 0, y1: 25 };

const series = [
  {
    id: 'main',
    name: 'Откачка',
    color: '#2E86AB',
    role: SERIES_ROLES.FIT,
    points: [
      { x: 1, y: 5, index: 0 },
      { x: 2, y: 10, index: 1 },
      { x: 3, y: 15, index: 2 },
    ],
  },
];

const scene = (overrides = {}) =>
  buildScene({
    series,
    view: VIEW,
    base: VIEW,
    plot: PLOT,
    mode: X_MODES.LOG,
    fit: { slope: 5, intercept: 0 },
    anchors: null,
    ...overrides,
  });

describe('buildScene', () => {
  test('без серий сцена пустая, но не ломаная', () => {
    const empty = scene({ series: [] });
    expect(empty.hasData).toBe(false);
    expect(empty.shapes).toEqual([]);
    expect(empty.xTicks).toEqual([]);
  });

  test('каждая серия даёт свою ломаную', () => {
    const built = scene();
    expect(built.shapes).toHaveLength(1);
    expect(built.shapes[0].path.startsWith('M')).toBe(true);
    expect(built.shapes[0].dots).toHaveLength(3);
  });

  test('ломаная не ведётся через точки разных серий', () => {
    // На комбинированном прослеживании из этого получилась бы пила
    const built = scene({
      series: [
        series[0],
        { ...series[0], id: 'second', points: [{ x: 1.5, y: 2, index: 0 }] },
      ],
    });
    expect(built.shapes).toHaveLength(2);
    // Одна точка ломаной не образует
    expect(built.shapes[1].path).toBe('');
  });

  test('точки ложатся в пределы области построения', () => {
    const built = scene();
    for (const dot of built.shapes[0].dots) {
      expect(dot.cx).toBeGreaterThanOrEqual(PLOT.x);
      expect(dot.cx).toBeLessThanOrEqual(PLOT.x + PLOT.w);
      expect(dot.cy).toBeGreaterThanOrEqual(PLOT.y);
      expect(dot.cy).toBeLessThanOrEqual(PLOT.y + PLOT.h);
    }
  });

  test('точка помнит номер строки журнала', () => {
    expect(scene().shapes[0].dots.map((d) => d.index)).toEqual([0, 1, 2]);
  });

  test('прямая проводится через всю ширину полотна', () => {
    const built = scene();
    expect(built.fitPath).toMatch(/^M[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+$/);
  });

  test('без прямой путь пустой, а сцена цела', () => {
    const built = scene({ fit: { slope: NaN, intercept: NaN } });
    expect(built.fitPath).toBe('');
    expect(built.hasData).toBe(true);
  });

  test('вырожденная область не роняет сцену в пустое состояние', () => {
    // Щипок двумя пальцами на мгновение даёт нулевой размах: раньше в этот
    // кадр график показывал «внесите замеры» прямо во время масштабирования
    const built = scene({ view: { x0: 2, x1: 2, y0: 0, y1: 0 } });
    expect(built.hasData).toBe(true);
    expect(built.shapes[0].dots).toHaveLength(3);
  });

  test('деления не выходят за область построения', () => {
    const built = scene();
    for (const tick of built.xTicks) {
      expect(tick.x).toBeGreaterThanOrEqual(PLOT.x - 1);
      expect(tick.x).toBeLessThanOrEqual(PLOT.x + PLOT.w + 1);
    }
    for (const tick of built.yTicks) {
      expect(tick.y).toBeGreaterThanOrEqual(PLOT.y - 1);
      expect(tick.y).toBeLessThanOrEqual(PLOT.y + PLOT.h + 1);
    }
  });

  test('на логарифмической оси подписаны степени десяти', () => {
    const labels = scene().xTicks.map((t) => t.label).filter(Boolean);
    expect(labels).toContain('10');
    expect(labels).toContain('100');
  });

  test('свободные точки переводятся в пиксели', () => {
    const built = scene({ anchors: [{ x: 1, y: 5 }, { x: 3, y: 15 }] });
    expect(built.anchorDots).toHaveLength(2);
    expect(built.anchorDots[0].cx).toBeCloseTo(built.shapes[0].dots[0].cx, 6);
  });

  test('без свободных точек их список пуст', () => {
    expect(scene().anchorDots).toEqual([]);
  });
});

describe('niceStep', () => {
  test('шаг кратен 1, 2, 5 или 10 на степень десяти', () => {
    for (const range of [1, 3, 7, 45, 900, 0.03]) {
      const step = niceStep(range);
      const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 5, 10]).toContain(Math.round(step / magnitude));
    }
  });

  test('вырожденный размах не даёт нулевого шага', () => {
    expect(niceStep(0)).toBeGreaterThan(0);
    expect(niceStep(NaN)).toBeGreaterThan(0);
  });
});

describe('подписи делений', () => {
  test('крайности уходят в степенную запись', () => {
    expect(formatTick(0.0000001)).toContain('e');
    expect(formatTick(1e7)).toContain('e');
  });

  test('нуль остаётся нулём', () => {
    expect(formatTick(0)).toBe('0');
  });

  test('логарифмическая ось не тащит хвосты', () => {
    expect(formatLogTick(20.000000000000004)).toBe('20');
    expect(formatLogTick(100)).toBe('100');
  });
});
```

- [ ] **Step 2: Прогнать и убедиться, что тесты падают**

Run: `npx jest calc/__tests__/chartScene.test.js`
Expected: FAIL — `Cannot find module '../chartScene'`

- [ ] **Step 3: Написать модуль**

Создать `calc/chartScene.js`. `niceStep`, `formatTick`, `formatLogTick` переносятся из `components/DrawdownChart.js` (строки 97–144) **дословно, вместе с их шапками**. Тело `buildScene` — это `useMemo` из `components/DrawdownChart.js` (строки 782–936), переписанный под список серий:

```js
/**
 * Сцена графика: данные и видимая область → геометрия отрисовки
 *
 * Всё, что зависит от масштаба: положения точек, ломаные, деления осей и путь
 * прямой. Вынесено из компонента отдельно, потому что это чистые вычисления,
 * от которых зависит и то, попадёт ли палец по точке, и то, останутся ли оси
 * на месте при зуме. Такие вещи должны проверяться тестами, а не глазами.
 *
 * Координаты пересчитываются, а не масштабируется группа SVG: трансформация
 * растянула бы вместе с данными и толщину линий, и радиусы точек, и подписи.
 */

import { valueToPixelX, valueToPixelY, logTicks } from './chartGeometry';
import { X_MODES } from './cooperJacob';

// ...сюда niceStep, formatTick, formatLogTick — дословно из
// components/DrawdownChart.js, строки 97–144, с их шапками...

/** Сколько пикселей нужно подписи деления, чтобы числа не налезали */
const LABEL_ROOM = 56;

/** Больше этого числа делений на оси не ставится: подписи сливаются */
const MAX_TICKS = 8;

/**
 * Собирает всё, что зависит от видимой области
 *
 * @param {Object} params
 * @param {Array<Object>} params.series - серии, см. calc/chartSeries.js
 * @param {Object} params.view - видимая область
 * @param {Object} params.base - область по данным: подменяет испорченную
 * @param {{x: number, y: number, w: number, h: number}} params.plot - полотно
 * @param {string} params.mode - ось абсцисс, см. X_MODES
 * @param {{slope: number, intercept: number}} params.fit - прямая
 * @param {Array<{x: number, y: number}>|null} params.anchors - свободные точки
 * @param {Array<number>} params.selected - отмеченные замеры
 * @returns {Object} сцена
 */
export function buildScene({ series, view, base, plot, mode, fit, anchors }) {
  const shapes = [];
  const empty = {
    hasData: false,
    shapes,
    anchorDots: [],
    fitPath: '',
    xTicks: [],
    yTicks: [],
  };

  const hasData = (series ?? []).some((s) => s.points?.length > 0);
  if (!hasData) return empty;

  // Область могла выродиться посреди жеста: щипок двумя пальцами на мгновение
  // даёт нулевой или отрицательный размах. Раньше это роняло график в пустое
  // состояние с надписью «внесите замеры» — прямо во время масштабирования
  const safe =
    view.x1 - view.x0 > 0 &&
    view.y1 - view.y0 > 0 &&
    isFinite(view.x0) &&
    isFinite(view.y0)
      ? view
      : base;

  const toX = (value) => valueToPixelX(value, safe, plot);
  const toY = (value) => valueToPixelY(value, safe, plot);

  for (const one of series) {
    const dots = one.points.map((point) => ({
      cx: toX(point.x),
      cy: toY(point.y),
      index: point.index,
    }));
    shapes.push({
      id: one.id,
      name: one.name,
      color: one.color,
      role: one.role,
      dots,
      // Ломаная своя у каждой серии: через точки разных скважин её вести
      // нельзя — на комбинированном графике получилась бы пила
      path:
        dots.length > 1
          ? 'M' + dots.map((d) => `${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(' L')
          : '',
    });
  }

  let fitPath = '';
  if (isFinite(fit?.slope) && isFinite(fit?.intercept)) {
    const left = fit.slope * safe.x0 + fit.intercept;
    const right = fit.slope * safe.x1 + fit.intercept;
    fitPath =
      `M${toX(safe.x0).toFixed(1)},${toY(left).toFixed(1)} ` +
      `L${toX(safe.x1).toFixed(1)},${toY(right).toFixed(1)}`;
  }

  const anchorDots =
    anchors?.length === 2
      ? anchors.map((a) => ({ cx: toX(a.x), cy: toY(a.y) }))
      : [];

  const xTicks = [];
  if (mode === X_MODES.LOG) {
    // На логарифмической оси размечаем как логарифмическую бумагу: подписи на
    // степенях десяти, между ними мелкая сетка. Равномерный шаг по логарифму
    // давал подписи 0.316 и 3.16 — числа, по которым не прикинуть значение
    const room = Math.max(2, Math.floor(plot.w / LABEL_ROOM));
    for (const tick of logTicks({ from: safe.x0, to: safe.x1, maxLabels: room })) {
      xTicks.push({
        x: toX(tick.log),
        label: tick.labelled ? formatLogTick(tick.value) : null,
      });
    }
  } else {
    const step = niceStep(safe.x1 - safe.x0);
    for (let v = Math.ceil(safe.x0 / step) * step; v <= safe.x1 + 1e-9; v += step) {
      const px = toX(v);
      if (px < plot.x - 0.5 || px > plot.x + plot.w + 0.5) continue;
      xTicks.push({ x: px, label: formatTick(v) });
      if (xTicks.length > MAX_TICKS) break;
    }
  }

  const stepY = niceStep(safe.y1 - safe.y0);
  const yTicks = [];
  for (let v = Math.ceil(safe.y0 / stepY) * stepY; v <= safe.y1 + 1e-9; v += stepY) {
    const py = toY(v);
    if (py < plot.y - 0.5 || py > plot.y + plot.h + 0.5) continue;
    yTicks.push({ y: py, label: formatTick(v) });
    if (yTicks.length > MAX_TICKS) break;
  }

  return { hasData: true, shapes, anchorDots, fitPath, xTicks, yTicks };
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx jest calc/__tests__/chartScene.test.js`
Expected: PASS

- [ ] **Step 5: Убрать перенесённые функции из компонента**

В `components/DrawdownChart.js` удалить `niceStep` (97–110), `formatTick` (112–127), `formatLogTick` (129–144) и добавить к импортам:

```js
import { niceStep, formatTick, formatLogTick } from '../calc/chartScene';
```

- [ ] **Step 6: Прогнать весь набор**

Run: `npx jest`
Expected: PASS — компонент по-прежнему собирается, старые тесты зелёные

- [ ] **Step 7: Коммит**

```bash
git add calc/chartScene.js calc/__tests__/chartScene.test.js components/DrawdownChart.js
git commit -m "feat(chart): сцена графика вынесена в проверяемый модуль

Полтораста строк useMemo внутри компонента становятся чистой функцией:
положения точек, ломаные, деления осей и путь прямой теперь проверяются
тестами, а не глазами.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Полотно — отрисовка готовой сцены

**Files:**
- Create: `components/chart/ChartCanvas.js`

**Interfaces:**
- Consumes: `SERIES_ROLES` из `calc/chartSeries.js`; сцену из `buildScene`.
- Produces: компонент по умолчанию
  `<ChartCanvas scene plot width height colors selected anchors ghost />`
  где `colors` — `theme.colors`, `ghost` — эскиз пустого состояния или `null`.

- [ ] **Step 1: Написать компонент**

Создать `components/chart/ChartCanvas.js`. Содержимое — JSX из `components/DrawdownChart.js`, строки 1130–1312 (`<Svg>` целиком: `Defs`/`ClipPath`, эскиз, сетка, прямая, серии, точки, свободные точки, оси), перенесённое дословно с заменами:

- `scene.extraPaths` и `scene.polylines` объединяются в один проход по `scene.shapes`; серия с `role === SERIES_ROLES.REFERENCE` рисуется `strokeWidth={1.5}`, `opacity={0.85}`, точками радиуса `2.6`, и **рисуется раньше** серий подбора: открытая в журнале кривая должна читаться первой;
- `scene.dots` заменяется на `shape.dots` серий с `role === SERIES_ROLES.FIT`, радиус и цвет как в строках 1252–1268;
- `plotX/plotY/plotW/plotH` берутся из пропа `plot`;
- `c.*` заменяется на `colors.*`.

Подписи делений (строки 1317–1344) переносятся сюда же — они лежат поверх `Svg` в том же контейнере.

- [ ] **Step 2: Обозначить полосы осей**

Растяжение одной оси перетаскиванием полосы взято у Desmos, но обнаружить его сейчас невозможно: полосы ничем не отмечены. Добавить в `ChartCanvas.js` перед отрисовкой самих осей — две заливки под областью построения:

```jsx
{/* Полосы осей: за них тянут, чтобы растянуть одну ось. Без заливки этот
    жест ничем не обозначен, и найти его можно только случайно. Заливка
    едва заметная — полосы подсказывают, а не спорят с данными */}
<Rect
  x={plot.x}
  y={plot.y + plot.h}
  width={plot.w}
  height={height - plot.y - plot.h}
  fill={colors.textSecondary}
  opacity={0.05}
/>
<Rect
  x={0}
  y={plot.y}
  width={plot.x}
  height={plot.h}
  fill={colors.textSecondary}
  opacity={0.05}
/>
```

- [ ] **Step 3: Проверить сборку**

Run: `npx jest`
Expected: PASS — новый файл ещё никем не импортируется, набор должен остаться зелёным

- [ ] **Step 4: Коммит**

```bash
git add components/chart/ChartCanvas.js
git commit -m "refactor(chart): отрисовка сцены отдельным компонентом

Полосы осей получают заливку: растяжение одной оси перетаскиванием
полосы ничем не обозначалось, и найти этот жест можно было случайно.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Шапка и переключатели

**Files:**
- Create: `components/chart/ChartToolbar.js`

**Interfaces:**
- Consumes: `FIT_MODES` (объявлен в `components/DrawdownChart.js`, на этой задаче переносится в `components/chart/fitModes.js` и реэкспортируется).
- Produces: компонент по умолчанию
  `<ChartToolbar caption fitMode onFitModeChange onZoomIn onZoomOut onReset onResetLine fullscreen onToggleFullscreen colors />`

- [ ] **Step 1: Вынести FIT_MODES**

Создать `components/chart/fitModes.js` — перенести объявление и шапку `FIT_MODES` из `components/DrawdownChart.js` (строки 70–84) дословно. В `components/DrawdownChart.js` заменить объявление на:

```js
export { FIT_MODES } from './chart/fitModes';
```

- [ ] **Step 2: Написать компонент**

Создать `components/chart/ChartToolbar.js` из строк 1018–1121 `components/DrawdownChart.js` (шапка с кнопками масштаба и строка чипов способа прямой) со следующими изменениями:

- **Условие `scene.hasData &&` снимается с обеих групп.** Кнопки масштаба, «Сброс», разворот и чипы способа прямой показываются всегда. Это прямая причина того, что на одиночной откачке график выглядит полностью неуправляемым: при пустом полотне сейчас не отрисовывается ни одна кнопка.
- Добавляется кнопка «Прямую заново» — видна только при `fitMode === FIT_MODES.FREEDOM`:

```jsx
{fitMode === FIT_MODES.FREEDOM && (
  <TouchableOpacity onPress={onResetLine} accessibilityRole="button" hitSlop={8}>
    <Text style={[styles.resetLink, { color: colors.primaryAccent }]}>
      {I18n.t('resetLine', { defaultValue: 'Прямую заново' })}
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Проверить сборку**

Run: `npx jest`
Expected: PASS

- [ ] **Step 4: Коммит**

```bash
git add components/chart/ChartToolbar.js components/chart/fitModes.js components/DrawdownChart.js
git commit -m "refactor(chart): шапка графика отдельным компонентом

Кнопки масштаба и чипы прямой больше не прячутся при пустом полотне:
пустой график выглядел неуправляемым, хотя жесты работали.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Область просмотра и жесты

**Files:**
- Create: `components/chart/useChartViewport.js`

**Interfaces:**
- Consumes: `fitViewport`, `clampViewport`, `zoomViewport`, `panViewport`, `OVERSCAN` из `calc/chartViewport.js`; `pickDragTarget`, `DRAG_TARGETS`, `pixelToValue`, `findNearestPoint`, `clampAnchorToPlot`, `nearestAnchorIndex` из `calc/chartGeometry.js`.
- Produces:
  ```js
  useChartViewport({
    base, plot, viewKey, viewportStore, scrollRef, freedom,
    fitPoints, anchors, onAnchorsChange, onSelectPoint, minZoom, maxZoom,
  }) → { view, gesture, zoomBy, reset }
  ```

- [ ] **Step 1: Написать хук**

Создать `components/chart/useChartViewport.js`. Основа — строки 352–779 `components/DrawdownChart.js`.

Константы лежат выше этого диапазона и переносятся вместе с шапками: `SYNC_INTERVAL_MS` (строка 65), `TAP_RADIUS` (68), `ANCHOR_RADIUS` (87), `MIN_PINCH_SPAN` (95). `MIN_ZOOM`/`MAX_ZOOM` (61–62) остаются в `components/chart/DrawdownChart.js` и приходят сюда пропсами — они относятся к графику целиком, а не к жестам.

Обязательных изменений восемь:

**1. Одно значение вместо четырёх.**

```js
const viewport = useSharedValue(base);
const [view, setView] = useState(base);

// Область и ключ, читаемые обработчиками на JS-потоке. Ссылка, а не
// замыкание: обработчик не должен пересобираться на каждом кадре жеста
const viewRef = useRef(base);
viewRef.current = view;
const viewKeyRef = useRef(viewKey);
viewKeyRef.current = viewKey;
```

Все чтения `{x0: vx0.value, ...}` заменяются на `viewport.value`, все записи — на присваивание объекта целиком.

**2. Хвостовой коммит вместо выброшенного кадра.**

```js
const pendingRef = useRef(null);
const timerRef = useRef(null);

/**
 * Переносит область в React не чаще заданного интервала
 *
 * Отброшенный кадр не теряется, а досылается таймером: раньше последнее
 * состояние доходило до React только через `onEnd`, и любой путь мимо него —
 * отмена жеста системой, перехват прокруткой — оставлял два источника правды
 * рассогласованными
 */
const syncView = useCallback((next) => {
  pendingRef.current = next;
  const now = Date.now();
  if (now - lastSyncRef.current >= SYNC_INTERVAL_MS) {
    lastSyncRef.current = now;
    setView(next);
    return;
  }
  if (timerRef.current) return;
  timerRef.current = setTimeout(() => {
    timerRef.current = null;
    lastSyncRef.current = Date.now();
    setView(pendingRef.current);
  }, SYNC_INTERVAL_MS);
}, []);

useEffect(() => () => clearTimeout(timerRef.current), []);
```

**3. Жесты собираются один раз.**

Тонкость, на которой легко ошибиться: **обычный ref внутри worklet не годится.** Reanimated захватывает замыкание worklet-а в момент создания и копирует значения в UI-рантайм; мутации `ref.current` после этого до worklet-а не доходят. Собранный один раз жест намертво запомнил бы начальные `plot` и `base` — это хуже нынешней поломки, а не лучше.

Геометрия едет через shared value: объект в нём читается с обоих потоков, и присваивание с JS-потока доходит до UI.

```js
// Жест собирается один раз и больше не пересобирается. Раньше `pan` зависел
// от двух десятков значений, и подмена обработчика прямо во время
// распознавания рвала жест — палец «отпускало» на первом же кадре.
//
// Именно shared value, а не ref: worklet копирует захваченное замыкание в
// свой рантайм при создании, и мутации обычного ref до него не доходят
const live = useSharedValue({ base, plot, freedom, minZoom, maxZoom });
useEffect(() => {
  live.value = { base, plot, freedom, minZoom, maxZoom };
}, [live, base, plot, freedom, minZoom, maxZoom]);
```

Колбэки в shared value не кладутся — функции туда не сериализуются. Для них заводятся стабильные диспетчеры: `runOnJS` захватывает их один раз, а сами они читают ref уже на JS-потоке, где ref работает как обычно.

```js
// Колбэки меняются вместе с пропсами, а runOnJS запоминает функцию при
// сборке жеста. Диспетчер стабилен, и вызов доходит до текущего колбэка
const callbacksRef = useRef({});
callbacksRef.current = { onAnchorsChange, onSelectPoint, fitPoints, anchors };

const dispatchAnchors = useCallback((next) => {
  callbacksRef.current.onAnchorsChange?.(next);
}, []);
const dispatchSelect = useCallback((index) => {
  callbacksRef.current.onSelectPoint?.(index);
}, []);
```

`useMemo` жестов получает зависимости `[viewport, live, blockScroll, commitView, syncView, dispatchAnchors, dispatchSelect, handleTap]` — всё стабильно. Внутри worklet геометрия берётся как `live.value.plot`.

Обработчик тапа целиком идёт на JS-потоке через `runOnJS`, поэтому в нём ref читается напрямую и shared value не нужен.

**4. Композиция и пороги.**

```js
// Потащил — панорама, коснулся — выбор. Simultaneous давал оба сразу: сдвиг
// на 8–14 px и двигал полотно, и переключал отметку замера
const gesture = useMemo(
  () => Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, tap)),
  [pinch, pan, tap]
);
```

`tap` теряет `.maxDuration(400)` — в перчатке касание легко длится дольше — и получает `.maxDistance(24)` вместо 14.

**5. Тап в свободном режиме переносит ближайшую точку.**

Обработчик целиком идёт на JS-потоке (жест зовёт его через `runOnJS`), поэтому здесь читается обычный ref, а не shared value. Ссылка `handleTap` стабильна — иначе `runOnJS` запомнил бы её первую версию.

```js
const tapRef = useRef({});
tapRef.current = { freedom, plot, anchors, fitPoints, view, onAnchorsChange, onSelectPoint };

const handleTap = useCallback((touchX, touchY) => {
  const now = tapRef.current;

  // В свободном режиме тап ставит ближайшую точку под палец. Это же
  // единственный способ вернуть прямую, если точки разъехались по краям:
  // перетаскивать там уже нечего
  if (now.freedom) {
    if (now.anchors?.length !== 2) return;
    const dots = now.anchors.map((a) => ({
      cx: valueToPixelX(a.x, now.view, now.plot),
      cy: valueToPixelY(a.y, now.view, now.plot),
    }));
    const index = nearestAnchorIndex({
      px: touchX,
      py: touchY,
      ax0: dots[0].cx, ay0: dots[0].cy,
      ax1: dots[1].cx, ay1: dots[1].cy,
    });
    const spot = clampAnchorToPlot({ px: touchX, py: touchY, plot: now.plot });
    const next = now.anchors.slice();
    next[index] = pixelToValue({
      px: spot.px, py: spot.py, view: now.view, plot: now.plot,
    });
    now.onAnchorsChange?.(next);
    return;
  }

  if (!now.fitPoints?.length) return;
  const nearest = findNearestPoint({
    points: now.fitPoints,
    touchX,
    touchY,
    view: now.view,
    plot: now.plot,
    radius: TAP_RADIUS,
  });
  if (nearest) now.onSelectPoint?.(nearest.index);
}, []);
```

**6. Свободная точка зажимается полотном.** В `moveAnchor` и в ветке перетаскивания точки координаты пропускаются через `clampAnchorToPlot` до перевода в значения.

**7. Зум и сдвиг идут через `zoomViewport`/`panViewport`** — то есть с ограничением положения.

**7a. Полосы осей получают запас захвата.** Полоса под графиком высотой 38 px, левая шириной 46 px — попасть в них пальцем, не задев данные, непросто. `pickDragTarget` вызывается с областью, расширенной внутрь полотна на 12 px:

```js
// Запас внутрь полотна: полоса оси узкая, и попадание по ней краем пальца
// иначе достаётся панораме, а геолог думает, что жест не работает
const AXIS_GRAB = 12;

const picked = pickDragTarget({
  startX: event.x - event.translationX,
  startY: event.y - event.translationY,
  ax0: a0x.value, ay0: a0y.value, ax1: a1x.value, ay1: a1y.value,
  freedom: live.value.freedom,
  plot: {
    x: live.value.plot.x + AXIS_GRAB,
    y: live.value.plot.y,
    h: live.value.plot.h - AXIS_GRAB,
  },
  radius: ANCHOR_RADIUS,
});
```

**8. Хранилище областей.** Вместо эффекта с `appliedKeyRef`:

```js
// Масштаб, поставленный руками, помнится по ключу системы координат: ушли на
// другую ось, фазу или скважину и вернулись — окно то же. Хранилище живёт в
// экране, а не здесь: развёрнутый и обычный график — два разных монтирования
// компонента, и ref внутри их бы не пережил
useEffect(() => {
  const stored = viewportStore?.get(viewKey);
  const next = stored ?? base;
  viewport.value = next;
  setView(next);
}, [viewKey, base, viewport, viewportStore]);

const commitView = useCallback((next) => {
  lastSyncRef.current = 0;
  viewportStore?.set(viewKeyRef.current, next);
  setView(next);
}, [viewportStore]);
```

- [ ] **Step 2: Проверить сборку**

Run: `npx jest`
Expected: PASS

- [ ] **Step 3: Коммит**

```bash
git add components/chart/useChartViewport.js
git commit -m "feat(chart): область и жесты, которые не срываются

Жесты собираются один раз и читают изменяемые входы из ref: подмена
обработчика посреди распознавания больше невозможна. Область — одно
значение с хвостовым коммитом и хранилищем по ключу координат, поэтому
масштаб переживает и жест, и смену оси, и разворот на весь экран.
Тап в свободном режиме ставит ближайшую точку под палец.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Сборка графика и тесты отрисовки

**Files:**
- Create: `components/chart/DrawdownChart.js`
- Modify: `components/DrawdownChart.js` — заменить содержимое реэкспортом
- Create: `components/__tests__/DrawdownChart.test.js`

**Interfaces:**
- Consumes: всё из задач 1–7.
- Produces: `DrawdownChart` по умолчанию, `FIT_MODES` именованным. Новые пропсы: `series` (модель из `calc/chartSeries.js`), `fitSeriesId`, `viewportStore`. Старые `measurements`/`extraSeries` продолжают приниматься и внутри приводятся к `series`.

- [ ] **Step 1: Написать тесты отрисовки**

Создать `components/__tests__/DrawdownChart.test.js`:

```js
/**
 * Проверка отрисовки графика
 *
 * Жесты отсюда не проверить — RNGH под react-test-renderer событий не
 * порождает. Зато проверяется всё остальное: что нарисовано, сколько кривых
 * на полотне и не прячет ли пустое состояние управление.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import DrawdownChart, { FIT_MODES } from '../DrawdownChart';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

// Локаль в тестах определяется системой и приезжает английской: пробный
// прогон показал, что I18n.t('reset') отдаёт «Reset», а не «Сброс».
// Проверять подписи, не закрепив локаль, значит проверять окружение
beforeAll(() => {
  I18n.locale = 'ru';
});

const render = (props) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <DrawdownChart width={340} {...props} />
      </PaperProvider>
    );
  });
  return JSON.stringify(tree.toJSON());
};

const pumping = [
  { t: 1, s: 1 },
  { t: 10, s: 2 },
  { t: 100, s: 3 },
];

const count = (json, node) => (json.match(new RegExp(`"${node}"`, 'g')) ?? []).length;

test('замеры превращаются в точки на полотне', () => {
  const json = render({ measurements: pumping });
  expect(count(json, 'RNSVGCircle')).toBe(3);
});

test('пустое полотно не прячет управление масштабом', () => {
  // Ровно этим одиночная откачка выглядела полностью неуправляемой: при
  // пустом ряде не отрисовывалось ни одной кнопки
  const json = render({ measurements: [] });
  expect(json).toContain('Сброс');
  expect(json).toContain('Отдалить');
  expect(json).toContain('Приблизить');
});

test('пустое полотно не прячет выбор способа прямой', () => {
  const json = render({ measurements: [] });
  expect(json).toContain('Свободная прямая');
});

test('пустое полотно объясняет, чего не хватает', () => {
  const json = render({
    measurements: [],
    emptyTitle: 'Нужны расстояния',
    emptyHint: 'Введите расстояния до скважин',
  });
  expect(json).toContain('Нужны расстояния');
});

test('две серии дают две ломаные', () => {
  const json = render({
    measurements: pumping,
    extraSeries: [{ id: 'w2', name: '2p', measurements: [{ t: 1, s: 5 }, { t: 10, s: 6 }] }],
  });
  // Ломаные плюс путь прямой
  expect(count(json, 'RNSVGPath')).toBeGreaterThanOrEqual(3);
});

test('свободный режим рисует свободные точки', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [{ x: 0.5, y: 1 }, { x: 2, y: 3 }],
  });
  // Три замера плюс по два кружка на свободную точку
  expect(count(json, 'RNSVGCircle')).toBe(7);
});

test('вырожденная свободная прямая не рисуется, но объясняется', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [{ x: 1, y: 1 }, { x: 1, y: 3 }],
  });
  expect(json).toContain('вертикал');
});
```

- [ ] **Step 2: Прогнать и убедиться, что тесты падают**

Run: `npx jest components/__tests__/DrawdownChart.test.js`
Expected: FAIL — часть тестов падает на прежнем компоненте (пустое состояние прячет кнопки, подсказки про вертикаль нет)

- [ ] **Step 3: Собрать новый компонент**

Создать `components/chart/DrawdownChart.js`. Состав по порядку:

1. **Пропсы и `plot`** — строки 155–259 прежнего файла дословно, плюс новые `series`, `fitSeriesId`, `viewportStore`.
2. **Приведение входа к сериям.** Если `series` не передан, он собирается из `measurements` и `extraSeries` — так экран продолжает работать без правок до задачи 10:

```js
const chartSeries = useMemo(() => {
  if (series) return buildSeries({ raw: series, mode });
  return buildSeries({
    raw: [
      { id: 'main', name: activeSeriesName, role: SERIES_ROLES.FIT, measurements },
      ...extraSeries.map((one) => ({
        id: one.id,
        name: one.name,
        role: SERIES_ROLES.REFERENCE,
        measurements: one.measurements ?? [],
      })),
    ],
    mode,
  });
}, [series, measurements, extraSeries, activeSeriesName, mode]);
```

3. **Базовая область** — `const base = useMemo(() => fitViewport(chartSeries), [chartSeries]);`
4. **Точки подбора и прямая.** Отметка точек и прямая идут по сериям роли `FIT` — на комбинированном прослеживании их несколько, и прямая ведётся по всем сразу:

```js
// Точки, по которым ведётся прямая и работает отметка. Соседние кривые сюда
// не входят: прямая строится по открытой в журнале скважине
const fitPoints = useMemo(
  () => chartSeries.filter((s) => s.role === SERIES_ROLES.FIT).flatMap((s) => s.points),
  [chartSeries]
);
```

`autoLine` — строки 288–295 прежнего файла, но по `fitPoints` вместо `dataPoints`; в свободном режиме `freeLine(anchors)`.
5. **Область и жесты** — `useChartViewport({ base, plot, viewKey, viewportStore, scrollRef, freedom, fitPoints, anchors, onAnchorsChange, onSelectPoint: onToggleSelect, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM })`.
6. **Сцена** — `useMemo(() => buildScene({ series: chartSeries, view, base, plot, mode, fit, anchors }), [...])`.
7. **Эффект `onFitChange`** — строки 941–948 дословно.
8. **Эффект первичной постановки свободных точек** — строки 952–964 дословно, но зависимость от `view` заменяется на `base`: сейчас эффект пересчитывается на каждом кадре жеста, потому что видимая область в его списке зависимостей.
9. **Эскиз пустого состояния** — строки 991–1014 дословно.
10. **Разметка:**

```jsx
return (
  <View>
    <ChartToolbar
      caption={caption ?? defaultCaption}
      fitMode={fitMode}
      onFitModeChange={onFitModeChange}
      onZoomIn={() => zoomBy(1.6)}
      onZoomOut={() => zoomBy(1 / 1.6)}
      onReset={reset}
      onResetLine={resetLine}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
      colors={c}
    />
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.canvas, { backgroundColor: c.plotBg, borderColor: c.border }]}
        {...(Platform.OS === 'web' ? {} : { collapsable: false })}
      >
        <ChartCanvas
          scene={scene}
          plot={plot}
          width={width}
          height={chartHeight}
          colors={c}
          selected={selected}
          ghost={scene.hasData ? null : ghost}
        />
        {/* карточка пустого состояния — строки 1346–1366 прежнего файла */}
      </View>
    </GestureDetector>
    {/* легенда — строки 1376–1406; подписи осей — 1412–1424;
        подсказки — 1428–1448 */}
  </View>
);
```

11. **`resetLine`** — новая: ставит свободные точки заново на прямую по всем замерам, чтобы уехавшую прямую можно было вернуть кнопкой:

```js
/**
 * Возвращает свободную прямую на место
 *
 * Точки зажаты полотном и уехать за него больше не могут, но развести их по
 * углам всё ещё легко, и прямая тогда идёт не там, где нужно. Кнопка ставит
 * их обратно на прямую по всем замерам — туда же, куда они встают при первом
 * включении свободного режима
 */
const resetLine = useCallback(() => {
  onAnchorsChange?.(
    anchorsOnLine({
      slope: autoLine.slope,
      intercept: autoLine.intercept,
      x0: view.x0,
      x1: view.x1,
      y0: view.y0,
      y1: view.y1,
    })
  );
}, [autoLine, view, onAnchorsChange]);
```

Добавить подсказку о вырожденной прямой рядом с существующей подсказкой свободного режима (строки 1439–1448):

```jsx
{freedom && !freeLineReady && (
  <View style={[styles.hint, { backgroundColor: c.primaryWash, borderColor: c.wineBorder }]}>
    <Text style={[styles.hintText, { color: c.primaryAccent }]}>
      {I18n.t('freedomDegenerate', {
        defaultValue:
          'Точки встали на одну вертикаль — такая прямая наклона не имеет. Разведите их по времени.',
      })}
    </Text>
  </View>
)}
```

Заменить содержимое `components/DrawdownChart.js` на:

```js
/**
 * График понижения — точка входа
 *
 * Сам график собран в `components/chart/`. Здесь остаётся реэкспорт: экран
 * обработки импортирует его отсюда, и путь менять незачем.
 */

export { default, FIT_MODES } from './chart/DrawdownChart';
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx jest components/__tests__/DrawdownChart.test.js`
Expected: PASS

- [ ] **Step 5: Прогнать весь набор**

Run: `npx jest`
Expected: PASS

- [ ] **Step 6: Коммит**

```bash
git add components/chart/DrawdownChart.js components/DrawdownChart.js components/__tests__/DrawdownChart.test.js
git commit -m "refactor(chart): график собран из проверяемых частей

1591 строка становится композицией: шапка, полотно, область с жестами
и чистые модули расчёта. Отрисовка теперь под тестами — включая то, что
пустое полотно не прячет управление.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Серии экрана и кривая восстановления

**Files:**
- Create: `screens/PumpingTestProcessing/useChartSeries.js`
- Create: `screens/PumpingTestProcessing/__tests__/useChartSeries.test.js`

**Interfaces:**
- Consumes: `residualDrawdown`, `SERIES_ROLES` из `calc/chartSeries.js`; `TRACKING_KINDS` из `calc/tracking.js`; `X_MODES`, `transformTime` из `calc/cooperJacob.js`.
- Produces:
  - `FIT_SERIES = { PUMPING: 'pumping', RECOVERY: 'recovery' }`
  - `chartRawSeries({ trackingKind, measurements, recoveryMeasurements, finalDrawdown, pumpingDuration, wellsWithDistance, wellMeasurements, moment, isRecovery, fitSeries, activeWellName }) → Array<rawSeries>` — чистая функция, тестируется отдельно от React
  - `recoveryAbscissa({ measurements, pumpingDuration }) → Array<{t, s}>` — точки Тейса: `t` уже есть отношение `t/t′`

- [ ] **Step 1: Написать падающие тесты**

Создать `screens/PumpingTestProcessing/__tests__/useChartSeries.test.js`:

```js
/**
 * Проверка сборки серий для экрана обработки
 *
 * Главное здесь — фаза восстановления: журнал заполнялся, сохранялся и
 * проверялся на полноту, но до графика не доходил никогда.
 */

import { chartRawSeries, FIT_SERIES } from '../useChartSeries';
import { TRACKING_KINDS } from '../../../calc/tracking';
import { SERIES_ROLES } from '../../../calc/chartSeries';

const base = {
  trackingKind: TRACKING_KINDS.TIME,
  measurements: [{ t: 1, s: 1 }, { t: 10, s: 3 }, { t: 100, s: 5 }],
  recoveryMeasurements: [{ t: 1, s: 0.5 }, { t: 10, s: 3 }, { t: 100, s: 4.8 }],
  finalDrawdown: 5,
  pumpingDuration: 100,
  wellsWithDistance: [],
  wellMeasurements: {},
  moment: NaN,
  isRecovery: false,
  fitSeries: FIT_SERIES.PUMPING,
  activeWellName: 'Скважина',
};

test('на откачке кривая одна', () => {
  const series = chartRawSeries(base);
  expect(series).toHaveLength(1);
  expect(series[0].role).toBe(SERIES_ROLES.FIT);
});

test('на восстановлении кривых две', () => {
  // Это и есть недостающий график: журнал восстановления до полотна не доходил
  const series = chartRawSeries({ ...base, isRecovery: true });
  expect(series).toHaveLength(2);
  expect(series.map((s) => s.id)).toEqual(['pumping', 'recovery']);
});

test('кривая восстановления идёт остаточным понижением', () => {
  const series = chartRawSeries({ ...base, isRecovery: true });
  const recovery = series.find((s) => s.id === 'recovery');
  expect(recovery.measurements.map((m) => m.s)).toEqual([4.5, 2, expect.closeTo(0.2, 10)]);
});

test('прямая по умолчанию идёт по откачке', () => {
  const series = chartRawSeries({ ...base, isRecovery: true });
  expect(series.find((s) => s.id === 'pumping').role).toBe(SERIES_ROLES.FIT);
  expect(series.find((s) => s.id === 'recovery').role).toBe(SERIES_ROLES.REFERENCE);
});

test('выбор восстановления переводит график в координаты Тейса', () => {
  // Остаточное понижение спрямляется только по lg(t/t′), и только там
  // T = 0.183·Q/a верна: обе кривые на одной оси тут совместить нельзя
  const series = chartRawSeries({
    ...base,
    isRecovery: true,
    fitSeries: FIT_SERIES.RECOVERY,
  });
  expect(series).toHaveLength(1);
  expect(series[0].id).toBe('recovery');
  expect(series[0].role).toBe(SERIES_ROLES.FIT);
  // t/t′ для замера через 1 минуту после остановки при откачке 100 минут
  expect(series[0].measurements[0].t).toBeCloseTo(101, 10);
});

test('без понижения на остановке кривой восстановления нет', () => {
  const series = chartRawSeries({ ...base, isRecovery: true, finalDrawdown: 0 });
  expect(series.map((s) => s.id)).toEqual(['pumping']);
});

test('на откачке журнал восстановления игнорируется', () => {
  const series = chartRawSeries(base);
  expect(series.map((s) => s.id)).toEqual(['pumping']);
});
```

- [ ] **Step 2: Прогнать и убедиться, что тесты падают**

Run: `npx jest screens/PumpingTestProcessing/__tests__/useChartSeries.test.js`
Expected: FAIL — `Cannot find module '../useChartSeries'`

- [ ] **Step 3: Написать модуль**

Создать `screens/PumpingTestProcessing/useChartSeries.js`. Сюда переезжает сборка точек из `DataProcessingScreen.js` (строки 728–779, `basePoints`) плюс новое: кривая восстановления и выбор серии для прямой.

```js
/**
 * Серии графика на экране обработки
 *
 * Экран знает то, чего не знает график: вид прослеживания, фазу опыта,
 * расстояния до скважин и момент площадного среза. Здесь всё это сводится к
 * списку кривых, а график получает уже готовые ряды.
 *
 * Все величины базовые — минуты и метры. Перевод в выбранные пользователем
 * размерности стоит на границе экрана.
 */

import { residualDrawdown, SERIES_ROLES } from '../../calc/chartSeries';
import { TRACKING_KINDS } from '../../calc/tracking';

/** По какой кривой ведётся прямая и считается водопроводимость */
export const FIT_SERIES = { PUMPING: 'pumping', RECOVERY: 'recovery' };

/** Пустой ряд: общая ссылка, чтобы пересчёты не срабатывали вхолостую */
const NO_ROWS = [];

/**
 * Переводит журнал восстановления в координаты прямой Тейса
 *
 * По оси абсцисс отношение t/t′ — время от начала откачки к времени от её
 * остановки. Журнал ведётся от остановки, поэтому время от начала — это
 * длительность откачки плюс запись журнала.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - журнал
 *   восстановления: t от остановки насоса
 * @param {number} params.pumpingDuration - сколько длилась откачка, мин
 * @returns {Array<{t: number, s: number}>} точки с отношением в абсциссе
 */
export function recoveryAbscissa({ measurements, pumpingDuration }) {
  if (!(pumpingDuration > 0)) return [];
  return (measurements ?? [])
    .map((m) => ({ t: (pumpingDuration + m.t) / m.t, s: m.s }))
    // Отношение равно единице при бесконечном времени и меньше единицы не
    // бывает: всё прочее — замер, введённый до остановки насоса
    .filter((p) => isFinite(p.t) && p.t > 1 && isFinite(p.s));
}

/**
 * Собирает описания кривых для графика
 *
 * @param {Object} params
 * @param {string} params.trackingKind - вид прослеживания, см. TRACKING_KINDS
 * @param {Array<{t: number, s: number}>} params.measurements - журнал откачки
 * @param {Array<{t: number, s: number}>} params.recoveryMeasurements - журнал
 *   восстановления: t от остановки насоса, s — подъём уровня
 * @param {number} params.finalDrawdown - понижение на момент остановки
 * @param {number} params.pumpingDuration - сколько длилась откачка, мин
 * @param {Array<{id: string, name: string, distance: number}>} params.wellsWithDistance
 * @param {Object} params.wellMeasurements - журналы куста по скважинам
 * @param {number} params.moment - момент площадного среза, мин
 * @param {boolean} params.isRecovery - открыта ли фаза восстановления
 * @param {string} params.fitSeries - по какой кривой прямая, см. FIT_SERIES
 * @param {string} params.activeWellName - имя открытой скважины
 * @param {Function} params.sameMoment - сравнение времени с моментом среза
 * @returns {Array<Object>} описания серий для calc/chartSeries.js
 */
export function chartRawSeries({
  trackingKind,
  measurements,
  recoveryMeasurements,
  finalDrawdown,
  pumpingDuration,
  wellsWithDistance,
  wellMeasurements,
  moment,
  isRecovery,
  fitSeries,
  activeWellName,
  sameMoment = (a, b) => a === b,
}) {
  // Площадное прослеживание — срез по кусту на один момент: годятся только
  // совпадающие замеры, интерполировать понижение между отсчётами значило бы
  // ставить на график то, чего в журнале нет
  if (trackingKind === TRACKING_KINDS.AREA) {
    if (!(moment > 0)) return [];
    const points = wellsWithDistance
      .map((well) => {
        const hit = (wellMeasurements[well.id] ?? NO_ROWS).find((m) =>
          sameMoment(m.t, moment)
        );
        return hit ? { t: well.distance, s: hit.s } : null;
      })
      .filter(Boolean)
      // По возрастанию расстояния: ломаная по таким точкам и есть профиль
      // депрессионной воронки
      .sort((a, b) => a.t - b.t);

    return points.length
      ? [{ id: 'pumping', name: activeWellName, role: SERIES_ROLES.FIT, measurements: points }]
      : [];
  }

  if (trackingKind === TRACKING_KINDS.COMBINED) {
    const points = wellsWithDistance.flatMap((well) =>
      (wellMeasurements[well.id] ?? NO_ROWS).map((m) => ({
        t: m.t / (well.distance * well.distance),
        s: m.s,
        group: well.id,
        groupName: well.name,
      }))
    );
    return points.length
      ? [{ id: 'pumping', name: activeWellName, role: SERIES_ROLES.FIT, measurements: points }]
      : [];
  }

  const pumping = {
    id: 'pumping',
    name: activeWellName,
    role: SERIES_ROLES.FIT,
    measurements,
  };

  if (!isRecovery) return [pumping];

  // Прямая Тейса: остаточное понижение спрямляется только по lg(t/t′), и
  // только там T = 0.183·Q/a верна. Кривую откачки в этих координатах не
  // построить — у её замеров нет времени от остановки насоса
  if (fitSeries === FIT_SERIES.RECOVERY) {
    const residual = residualDrawdown({
      measurements: recoveryMeasurements,
      finalDrawdown,
    });
    const points = recoveryAbscissa({
      measurements: residual,
      pumpingDuration,
    });
    return points.length
      ? [{ id: 'recovery', name: activeWellName, role: SERIES_ROLES.FIT, measurements: points }]
      : [];
  }

  const residual = residualDrawdown({
    measurements: recoveryMeasurements,
    finalDrawdown,
  });

  // Без понижения на остановке остаток не с чем считать: остаётся одна
  // кривая, а экран объясняет, какого поля не хватает
  if (!residual.length) return [pumping];

  return [
    pumping,
    {
      id: 'recovery',
      name: activeWellName,
      role: SERIES_ROLES.REFERENCE,
      measurements: residual,
    },
  ];
}
```

Обратить внимание: `recoveryAbscissa` получает уже пересчитанный в остаточное понижение ряд, поэтому ордината прямой Тейса — остаток, а не подъём уровня. Именно остаток обращается в ноль при `t/t′ → 1`, и именно поэтому прямая обязана проходить через начало координат.

- [ ] **Step 4: Прогнать тесты**

Run: `npx jest screens/PumpingTestProcessing/__tests__/useChartSeries.test.js`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add screens/PumpingTestProcessing/useChartSeries.js screens/PumpingTestProcessing/__tests__/useChartSeries.test.js
git commit -m "feat(chart): кривая восстановления на общей плоскости с откачкой

Журнал восстановления заполнялся и сохранялся, но до графика не доходил
никогда. Теперь в фазе восстановления на полотне две кривые, а чип
выбора переводит расчёт на прямую Тейса.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Экран обработки

**Files:**
- Modify: `screens/PumpingTestProcessing/DataProcessingScreen.js`

**Interfaces:**
- Consumes: `chartRawSeries`, `FIT_SERIES`, `recoveryAbscissa` из `./useChartSeries`; `buildSeries` из `calc/chartSeries.js`; `freeLine` из `calc/chartGeometry.js`.
- Produces: экран целиком; интерфейс не экспортируется.

- [ ] **Step 1: Заменить сборку точек**

Удалить `basePoints` (строки 728–779) и вызвать `chartRawSeries`. `chartMeasurements` (865–874) строится из полученных серий с переводом в выбранные размерности.

Сравнение времени со срезом передаётся явно — тем же округлением, с каким замер лёг в базу. Иначе полчаса, введённые как «0.5 ч» и как «30 мин», разойдутся в последнем разряде и попадут в разные моменты:

```js
const rawSeries = useMemo(
  () =>
    chartRawSeries({
      trackingKind,
      measurements,
      recoveryMeasurements,
      finalDrawdown,
      pumpingDuration,
      wellsWithDistance,
      wellMeasurements,
      moment,
      isRecovery: isRecovery && dualJournals,
      fitSeries,
      activeWellName: activeWell?.name,
      sameMoment: (t, at) => roundBase(t) === at,
    }),
  [
    trackingKind, measurements, recoveryMeasurements, finalDrawdown,
    pumpingDuration, wellsWithDistance, wellMeasurements, moment,
    isRecovery, dualJournals, fitSeries, activeWell,
  ]
);
```

Завести состояние выбора кривой рядом с `fitMode` (строка 641):

```js
const [fitSeries, setFitSeries] = useState(FIT_SERIES.PUMPING);
```

- [ ] **Step 2: Завести хранилище областей**

```js
// Масштаб помнится по ключу системы координат и переживает разворот графика
// на весь экран: развёрнутый и обычный — две разные ветки рендера, то есть
// два разных монтирования компонента
const viewportStore = useRef(new Map()).current;
```

Передать `viewportStore={viewportStore}` в оба вызова `DrawdownChart` (строки 1784 и 2611).

- [ ] **Step 3: Добавить чип выбора кривой**

Рядом с чипами осей (строки 2505–2543), виден только при `isRecovery && dualJournals && recoveryMeasurements.length > 0`:

```jsx
{isRecovery && dualJournals && recoveryMeasurements.length > 0 && (
  <View style={styles.modeRow}>
    {[
      { key: FIT_SERIES.PUMPING, label: I18n.t('fitByPumping', { defaultValue: 'Прямая по откачке' }) },
      { key: FIT_SERIES.RECOVERY, label: I18n.t('fitByRecovery', { defaultValue: 'Прямая по восстановлению' }) },
    ].map((option) => (/* чип по образцу строк 2514–2541 */))}
  </View>
)}
```

При `fitSeries === FIT_SERIES.RECOVERY` подпись оси становится `t/t′`, заголовок графика — «График восстановления», а расчёт идёт через `processRecovery` из `calc/recovery.js` с журналом восстановления и `pumpingDuration`.

- [ ] **Step 4: Убрать молчаливый откат на МНК**

В `manualLine` (строки 804–822) ветка свободного режима использует `freeLine`:

```js
if (fitMode === FIT_MODES.FREEDOM) {
  const line = freeLine(freeAnchors);
  // Вырожденную прямую не подменяем регрессией: раньше прямая пропадала
  // с полотна, а T в карточке молча менялось на другое число
  return line.ready ? line : { slope: NaN, intercept: NaN };
}
```

И добавить в `missingT` (строки 1156–1212) первым условием:

```js
if (fitMode === FIT_MODES.FREEDOM && !freeLine(freeAnchors).ready) {
  return I18n.t('freedomDegenerate', {
    defaultValue:
      'Точки встали на одну вертикаль — такая прямая наклона не имеет. Разведите их по времени.',
  });
}
```

- [ ] **Step 5: Починить подстановку в handlePhaseChange**

Строки 1671–1680 кладут в поля базовые единицы (минуты, метры), а поля показывают выбранные пользователем размерности — при настройке «часы» подставлялось число в минутах. Обернуть в перевод:

```js
const show = (value, quantity) => {
  const converted = fromBase(value, quantity);
  return isFinite(converted) ? String(Number(converted.toPrecision(SHOWN_PRECISION))) : '';
};
if (isFinite(last.t) && last.t > 0) setDurationText(show(last.t, QUANTITIES.TIME));
if (isFinite(last.s) && last.s > 0) setFinalDrawdownText(show(last.s, QUANTITIES.DRAWDOWN));
```

- [ ] **Step 6: Убрать устаревшие комментарии**

Удалить строки 2431–2433 («Замеры восстановления на график не идут») — утверждение перестало быть верным.

- [ ] **Step 7: Прогнать весь набор**

Run: `npx jest`
Expected: PASS, все тесты зелёные

- [ ] **Step 8: Коммит**

```bash
git add screens/PumpingTestProcessing/DataProcessingScreen.js
git commit -m "feat(chart): экран обработки показывает восстановление

Плюс хранилище масштабов, чип выбора кривой для прямой и починка
подстановки длительности откачки: в поля клались минуты и метры, а
показаны они в выбранных размерностях.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Проверка на устройстве

Автоматически не проверяется и остаётся за заказчиком. Проверять на **одиночной** и на **кустовой** откачке по очереди:

1. Щипок двумя пальцами по диагонали — масштаб меняется по обеим осям.
2. Щипок вдоль оси X — растягивается только время.
3. Перетаскивание полосы под графиком — растягивается только время; полосы слева — только понижение.
4. Отпустить и коснуться снова — **масштаб на месте, а не сброшен**.
5. Увести полотно пальцем как можно дальше — данные остаются видны.
6. Переключить ось `lg t` → `t` → обратно — масштаб на `lg t` тот же, что был.
7. Развернуть график на весь экран и свернуть — масштаб тот же.
8. Тап по замеру — отмечается; медленный тап в перчатке — тоже отмечается.
9. Медленный сдвиг пальцем — полотно едет, отметка **не** переключается.
10. Свободная прямая: тащить точку за край — она остаётся на полотне.
11. Свободная прямая: тап по полотну — ближайшая точка встаёт под палец.
12. Свободная прямая: свести точки на одну вертикаль — появляется подсказка, T показывает прочерк.
13. Фаза «Восстановление» на одиночной и кустовой — на полотне две кривые.
14. Чип «Прямая по восстановлению» — ось становится `t/t′`, T пересчитывается.
15. Пустой журнал — кнопки масштаба и «Сброс» на месте, полотно не выглядит сломанным.

Если пункты 1–3 не работают именно на одиночной откачке — гипотеза из спецификации неверна, и причину надо искать на устройстве: снять логи и проверить, доходит ли до `GestureDetector` хоть одно касание.
