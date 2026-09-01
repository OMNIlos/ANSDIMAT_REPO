/**
 * Экспресс-опробование: решение Бауэра — Райса
 *
 * Экспресс-опробование (slug test) — не откачка: в скважину разом доливают
 * или из неё разом вычерпывают объём воды, уровень скачком уходит на s⁰ и
 * дальше сам возвращается к статическому. Насос не нужен, опыт занимает
 * минуты, и для слабопроницаемых пород это часто единственный доступный
 * способ получить коэффициент фильтрации.
 *
 * Решение Бауэра — Райса даёт k безнапорного пласта по данным опробования в
 * несовершенной по степени вскрытия скважине. Профильная анизотропия и
 * ёмкостные параметры в нём не учитываются.
 *
 * Изменение уровня во времени (Bouwer, Rice, 1976):
 *
 *   ln(s⁰/s_w) = 2·k·l_w·t / (r_c²·ln(R/r_w)),
 *
 * где радиус влияния R для несовершенной скважины берётся из
 *
 *   ln(R/r_w) = [ 1.1/ln(z/r_w) + (A₁ + A₂·ln((m−z)/r_w)) / (l_w/r_w) ]⁻¹,
 *
 * а для совершенной скважины и для случая z = m (скважина примыкает к
 * подошве пласта) — из
 *
 *   ln(R/r_w) = [ 1.1/ln(z/r_w) + r_w·A₃/l_w ]⁻¹.
 *
 * Верхний предел выражения ln((m−z)/r_w) равен шести: при опробовании
 * пластов большой мощности вместо него подставляется число 6.
 *
 * Обработка — способом прямой линии по графику lg(s⁰/s_w) — t:
 *
 *   k = 2.3·r_c²/(2·l_w)·C·ln(R/r_w),   C — угловой коэффициент прямой.
 *
 * Журнал ведут так же, как на восстановлении после откачки: пишут не остаток
 * скачка s_w, а то, насколько уровень уже вернулся. Пересчёт — в
 * `slugPoints`.
 *
 * Прямая должна выходить из начала координат. Если прямолинейных участков
 * два, обрабатывают второй: первый говорит о нарушенной зоне вокруг
 * скважины или о перетекании. Третий участок (не прямой) появляется на малых
 * понижениях, когда восстановление напора практически завершилось.
 *
 * Источники: Bouwer H., Rice R.C. (1976); Синдаловский Л.Н. АНСДИМАТ,
 * разд. 3.3.2 (изд. 2014) и разд. 10.6 «Справочника аналитических решений»
 * (2006) — там же аппроксимация коэффициентов A₁, A₂, A₃.
 */

import { linearRegression, lineThroughPoints } from './cooperJacob';
import { MINUTES_PER_DAY } from './units';

/**
 * Границы применимости аппроксимации A₁, A₂, A₃
 *
 * График Бауэра — Райса построен для l_w/r_w от 1 до 2000, и полиномы
 * подогнаны под него на двух отрезках. За границами полиномы шестой степени
 * улетают в бессмыслицу — быстрее, чем растёт сама ошибка экстраполяции, —
 * поэтому β зажимается, а не продолжается.
 */
export const BETA_MIN = 1;
export const BETA_SPLIT = 200;
export const BETA_MAX = 2000;

/** Верхний предел ln[(m−z)/r_w] в зависимости (10.92) */
export const LOG_THICKNESS_CAP = 6;

/**
 * Множитель перехода от десятичного логарифма к натуральному
 *
 * В табл. 3.1 он напечатан округлённым до 2.3, а не как ln 10 = 2.302585, и
 * здесь взят в том же виде — как и 0.183 = 2.3/4π у Купера — Джейкоба, см.
 * COOPER_JACOB_FACTOR. Разница с точным значением 0.11 %: на фоне разброса
 * замеров экспресс-опробования она незаметна, зато результат сходится с
 * настольным АНСДИМАТ и с числами, посчитанными по книге вручную.
 */
export const STRAIGHT_LINE_FACTOR = 2.3;

/**
 * Коэффициенты полиномов по возрастанию степени β
 *
 * Первый набор — для 1 ≤ β ≤ 200, второй — для 200 < β < 2000.
 */
const A_COEFFICIENTS = {
  low: {
    A1: [
      1.4773306, 0.02741954, 8.0340006e-5, -2.5045234e-7, -1.2204508e-8,
      9.7196356e-11, -2.1463808e-13,
    ],
    A2: [
      0.166753, 0.004970107, 5.4654427e-5, -1.278645e-6, 1.1887909e-8,
      -5.1785833e-11, 8.6501211e-14,
    ],
    A3: [
      0.3905696, 0.08310949, -0.001515863, 2.1736242e-5, -1.653479e-7,
      6.3107187e-10, -9.4937404e-13,
    ],
  },
  high: {
    A1: [
      2.510366, 0.0260556, -5.08597807e-5, 5.8230884e-8, -3.7929349e-11,
      1.2935074e-14, -1.7859607e-18,
    ],
    A2: [
      -0.0651429, 0.006547392, -4.1237584e-6, -2.1340524e-9, 4.5603083e-12,
      -2.3529733e-15, 4.0923695e-19,
    ],
    A3: [
      0.2593157, 0.04869992, -9.4552972e-5, 1.05714921e-7, -6.7058679e-11,
      2.2286538e-14, -3.004312102e-18,
    ],
  },
};

