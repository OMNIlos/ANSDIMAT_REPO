/**
 * Графоаналитическая обработка методом Купера — Джейкоба
 *
 * При u < 0.01 функция Тейса приближается логарифмом, и понижение становится
 * линейным по логарифму времени:
 *   s = (2.3·Q / 4π·T) · lg(2.25·T·t / r²S)
 * Наклон прямой на графике s — lg t равен a = 2.3·Q/(4π·T), откуда
 *   T = 2.3·Q / (4π·a) = 0.183·Q / a
 *
 * Коэффициент 0.183 = 2.3/(4π) — это точное значение, а не подгонка.
 *
 * Кроме T метод даёт водоотдачу по отрезку, отсекаемому прямой на оси
 * времени: при s = 0 имеем t₀, и S = 2.25·T·t₀ / r².
 */

/** Множитель Купера — Джейкоба: 2.3/(4π) */
export const COOPER_JACOB_FACTOR = 2.3 / (4 * Math.PI);

/**
 * Логарифм числа минут в сутках — поправка на единицу времени журнала
 *
 * Формулы способа прямой линии написаны для времени в сутках, а журнал ОФР
 * ведётся в минутах, и регрессия идёт по lg t в минутах. Наклону это
 * безразлично: он берётся на логарифмический цикл, а смена единицы сдвигает
 * ось на постоянную. Свободный член сдвигается вместе с осью:
 *   A_сут = A_мин + C·lg 1440
 * Без этой поправки пьезопроводность выходит ровно в 1440 раз меньше, и на
 * глаз это не видно: a меняется на порядки от пласта к пласту.
 */
export const LG_MINUTES_PER_DAY = Math.log10(1440);

export const X_MODES = {
  LOG: 'lg',
  LINEAR: 't',
  SQRT: 'sqrt',
};

/**
 * Преобразует время в координату оси X согласно режиму графика
 *
 * @param {number} t - время, мин
 * @param {string} mode - режим оси: 'lg' | 't' | 'sqrt'
 * @returns {number|null} координата X; null, если значение недопустимо
 */
export function transformTime(t, mode) {
  if (!isFinite(t)) return null;
  if (mode === X_MODES.LOG) return t > 0 ? Math.log10(t) : null;
  if (mode === X_MODES.SQRT) return t >= 0 ? Math.sqrt(t) : null;
  return t;
}

/**
 * Линейная регрессия методом наименьших квадратов
 *
 * @param {Array<{x: number, y: number}>} points - точки
 * @returns {{slope: number, intercept: number, r2: number, count: number}}
 *   slope — наклон a, intercept — свободный член b, r2 — коэффициент
 *   детерминации (качество аппроксимации)
 */
