/**
 * Геометрия графика понижения
 *
 * Пересчёт между координатами данных и пикселями, масштабирование с
 * привязкой к точке фокуса и поиск ближайшего замера под пальцем.
 *
 * Вынесено из компонента отдельно: это чистые вычисления, от которых
 * зависит и попадание пальцем по точке, и то, останутся ли оси на месте
 * при зуме. Такие вещи должны проверяться тестами, а не глазами.
 */

/**
 * Переводит значение по оси X в пиксель
 *
 * @param {number} value - значение в координатах данных
 * @param {{x0: number, x1: number}} view - видимая область
 * @param {{x: number, w: number}} plot - область построения
 * @returns {number} координата в пикселях
 */
export function valueToPixelX(value, view, plot) {
  const range = view.x1 - view.x0;
  if (!(range > 0)) return plot.x;
  return plot.x + ((value - view.x0) / range) * plot.w;
}

/**
 * Переводит значение по оси Y в пиксель
 *
 * Ось понижения направлена вниз: чем больше s, тем ниже точка, как в разрезе.
 *
 * @param {number} value - значение в координатах данных
 * @param {{y0: number, y1: number}} view - видимая область
 * @param {{y: number, h: number}} plot - область построения
 * @returns {number} координата в пикселях
 */
export function valueToPixelY(value, view, plot) {
  const range = view.y1 - view.y0;
  if (!(range > 0)) return plot.y;
  return plot.y + ((value - view.y0) / range) * plot.h;
}

/**
 * Масштабирует видимую область относительно точки фокуса
 *
 * Значение под пальцами остаётся на прежнем месте экрана — иначе при щипке
 * график уезжает из-под рук. Диапазон ограничен пределами масштаба, чтобы
 * нельзя было зумом вывести данные за пределы видимости.
 *
 * @param {Object} params
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.view - текущая область
 * @param {number} params.scale - во сколько раз приблизить (>1 — приблизить)
 * @param {number} params.focusX - фокус по X в долях области, 0..1
 * @param {number} params.focusY - фокус по Y в долях области, 0..1
 * @param {{x: number, y: number}} params.baseRange - исходные диапазоны осей
 * @param {number} params.minZoom - минимальное приближение
 * @param {number} params.maxZoom - максимальное приближение
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новая область
 */
export function zoomView({ view, scale, focusX, focusY, baseRange, minZoom, maxZoom }) {
  'worklet';
  const rangeX = view.x1 - view.x0;
  const rangeY = view.y1 - view.y0;

  if (!(rangeX > 0) || !(rangeY > 0) || !(scale > 0) || !isFinite(scale)) {
    return view;
  }

  const clampRange = (next, base) =>
    Math.min(base / minZoom, Math.max(base / maxZoom, next));

  const nextRangeX = clampRange(rangeX / scale, baseRange.x);
  const nextRangeY = clampRange(rangeY / scale, baseRange.y);

  const anchorX = view.x0 + focusX * rangeX;
  const anchorY = view.y0 + focusY * rangeY;

  const x0 = anchorX - focusX * nextRangeX;
  const y0 = anchorY - focusY * nextRangeY;

  return { x0, x1: x0 + nextRangeX, y0, y1: y0 + nextRangeY };
}

/**
 * Сдвигает видимую область на смещение в пикселях
 *
 * Перевод в единицы данных зависит от текущего масштаба, поэтому жест
 * ощущается одинаково и при сильном приближении, и при общем виде.
 *
 * @param {Object} params
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.view - текущая область
 * @param {number} params.dx - смещение пальца по X, px
 * @param {number} params.dy - смещение пальца по Y, px
 * @param {{w: number, h: number}} params.plot - область построения
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новая область
 */
export function panView({ view, dx, dy, plot }) {
  'worklet';
  const rangeX = view.x1 - view.x0;
  const rangeY = view.y1 - view.y0;

  const shiftX = -(dx / plot.w) * rangeX;
  const shiftY = -(dy / plot.h) * rangeY;

  return {
    x0: view.x0 + shiftX,
    x1: view.x1 + shiftX,
    y0: view.y0 + shiftY,
    y1: view.y1 + shiftY,
  };
}

/**
 * Находит ближайший к касанию замер
 *
 * @param {Object} params
 * @param {Array<{index: number, x: number, y: number}>} params.points - замеры
 * @param {number} params.touchX - координата касания, px
 * @param {number} params.touchY - координата касания, px
 * @param {Object} params.view - видимая область
 * @param {Object} params.plot - область построения
 * @param {number} params.radius - радиус захвата, px
 * @returns {Object|null} ближайший замер или null, если палец далеко
 */
export function findNearestPoint({ points, touchX, touchY, view, plot, radius }) {
  let best = null;
  let bestDistance = Infinity;

  for (const point of points) {
    const px = valueToPixelX(point.x, view, plot);
    const py = valueToPixelY(point.y, view, plot);
    const distance = Math.hypot(px - touchX, py - touchY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }

  return bestDistance <= radius ? best : null;
}

/**
 * Обновляет набор выбранных точек
 *
 * Держим не больше двух: повторный тап снимает выбор, третий заменяет
 * самую старую — иначе пришлось бы отдельно объяснять, как сбросить выбор.
 *
 * @param {Array<number>} selected - текущие индексы
 * @param {number} index - индекс точки, по которой тапнули
 * @returns {Array<number>} новый набор
 */
export function toggleSelection(selected, index) {
  if (selected.includes(index)) {
    return selected.filter((i) => i !== index);
  }
  return selected.length < 2 ? [...selected, index] : [selected[1], index];
}