/**
 * Считает полином по схеме Горнера
 *
 * @param {Array<number>} coefficients - коэффициенты по возрастанию степени
 * @param {number} x - аргумент
 * @returns {number} значение полинома
 */
function polynomial(coefficients, x) {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1) {
    result = result * x + coefficients[i];
  }
  return result;
}

/**
 * Безразмерные коэффициенты A₁, A₂, A₃ по отношению длины фильтра к радиусу
 *
 * Получены Бауэром и Райсом эмпирически и заданы графиком (рис. 3.7
 * АНСДИМАТ); здесь взята аппроксимация Синдаловского (2006) — два полинома
 * шестой степени на отрезках 1…200 и 200…2000.
 *
 * @param {number} beta - отношение β = l_w/r_w
 * @returns {{A1: number, A2: number, A3: number, beta: number}} коэффициенты
 *   и то значение β, по которому они посчитаны (зажатое в границы графика);
 *   все NaN, если β не число
 */
export function bouwerRiceCoefficients(beta) {
  if (!isFinite(beta) || beta <= 0) {
    return { A1: NaN, A2: NaN, A3: NaN, beta: NaN };
  }
  const clamped = Math.min(Math.max(beta, BETA_MIN), BETA_MAX);
  const set = clamped <= BETA_SPLIT ? A_COEFFICIENTS.low : A_COEFFICIENTS.high;
  return {
    A1: polynomial(set.A1, clamped),
    A2: polynomial(set.A2, clamped),
    A3: polynomial(set.A3, clamped),
    beta: clamped,
  };
}

/**
 * Логарифм безразмерного радиуса влияния ln(R/r_w)
 *
 * Схема выбирается сама: пока низ фильтра не достал до подошвы пласта
 * (z < m), скважина несовершенная и работает зависимость с A₁ и A₂; когда
 * достал (z ≥ m) — зависимость с A₃. Формулу для несовершенной скважины при
 * z = m использовать нельзя: ln[(m−z)/r_w] обращается в −∞.
 *
 * @param {Object} params
 * @param {number} params.rw - радиус фильтра r_w, м
 * @param {number} params.lw - длина фильтра l_w, м
 * @param {number} params.z - расстояние от уровня грунтовых вод до низа
 *   фильтра, м
 * @param {number} params.m - обводнённая мощность пласта m, м
 * @returns {{value: number, partial: boolean, A1: number, A2: number,
 *   A3: number, beta: number, capped: boolean}} ln(R/r_w) и то, как он
 *   получен: partial — по зависимости для несовершенной скважины,
 *   capped — сработал предел ln[(m−z)/r_w] = 6. value = NaN при неполных
 *   или несовместимых данных
 */
export function influenceRadiusLog({ rw, lw, z, m }) {
  const invalid = {
    value: NaN,
    partial: false,
    A1: NaN,
    A2: NaN,
    A3: NaN,
    beta: NaN,
    capped: false,
  };
  if (!(rw > 0) || !(lw > 0) || !(z > 0)) return invalid;
  // Уровень должен стоять выше низа фильтра хотя бы на радиус скважины:
  // при z ≤ r_w логарифм ln(z/r_w) обращается в ноль или меняет знак, и
  // радиус влияния теряет смысл
  const logZ = Math.log(z / rw);
  if (!(logZ > 0)) return invalid;

  const beta = lw / rw;
  const { A1, A2, A3, beta: usedBeta } = bouwerRiceCoefficients(beta);

  // Несовершенная скважина: низ фильтра не дошёл до подошвы пласта.
  // Мощность меньше z означала бы фильтр ниже подошвы — такой схемы нет,
  // и она обрабатывается как совершенная
  const partial = isFinite(m) && m > z;
  let denominator;
  let capped = false;
  if (partial) {
    const raw = Math.log((m - z) / rw);
    capped = raw > LOG_THICKNESS_CAP;
    const logThickness = capped ? LOG_THICKNESS_CAP : raw;
    denominator = 1.1 / logZ + (A1 + A2 * logThickness) / beta;
  } else {
    denominator = 1.1 / logZ + (rw * A3) / lw;
  }

  const value = denominator > 0 ? 1 / denominator : NaN;
  return { value, partial, A1, A2, A3, beta: usedBeta, capped };
}

