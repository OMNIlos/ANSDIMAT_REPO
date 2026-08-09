/**
 * Проверка геометрии графика
 *
 * Здесь проверяется то, что пользователь ощущает руками: остаётся ли точка
 * под пальцами на месте при щипке, не уезжают ли оси, попадает ли тап
 * по нужному замеру.
 */

import {
  valueToPixelX,
  valueToPixelY,
  zoomView,
  panView,
  findNearestPoint,
  toggleSelection,
} from '../chartGeometry';

const PLOT = { x: 46, y: 14, w: 280, h: 178 };
const VIEW = { x0: 0, x1: 4, y0: 0, y1: 25 };
const BASE_RANGE = { x: 4, y: 25 };

describe('перевод в пиксели', () => {
  test('края области ложатся на границы графика', () => {
    expect(valueToPixelX(VIEW.x0, VIEW, PLOT)).toBeCloseTo(PLOT.x, 10);
    expect(valueToPixelX(VIEW.x1, VIEW, PLOT)).toBeCloseTo(PLOT.x + PLOT.w, 10);
    expect(valueToPixelY(VIEW.y0, VIEW, PLOT)).toBeCloseTo(PLOT.y, 10);
    expect(valueToPixelY(VIEW.y1, VIEW, PLOT)).toBeCloseTo(PLOT.y + PLOT.h, 10);
  });

  test('понижение растёт вниз по экрану', () => {
    const shallow = valueToPixelY(5, VIEW, PLOT);
    const deep = valueToPixelY(20, VIEW, PLOT);
    expect(deep).toBeGreaterThan(shallow);
  });

  test('вырожденная область не даёт NaN', () => {
    const flat = { x0: 1, x1: 1, y0: 0, y1: 0 };
    expect(Number.isNaN(valueToPixelX(1, flat, PLOT))).toBe(false);
    expect(Number.isNaN(valueToPixelY(0, flat, PLOT))).toBe(false);
  });
});

describe('zoomView', () => {
  test('значение под фокусом остаётся на том же месте экрана', () => {
    const focusX = 0.3;
    const focusY = 0.7;
    const anchorX = VIEW.x0 + focusX * (VIEW.x1 - VIEW.x0);
    const anchorY = VIEW.y0 + focusY * (VIEW.y1 - VIEW.y0);

    const pixelBeforeX = valueToPixelX(anchorX, VIEW, PLOT);
    const pixelBeforeY = valueToPixelY(anchorY, VIEW, PLOT);

    const zoomed = zoomView({
      view: VIEW,
      scale: 2.5,
      focusX,
      focusY,
      baseRange: BASE_RANGE,
      minZoom: 0.5,
      maxZoom: 50,
    });

    expect(valueToPixelX(anchorX, zoomed, PLOT)).toBeCloseTo(pixelBeforeX, 8);
    expect(valueToPixelY(anchorY, zoomed, PLOT)).toBeCloseTo(pixelBeforeY, 8);
  });

  test('приближение сужает диапазон, отдаление расширяет', () => {
    const inZoom = zoomView({
      view: VIEW, scale: 2, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });
    const outZoom = zoomView({
      view: VIEW, scale: 0.5, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });

    expect(inZoom.x1 - inZoom.x0).toBeCloseTo(2, 10);
    expect(outZoom.x1 - outZoom.x0).toBeCloseTo(8, 10);
  });

  test('масштаб не выходит за пределы', () => {
    let view = VIEW;
    // Многократное приближение упирается в предел, а не уходит в бесконечность
    for (let i = 0; i < 40; i++) {
      view = zoomView({
        view, scale: 2, focusX: 0.5, focusY: 0.5,
        baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
      });
    }
    expect(view.x1 - view.x0).toBeCloseTo(BASE_RANGE.x / 50, 10);

    for (let i = 0; i < 40; i++) {
      view = zoomView({
        view, scale: 0.5, focusX: 0.5, focusY: 0.5,
        baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
      });
    }
    expect(view.x1 - view.x0).toBeCloseTo(BASE_RANGE.x / 0.5, 10);
  });

  test('пропорции осей сохраняются: обе меняются одинаково', () => {
    const zoomed = zoomView({
      view: VIEW, scale: 3, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });

    const ratioX = (zoomed.x1 - zoomed.x0) / (VIEW.x1 - VIEW.x0);
    const ratioY = (zoomed.y1 - zoomed.y0) / (VIEW.y1 - VIEW.y0);
    expect(ratioX).toBeCloseTo(ratioY, 10);
  });

  test('некорректный масштаб не ломает область', () => {
    expect(zoomView({
      view: VIEW, scale: 0, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    })).toEqual(VIEW);

    expect(zoomView({
      view: VIEW, scale: NaN, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    })).toEqual(VIEW);
  });
});

