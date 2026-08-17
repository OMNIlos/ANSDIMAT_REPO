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
 * Здесь при зуме меняется только положение элементов.
 *
 * Отметка точек в сцену не входит: это состояние отрисовки, а не геометрии, и
 * применяется при выводе. Иначе тап по замеру пересчитывал бы всю сцену.
 */

import { valueToPixelX, valueToPixelY, logTicks } from './chartGeometry';
import { X_MODES } from './cooperJacob';

/** Сколько пикселей нужно подписи деления, чтобы числа не налезали */
const LABEL_ROOM = 56;

/** Больше этого числа делений на оси не ставится: подписи сливаются */
const MAX_TICKS = 8;

/**
 * Подбирает «красивый» шаг сетки: 1, 2, 5 или 10, умноженное на степень десяти
 *
 * @param {number} range - охватываемый диапазон значений
 * @returns {number} шаг деления
 */
export function niceStep(range) {
  if (!(range > 0)) return 1;
  const raw = range / 4.5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return step * magnitude;
}

/**
 * Форматирует число для подписи оси
 *
 * @param {number} value - значение
 * @returns {string} подпись
 */
export function formatTick(value) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs < 0.001 || abs >= 100000) return value.toExponential(1);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

/**
 * Форматирует подпись деления логарифмической оси
 *
 * Значения там ровные — кратность на степень десяти, — и общий формат портит
 * их хвостами: 20 превращается в «20.0», а 100 в «100». Округление до трёх
 * значащих убирает и хвост, и накопленную погрешность 10^lg.
 *
 * @param {number} value - значение деления
 * @returns {string} подпись
 */
export function formatLogTick(value) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 0.001 || abs >= 100000) return value.toExponential(0);
  return String(Number(value.toPrecision(3)));
}

/**
 * Собирает всё, что зависит от видимой области
 *
 * @param {Object} params
 * @param {Array<Object>} params.series - серии, см. calc/chartSeries.js
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.view - окно
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.base -
 *   область по данным: подменяет испорченную посреди жеста
 * @param {{x: number, y: number, w: number, h: number}} params.plot - полотно
 * @param {string} params.mode - ось абсцисс, см. X_MODES
 * @param {{slope: number, intercept: number}} params.fit - прямая
 * @param {Array<{x: number, y: number}>|null} params.anchors - свободные точки
 * @returns {{hasData: boolean, shapes: Array<Object>,
 *   anchorDots: Array<{cx: number, cy: number}>, fitPath: string,
 *   xTicks: Array<{x: number, label: string|null}>,
 *   yTicks: Array<{y: number, label: string}>}} сцена
 */
export function buildScene({ series, view, base, plot, mode, fit, anchors }) {
  const shapes = [];

  const hasData = (series ?? []).some((one) => one?.points?.length > 0);
  if (!hasData) {
    return {
      hasData: false,
      shapes,
      anchorDots: [],
      fitPath: '',
      xTicks: [],
      yTicks: [],
    };
  }

  // Область могла выродиться посреди жеста: щипок двумя пальцами на мгновение
  // даёт нулевой или отрицательный размах. Раньше это роняло график в пустое
  // состояние с надписью «внесите замеры» — прямо во время масштабирования.
  // Замеры при этом никуда не девались, поэтому берём вид по данным
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
      ? anchors.map((anchor) => ({ cx: toX(anchor.x), cy: toY(anchor.y) }))
      : [];

  // Деления оси абсцисс. На логарифмической оси — как на логарифмической
  // бумаге: подписи на степенях десяти, между ними мелкая сетка. Равномерный
  // шаг по логарифму давал подписи 0.316 и 3.16 — числа, по которым не
  // прикинуть значение на глаз
  const xTicks = [];
  if (mode === X_MODES.LOG) {
    // Сколько подписей помещается по ширине: под каждой стоит число, и
    // меньше полусотни пикселей на него давать нельзя
    const room = Math.max(2, Math.floor(plot.w / LABEL_ROOM));
    for (const tick of logTicks({ from: safe.x0, to: safe.x1, maxLabels: room })) {
      xTicks.push({
        x: toX(tick.log),
        label: tick.labelled ? formatLogTick(tick.value) : null,
      });
    }
  } else {
    const stepX = niceStep(safe.x1 - safe.x0);
    for (let v = Math.ceil(safe.x0 / stepX) * stepX; v <= safe.x1 + 1e-9; v += stepX) {
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
