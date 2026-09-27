/**
 * Виды прослеживания способом прямой линии
 *
 * Способ прямой линии (табл. 4.1 АНСДИМАТ, разд. 4.1.1) читает один и тот же
 * опыт с трёх сторон. Понижение при u < 0.01 линейно по логарифму:
 *   s = 0.183·Q/T · lg(2.25·a·t/r²),
 * и что отложить по оси абсцисс — дело выбора.
 *
 *   временнóе      s — lg t        один журнал, r постоянно
 *   площадное      s — lg r        срез по кусту на один момент времени
 *   комбинированное s — lg(t/r²)   замеры всех скважин на одной плоскости
 *
 * Временнóе живёт в [`cooperJacob.js`](./cooperJacob.js): это и есть метод
 * Купера — Джейкоба, и он был здесь раньше остальных. Здесь два вида, у
 * которых в абсциссу входит расстояние.
 *
 * Что легко перепутать у площадного:
 *   — множитель 0.366, а не 0.183. Понижение зависит от lg r², то есть от
 *     2·lg r, и наклон получается вдвое круче;
 *   — знак. Понижение убывает с расстоянием, зависимость записана как
 *     s = −C·lg r + A, поэтому угловой коэффициент прямой C = −tg α.
 *
 * Водоотдача считается как S = T/a. Это определение пьезопроводности
 * (a = T/S), а не второй вывод: формулы табл. 4.2 через отрезок на оси
 * абсцисс дают ровно то же самое, и тесты сверяют результат именно с ними.
 */

import {
  COOPER_JACOB_FACTOR,
  LG_MINUTES_PER_DAY,
  linearRegression,
} from './cooperJacob';

/** Минут в сутках: формулы таблицы написаны для суток, журнал ведётся в минутах */
const MINUTES_PER_DAY = 1440;

/**
 * Виды прослеживания
 *
 * Значения совпадают с тем, что хранит экран в выборе графика.
 */
export const TRACKING_KINDS = {
  TIME: 'time',
  AREA: 'area',
  COMBINED: 'combined',
};

/**
 * Проводит прямую по точкам: регрессией или заданной геологом
 *
 * Прямая по двум выбранным точкам заменяет регрессию целиком. Качество
 * аппроксимации к ней не относится: r² описывает разброс вокруг прямой
 * наименьших квадратов, и приписывать его чужой прямой нельзя.
 *
 * @param {Array<{x: number, s: number}>} points - точки, x — сырая абсцисса
 * @param {{slope: number, intercept: number}} [line] - готовая прямая
 * @returns {{slope: number, intercept: number, r2: number, count: number}}
 */
function fitLine(points, line) {
  // Абсцисса берётся по логарифму, поэтому ноль и отрицательные значения
  // отбрасываются: расстояние 0 стоит у скважины, которой его не задали
  const logged = points
    .filter((p) => p.x > 0 && isFinite(p.s))
    .map((p) => ({ x: Math.log10(p.x), y: p.s }));

  const regression = linearRegression(logged);
  const manual = line && isFinite(line.slope) && isFinite(line.intercept);

  return {
    slope: manual ? line.slope : regression.slope,
    intercept: manual ? line.intercept : regression.intercept,
    r2: manual ? NaN : regression.r2,
    count: regression.count,
  };
}

/**
 * Возводит 10 в степень, отсеивая переполнение
 *
 * @param {number} logValue - показатель степени
 * @returns {number} значение или NaN
 */
function fromLog(logValue) {
  if (!isFinite(logValue)) return NaN;
  const value = Math.pow(10, logValue);
  return isFinite(value) && value > 0 ? value : NaN;
}

/**
 * Собирает результат в общей форме — той же, что у processDrawdown
 *
 * Экран показывает карточки одинаково, какой бы вид прослеживания ни был
 * открыт, поэтому форма результата у всех трёх одна.
 *
 * @param {Object} params
 * @param {Object} params.fit - прямая, см. fitLine
 * @param {number} params.T - водопроводимость, м²/сут
 * @param {number} params.a - пьезопроводность, м²/сут
 * @returns {Object} результат обработки
 */
function result({ fit, T, a }) {
  const S = isFinite(T) && isFinite(a) && a > 0 ? T / a : NaN;
  return {
    slope: fit.slope,
    intercept: fit.intercept,
    r2: fit.r2,
    count: fit.count,
    T,
    S,
    a,
    // Оба вида строятся только по логарифмической оси: другой у них нет,
    // и оговорка «переключите ось» к ним не относится
    applicable: true,
    note: fit.count < 2 ? 'needMoreMeasurements' : 'cooperJacob',
  };
}

/**
 * Площадное прослеживание: график s — lg r
 *
 * Точки — скважины куста на один и тот же момент времени, по оси абсцисс
 * расстояние до опытной скважины.
 *   s = −C·lg r + A,  T = 0.366·Q/C,  lg a = 2·A/C − lg(2.25·t)
 *
 * @param {Object} params
 * @param {Array<{x: number, s: number}>} params.points - точки: x — расстояние, м
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} [params.time] - момент, на который снят срез, мин
 * @param {{slope: number, intercept: number}} [params.line] - прямая по двум точкам
 * @returns {Object} результат обработки: T, S, a, параметры прямой
 */
export function processAreaTracking({ points, Q, time, line }) {
  const fit = fitLine(points, line);
  const C = -fit.slope;

  const T =
    Q > 0 && isFinite(C) && Math.abs(C) > 1e-9
      ? (2 * COOPER_JACOB_FACTOR * Q) / Math.abs(C)
      : NaN;

  // t входит в формулу явно, поэтому переводится в сутки: остальные виды
  // обходятся сдвигом свободного члена, а здесь сдвигать нечего
  const timeDays = time > 0 ? time / MINUTES_PER_DAY : NaN;
  const a =
    isFinite(C) && Math.abs(C) > 1e-9 && isFinite(fit.intercept) && timeDays > 0
      ? fromLog((2 * fit.intercept) / C - Math.log10(2.25 * timeDays))
      : NaN;

  return result({ fit, T, a });
}

/**
 * Комбинированное прослеживание: график s — lg(t/r²)
 *
 * На одной плоскости лежат замеры всех скважин куста: у каждой свой r, и
 * точки разных скважин ложатся на одну прямую.
 *   s = C·lg(t/r²) + A,  T = 0.183·Q/C,  lg a = A/C − lg 2.25
 *
 * Абсцисса приходит в мин/м², а формула написана для сут/м² — отсюда та же
 * поправка lg 1440, что и во временнóм прослеживании: смена единицы времени
 * сдвигает ось, а вместе с ней свободный член.
 *
 * @param {Object} params
 * @param {Array<{x: number, s: number}>} params.points - точки: x = t/r², мин/м²
 * @param {number} params.Q - дебит, м³/сут
 * @param {{slope: number, intercept: number}} [params.line] - прямая по двум точкам
 * @returns {Object} результат обработки: T, S, a, параметры прямой
 */
export function processCombinedTracking({ points, Q, line }) {
  const fit = fitLine(points, line);
  const C = fit.slope;

  const T =
    Q > 0 && isFinite(C) && Math.abs(C) > 1e-9
      ? (COOPER_JACOB_FACTOR * Q) / Math.abs(C)
      : NaN;

  const a =
    isFinite(C) && Math.abs(C) > 1e-9 && isFinite(fit.intercept)
      ? fromLog(fit.intercept / C + LG_MINUTES_PER_DAY - Math.log10(2.25))
      : NaN;

  return result({ fit, T, a });
}