export function linearRegression(points) {
  const valid = points.filter((p) => isFinite(p.x) && isFinite(p.y));
  const n = valid.length;

  if (n < 2) {
    return { slope: NaN, intercept: NaN, r2: NaN, count: n };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;

  for (const p of valid) {
    sumX += p.x;
    sumY += p.y;
    sumXX += p.x * p.x;
    sumXY += p.x * p.y;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) {
    return { slope: NaN, intercept: NaN, r2: NaN, count: n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Коэффициент детерминации
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of valid) {
    const predicted = slope * p.x + intercept;
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - predicted) ** 2;
  }
  const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : NaN;

  return { slope, intercept, r2, count: n };
}

/**
 * Строит прямую через две точки
 *
 * Классический графоаналитический приём: геолог сам выбирает участок, на
 * который ложится прямая, и снимает наклон по двум точкам. Это надёжнее
 * регрессии по всем замерам, когда начало откачки искажено ёмкостью ствола,
 * а конец — границей пласта: такие участки в прямую не ложатся и портят
 * оценку по методу наименьших квадратов.
 *
 * @param {{x: number, y: number}} first - первая точка
 * @param {{x: number, y: number}} second - вторая точка
 * @returns {{slope: number, intercept: number}} параметры прямой y = a·x + b;
 *   NaN, если точки совпадают по x (наклон не определён)
 */
export function lineThroughPoints(first, second) {
  if (!first || !second) return { slope: NaN, intercept: NaN };

  const dx = second.x - first.x;
  if (!isFinite(dx) || Math.abs(dx) < 1e-12) {
    return { slope: NaN, intercept: NaN };
  }

  const slope = (second.y - first.y) / dx;
  const intercept = first.y - slope * first.x;
  return { slope, intercept };
}

/**
 * Рассчитывает водопроводимость по наклону прямой Купера — Джейкоба
 *
 * @param {number} Q - дебит, м³/сут
 * @param {number} slope - наклон прямой s = a·lg t + b, м на логарифмический цикл
 * @returns {number} водопроводимость T, м²/сут; NaN при некорректных данных
 */
export function transmissivityFromSlope(Q, slope) {
  if (!(Q > 0) || !isFinite(slope) || Math.abs(slope) < 1e-9) return NaN;
  return (COOPER_JACOB_FACTOR * Q) / Math.abs(slope);
}

/**
 * Рассчитывает водоотдачу по отрезку, отсекаемому прямой на оси времени
 *
 * S = 2.25·T·t₀ / r², где t₀ — время при s = 0 (в сутках).
 *
 * @param {number} T - водопроводимость, м²/сут
 * @param {number} slope - наклон прямой
 * @param {number} intercept - свободный член
 * @param {number} r - расстояние до наблюдательной скважины, м
 * @returns {number} водоотдача S (безразмерная); NaN при некорректных данных
 */
export function storativityFromIntercept(T, slope, intercept, r) {
  if (!(T > 0) || !(r > 0) || !isFinite(slope) || Math.abs(slope) < 1e-9) return NaN;
  // s = 0 → lg t₀ = -b/a, время в минутах
  const logT0 = -intercept / slope;
  const t0Minutes = Math.pow(10, logT0);
  if (!isFinite(t0Minutes) || t0Minutes <= 0) return NaN;
  const t0Days = t0Minutes / 1440;
  return (2.25 * T * t0Days) / (r * r);
}

/**
 * Рассчитывает пьезопроводность по свободному члену прямой
 *
 * Табл. 4.1 АНСДИМАТ, столбец временнóго прослеживания:
 *   lg a = A/C + lg(r²/2.25), время в сутках.
 * Регрессия идёт по времени в минутах, поэтому добавляется lg 1440,
 * см. LG_MINUTES_PER_DAY.
 *
 * @param {number} slope - наклон прямой s = C·lg t + A, время в минутах
 * @param {number} intercept - свободный член A той же прямой
 * @param {number} r - расстояние до наблюдательной скважины, м
 * @returns {number} пьезопроводность a, м²/сут; NaN при некорректных данных
 */
export function diffusivityFromIntercept(slope, intercept, r) {
  if (!(r > 0) || !isFinite(slope) || Math.abs(slope) < 1e-9 || !isFinite(intercept)) {
    return NaN;
  }
  const logA =
    intercept / slope + LG_MINUTES_PER_DAY + Math.log10((r * r) / 2.25);
  const a = Math.pow(10, logA);
  return isFinite(a) ? a : NaN;
}

/**
 * Полная обработка ряда замеров методом Купера — Джейкоба
 *
 * Это временнóе прослеживание из табл. 4.1: график s — lg t. Площадное и
 * комбинированное живут в [`tracking.js`](./tracking.js) — там в абсциссу
 * входит расстояние, и точки собираются не из одного журнала.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - замеры
 * @param {number} params.Q - дебит, м³/сут
 * @param {string} [params.mode] - режим оси X
 * @param {number} [params.r] - расстояние до наблюдательной скважины, м
 * @param {{slope: number, intercept: number}} [params.line] - прямая, проведённая
 *   геологом по двум точкам: подменяет регрессию, а не дополняет её
 * @returns {{slope: number, intercept: number, r2: number, T: number, S: number,
 *   a: number, applicable: boolean, note: string, count: number}}
 *   applicable — можно ли считать T: только в режиме lg t
 */
export function processDrawdown({ measurements, Q, mode = X_MODES.LOG, r, line }) {
  const points = measurements
    .map((m) => ({ x: transformTime(m.t, mode), y: m.s }))
    .filter((p) => p.x != null && isFinite(p.y));

  const regression = linearRegression(points);
  // Прямая по двум выбранным точкам заменяет регрессию целиком: показывать
  // рядом с ней r² регрессии значило бы приписывать ей чужое качество
  const manual = line && isFinite(line.slope) && isFinite(line.intercept);
  const slope = manual ? line.slope : regression.slope;
  const intercept = manual ? line.intercept : regression.intercept;
  const r2 = manual ? NaN : regression.r2;
  const count = regression.count;
  const applicable = mode === X_MODES.LOG;

  const T = applicable ? transmissivityFromSlope(Q, slope) : NaN;
  const S = applicable ? storativityFromIntercept(T, slope, intercept, r) : NaN;
  const a = applicable ? diffusivityFromIntercept(slope, intercept, r) : NaN;

  let note;
  if (!applicable) {
    note = 'switchToLogMode';
  } else if (count < 2) {
    note = 'needMoreMeasurements';
  } else {
    note = 'cooperJacob';
  }

  return { slope, intercept, r2, T, S, a, applicable, note, count };
}
