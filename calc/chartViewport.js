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
  // и дальше всякое деление на размах даёт бесконечности
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
    !(rangeX > 0) ||
    !(rangeY > 0) ||
    !isFinite(view.x0) ||
    !isFinite(view.y0)
  ) {
    return base;
  }

  const marginX = overscan * rangeX;
  const centreX = (view.x0 + view.x1) / 2;
  const boundedX = Math.min(base.x1 + marginX, Math.max(base.x0 - marginX, centreX));
  const deltaX = boundedX - centreX;

  const marginY = overscan * rangeY;
  const centreY = (view.y0 + view.y1) / 2;
  const boundedY = Math.min(base.y1 + marginY, Math.max(base.y0 - marginY, centreY));
  const deltaY = boundedY - centreY;

  return {
    x0: view.x0 + deltaX,
    x1: view.x1 + deltaX,
    y0: view.y0 + deltaY,
    y1: view.y1 + deltaY,
  };
}

/**
 * Масштабирует окно и возвращает его к данным
 *
 * @param {Object} params
 * @param {Object} params.view - текущее окно
 * @param {number} [params.scale] - общий масштаб обеих осей
 * @param {number} [params.scaleX] - масштаб только по X; отменяет общий
 * @param {number} [params.scaleY] - масштаб только по Y; отменяет общий
 * @param {number} params.focusX - фокус по X в долях полотна, 0..1
 * @param {number} params.focusY - фокус по Y в долях полотна, сверху вниз
 * @param {Object} params.base - область по данным
 * @param {number} params.minZoom - предел отдаления
 * @param {number} params.maxZoom - предел приближения
 * @param {number} [params.overscan] - мера отступа
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новое окно
 */
export function zoomViewport({
  view,
  scale,
  scaleX,
  scaleY,
  focusX,
  focusY,
  base,
  minZoom,
  maxZoom,
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
 * @param {Object} params
 * @param {Object} params.view - текущее окно
 * @param {number} params.dx - смещение пальца по X, px
 * @param {number} params.dy - смещение пальца по Y, px
 * @param {{w: number, h: number}} params.plot - область построения
 * @param {Object} params.base - область по данным
 * @param {number} [params.overscan] - мера отступа
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новое окно
 */
export function panViewport({ view, dx, dy, plot, base, overscan = OVERSCAN }) {
  'worklet';
  // Нечисловое смещение считаем нулевым, а не пропускаем в расчёт. Набор
  // полей у события жеста разнится от платформы к платформе, и отсутствующее
  // поле приходит `undefined`: вычитание давало NaN, окно портилось, а защита
  // от испорченного окна возвращала вид по данным — перетаскивание выглядело
  // как сброс масштаба
  const safeDX = isFinite(dx) ? dx : 0;
  const safeDY = isFinite(dy) ? dy : 0;
  return clampViewport(panView({ view, dx: safeDX, dy: safeDY, plot }), {
    base,
    overscan,
  });
}