describe('panView', () => {
  test('сдвиг вправо показывает более ранние значения', () => {
    const moved = panView({ view: VIEW, dx: 28, dy: 0, plot: PLOT });
    // Палец вправо — содержимое едет вправо, окно смещается влево
    expect(moved.x0).toBeLessThan(VIEW.x0);
    expect(moved.x1 - moved.x0).toBeCloseTo(VIEW.x1 - VIEW.x0, 10);
  });

  test('масштаб окна при сдвиге не меняется', () => {
    const moved = panView({ view: VIEW, dx: 15, dy: -20, plot: PLOT });
    expect(moved.x1 - moved.x0).toBeCloseTo(VIEW.x1 - VIEW.x0, 10);
    expect(moved.y1 - moved.y0).toBeCloseTo(VIEW.y1 - VIEW.y0, 10);
  });

  test('сдвиг на всю ширину смещает окно ровно на диапазон', () => {
    const moved = panView({ view: VIEW, dx: -PLOT.w, dy: 0, plot: PLOT });
    expect(moved.x0).toBeCloseTo(VIEW.x0 + (VIEW.x1 - VIEW.x0), 10);
  });
});

describe('findNearestPoint', () => {
  const points = [
    { index: 0, x: 0, y: 10 },
    { index: 1, x: 2, y: 15 },
    { index: 2, x: 4, y: 25 },
  ];

  test('находит точку под пальцем', () => {
    const target = points[1];
    const px = valueToPixelX(target.x, VIEW, PLOT);
    const py = valueToPixelY(target.y, VIEW, PLOT);

    const found = findNearestPoint({ points, touchX: px + 4, touchY: py - 3, view: VIEW, plot: PLOT, radius: 26 });
    expect(found.index).toBe(1);
  });

  test('промах мимо всех точек ничего не выбирает', () => {
    const found = findNearestPoint({ points, touchX: 200, touchY: 20, view: VIEW, plot: PLOT, radius: 10 });
    expect(found).toBeNull();
  });

  test('после приближения попадание считается в новых координатах', () => {
    const zoomed = zoomView({
      view: VIEW, scale: 4, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });
    const target = points[1];
    const px = valueToPixelX(target.x, zoomed, PLOT);
    const py = valueToPixelY(target.y, zoomed, PLOT);

    const found = findNearestPoint({ points, touchX: px, touchY: py, view: zoomed, plot: PLOT, radius: 26 });
    expect(found.index).toBe(1);
  });
});

describe('toggleSelection', () => {
  test('копит до двух точек', () => {
    expect(toggleSelection([], 0)).toEqual([0]);
    expect(toggleSelection([0], 2)).toEqual([0, 2]);
  });

  test('повторный тап снимает выбор', () => {
    expect(toggleSelection([0, 2], 0)).toEqual([2]);
  });

  test('третья точка заменяет самую старую', () => {
    expect(toggleSelection([0, 2], 3)).toEqual([2, 3]);
  });
});