/**
 * Точки графика lg(s⁰/s_w) — t
 *
 * В журнале лежит величина восстановления уровня, отсчитанная от скачка s⁰, —
 * та же величина, что и в журнале восстановления после откачки, см.
 * `residualDrawdown` в calc/chartSeries.js. В идеале она идёт по нарастающей
 * от нуля, и последний замер равен самому s⁰: уровень вернулся к статическому
 * (табл. 19.3 АНСДИМАТ). А в зависимость (3.3.4) входит не она, а то, что от
 * скачка осталось:
 *
 *   s_w = s⁰ − (восстановление уровня).
 *
 * Без этого вычитания график переворачивается: логарифм отношения падает от
 * больших значений к нулю вместо того, чтобы расти из начала координат, —
 * прямая идёт вниз, и k получается на порядки меньше настоящего.
 *
 * Отбрасываются замеры, где остаток нулевой или отрицательный: уровень уже
 * вернулся (логарифм уходит в бесконечность) либо поднялся выше исходного, а
 * это шум. Отрицательное восстановление — тоже шум, но остаток там больше s⁰,
 * и точка легла бы ниже оси; она прижимается к началу координат, как это
 * сделано с остаточным понижением на восстановлении.
 *
 * @param {Array<{t: number, s: number}>} measurements - замеры: время от
 *   начала опыта, мин; восстановление уровня, м
 * @param {number} initialDrawdown - скачок понижения s⁰, м
 * @returns {Array<{x: number, y: number, t: number, s: number}>} точки:
 *   x — время в минутах, y — lg(s⁰/s_w), s — остаток скачка s_w
 */
export function slugPoints(measurements, initialDrawdown) {
  if (!(initialDrawdown > 0)) return [];
  const points = [];
  for (const { t, s } of measurements ?? []) {
    if (!isFinite(t) || t < 0 || !isFinite(s)) continue;
    // Выше скачка остаток не поднимается: это означало бы уровень ниже того,
    // на который его увели, — а на графике выглядело бы как точка под осью
    const residual = Math.min(initialDrawdown - s, initialDrawdown);
    if (!(residual > 0)) continue;
    points.push({ x: t, y: Math.log10(initialDrawdown / residual), t, s: residual });
  }
  return points;
}

/**
 * Коэффициент фильтрации по наклону прямой lg(s⁰/s_w) — t
 *
 * Табл. 3.1 АНСДИМАТ: k = 2.3·r_c²/(2·l_w)·C·ln(R/r_w). В зависимости время
 * в сутках, а журнал ведётся в минутах, поэтому наклон приводится к суткам
 * множителем 1440 — как это сделано в остальных расчётах, см. calc/units.js.
 *
 * @param {Object} params
 * @param {number} params.slope - угловой коэффициент C прямой, 1/мин
 * @param {number} params.rc - радиус обсадной трубы r_c, м
 * @param {number} params.lw - длина фильтра l_w, м
 * @param {number} params.influenceLog - ln(R/r_w)
 * @returns {number} коэффициент фильтрации k, м/сут; NaN при неполных данных
 */
export function conductivityFromSlope({ slope, rc, lw, influenceLog }) {
  const C = Math.abs(slope) * MINUTES_PER_DAY;
  if (!(rc > 0) || !(lw > 0) || !(influenceLog > 0) || !(C > 0)) return NaN;
  return (STRAIGHT_LINE_FACTOR * rc * rc * C * influenceLog) / (2 * lw);
}

/**
 * Обработка экспресс-опробования способом прямой линии
 *
 * Прямая либо подбирается по всем точкам методом наименьших квадратов, либо
 * проводится через две отмеченные — так же, как на обычной откачке. Отличие
 * одно: свободный член здесь не несёт параметра, прямая по смыслу выходит из
 * начала координат.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - журнал замеров:
 *   время и восстановление уровня, см. `slugPoints`
 * @param {number} params.initialDrawdown - скачок понижения s⁰, м
 * @param {number} params.rw - радиус фильтра, м
 * @param {number} params.rc - радиус обсадной трубы, м
 * @param {number} params.lw - длина фильтра, м
 * @param {number} params.z - расстояние от УГВ до низа фильтра, м
 * @param {number} params.m - обводнённая мощность, м
 * @param {Array<number>} [params.selected] - индексы двух отмеченных точек
 * @param {{slope: number, intercept: number}} [params.freeLine] - прямая,
 *   проведённая руками; важнее и подбора, и отмеченных точек
 * @returns {{points: Array, line: Object|null, k: number, slope: number,
 *   influenceLog: number, partial: boolean, capped: boolean, beta: number,
 *   A1: number, A2: number, A3: number}} результат обработки
 */
export function processSlugTest({
  measurements,
  initialDrawdown,
  rw,
  rc,
  lw,
  z,
  m,
  selected,
  freeLine,
}) {
  const points = slugPoints(measurements, initialDrawdown);
  const radius = influenceRadiusLog({ rw, lw, z, m });

  let line = null;
  if (freeLine && isFinite(freeLine.slope)) {
    line = { ...freeLine, count: points.length };
  } else if (selected?.length === 2) {
    line = lineThroughPoints(points[selected[0]], points[selected[1]]);
  } else if (points.length >= 2) {
    line = linearRegression(points);
  }

  const slope = line ? line.slope : NaN;
  const k = conductivityFromSlope({
    slope,
    rc,
    lw,
    influenceLog: radius.value,
  });

  return {
    points,
    line,
    slope,
    k,
    influenceLog: radius.value,
    partial: radius.partial,
    capped: radius.capped,
    beta: radius.beta,
    A1: radius.A1,
    A2: radius.A2,
    A3: radius.A3,
  };
}
