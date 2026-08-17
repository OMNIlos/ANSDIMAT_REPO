/**
 * Проверка видимой области графика
 *
 * Главное свойство здесь одно: как бы геолог ни тянул и ни щипал полотно,
 * данные обязаны остаться в поле зрения. Ровно этого раньше не было — сдвиг
 * не был ограничен ничем, и ряд замеров уводился за край насовсем.
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

/** Длина пересечения двух отрезков */
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

  test('серия без точек не роняет подгонку', () => {
    const view = fitViewport([{ points: [] }, { points: [{ x: 1, y: 2 }] }]);
    expect(isFinite(view.x0)).toBe(true);
    expect(view.y1).toBeGreaterThanOrEqual(2);
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
    expect(overlap(fixed.x0, fixed.x1, BASE.x0, BASE.x1)).toBeGreaterThanOrEqual(
      need - 1e-9
    );
  });

  test('вырожденное окно заменяется базовым', () => {
    expect(clampViewport({ x0: 2, x1: 2, y0: 0, y1: 25 }, { base: BASE })).toEqual(BASE);
    expect(clampViewport({ x0: NaN, x1: 4, y0: 0, y1: 25 }, { base: BASE })).toEqual(BASE);
  });
});

describe('panViewport', () => {
  test('обычный сдвиг работает как прежде', () => {
    const moved = panViewport({
      view: BASE,
      dx: -PLOT.w / 2,
      dy: 0,
      plot: PLOT,
      base: BASE,
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
      view: BASE,
      scale: 2,
      focusX: 0.5,
      focusY: 0.5,
      base: BASE,
      minZoom: 0.5,
      maxZoom: 50,
    });
    expect(zoomed.x1 - zoomed.x0).toBeCloseTo(2, 8);
  });

  test('зум у самого края не выбрасывает данные', () => {
    let view = BASE;
    for (let i = 0; i < 30; i += 1) {
      view = zoomViewport({
        view,
        scale: 1.6,
        focusX: 1,
        focusY: 0,
        base: BASE,
        minZoom: 0.5,
        maxZoom: 50,
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
