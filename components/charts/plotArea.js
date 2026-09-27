/**
 * Разметка полотна графиков калькулятора
 *
 * Оба графика — приток во времени и понижение во времени — строятся одинаково:
 * прямоугольник под кривые, отступы под подписи осей и перевод значения в
 * координату. Разное у них только то, что отложено по осям.
 */

/** Высота полотна графиков */
export const HEIGHT = 220;

/**
 * Отступы под подписи осей
 *
 * Слева шире остальных: там стоят и вертикальная подпись оси, и плашка
 * значения курсора — вплотную они наезжали друг на друга.
 */
export const PADDING = { left: 64, right: 14, top: 18, bottom: 34 };

/**
 * Прямоугольник, внутри которого лежат кривые
 *
 * @param {number} width - ширина полотна
 * @returns {{x: number, y: number, w: number, h: number}} область построения
 */
export function plotArea(width) {
  return {
    x: PADDING.left,
    y: PADDING.top,
    w: Math.max(40, width - PADDING.left - PADDING.right),
    h: HEIGHT - PADDING.top - PADDING.bottom,
  };
}

/**
 * Делает линейный перевод значения в координату
 *
 * @param {number} min - минимум диапазона значений
 * @param {number} max - максимум диапазона значений
 * @param {number} from - координата, соответствующая минимуму
 * @param {number} to - координата, соответствующая максимуму
 * @returns {function(number): number} перевод значения в координату
 */
export function linearScale(min, max, from, to) {
  const span = max - min;
  if (!(span > 0)) {
    const scale = () => (from + to) / 2;
    scale.invert = () => min;
    return scale;
  }
  const scale = (value) => from + ((value - min) / span) * (to - from);
  // Обратный перевод нужен курсору: под пальцем известна координата, а
  // показать надо значение
  scale.invert = (coord) => min + ((coord - from) / (to - from)) * span;
  return scale;
}

/**
 * Делает логарифмический перевод значения в координату
 *
 * Время у откачки меняется на восемь порядков, и на линейной шкале первые из
 * них слиплись бы в одну точку — а именно там кривая и меняет форму.
 *
 * @param {number} min - минимум диапазона, должен быть > 0
 * @param {number} max - максимум диапазона
 * @param {number} from - координата, соответствующая минимуму
 * @param {number} to - координата, соответствующая максимуму
 * @returns {function(number): number} перевод значения в координату
 */
export function logScale(min, max, from, to) {
  if (!(min > 0) || !(max > min)) {
    const scale = () => (from + to) / 2;
    scale.invert = () => min;
    return scale;
  }
  const lo = Math.log10(min);
  const hi = Math.log10(max);
  const scale = (value) =>
    from + ((Math.log10(Math.max(value, min)) - lo) / (hi - lo)) * (to - from);
  scale.invert = (coord) => Math.pow(10, lo + ((coord - from) / (to - from)) * (hi - lo));
  return scale;
}

/**
 * Круглые деления линейной оси
 *
 * @param {number} min - минимум диапазона
 * @param {number} max - максимум диапазона
 * @param {number} [count] - желаемое число делений
 * @returns {Array<number>} значения делений
 */
export function niceTicks(min, max, count = 4) {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step = (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;
  const ticks = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step / 2; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

/**
 * Деления логарифмической оси по десятичным порядкам
 *
 * @param {number} min - минимум диапазона, должен быть > 0
 * @param {number} max - максимум диапазона
 * @returns {Array<number>} значения делений
 */
export function decadeTicks(min, max) {
  if (!(min > 0) || !(max > min)) return [];
  const ticks = [];
  for (let power = Math.ceil(Math.log10(min)); power <= Math.floor(Math.log10(max)); power++) {
    // Через литерал, а не Math.pow: 10⁻⁴ там выходит 0.00009999999999999999,
    // и подпись деления получалась бы не круглой
    ticks.push(Number(`1e${power}`));
  }
  return ticks;
}

/**
 * Прижимает значение к отрезку
 *
 * @param {number} value - значение
 * @param {number} min - нижняя граница
 * @param {number} max - верхняя граница
 * @returns {number} значение внутри отрезка
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Короткая запись значения для плашки курсора
 *
 * Плашка узкая и стоит на оси: три знака после запятой в ней не помещаются, а
 * порядок величины теряться не должен — очень малые и очень большие числа
 * уходят в экспоненциальную запись.
 *
 * @param {number} value - значение
 * @returns {string} запись значения
 */
export function formatReadout(value) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs < 0.01 || abs >= 1e5) return value.toExponential(2);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/**
 * Собирает путь ломаной по точкам
 *
 * @param {Array<{x: number, y: number}>} points - точки в координатах полотна
 * @returns {string} значение атрибута d
 */
export function polyline(points) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}
