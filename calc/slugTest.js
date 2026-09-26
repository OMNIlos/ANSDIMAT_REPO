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
 * а для совершенной скважины (фильтр во всю мощность, l_w = m) и для случая
 * z = m (скважина примыкает к подошве пласта) — из
 *
 *   ln(R/r_w) = [ 1.1/ln(z/r_w) + r_w·A₃/l_w ]⁻¹.
 *
 * Верхний предел выражения ln((m−z)/r_w) равен шести: при опробовании
 * пластов большой мощности вместо него подставляется число 6.
 *
 * Само z приложение не спрашивает. Фильтр и в журнале опыта, и в настольном
 * АНСДИМАТ задаётся серединой: расстоянием LT_w от уровня грунтовых вод до
 * середины фильтра (колонка «Верх/Низ», табл. П3) и длиной фильтра. Отсюда
 * z = LT_w + l_w/2, см. `filterBottom`.
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
 * Наименьшее число замеров в прямолинейном участке
 *
 * По двум точкам прямая проходит без остатка, и разбиение всегда выглядело бы
 * выгодным. Три — первое число, при котором участок ещё и проверяется.
 */
export const SEGMENT_MIN_POINTS = 3;

/**
 * Во сколько раз разбиение должно лечь лучше одной прямой
 *
 * Две прямые описывают журнал не хуже одной всегда — у них больше свободы, —
 * поэтому разбиение принимается, только когда выигрыш не спутать с разбросом
 * замеров. На опыте с настоящим изломом сумма квадратов падает в 534 раза, на
 * прямой с обычным разбросом — в 1.1; десятикратный порог разводит эти случаи
 * с запасом в обе стороны.
 */
export const SEGMENT_GAIN = 10;

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
 * Первый набор — для 1 ≤ β ≤ 200, второй — для 200 < β < 2000. Выписаны из
 * (3.3.5)—(3.3.6) АНСДИМАТ (изд. 2014, с. 270—271; они же (10.94)—(10.99)
 * «Справочника аналитических решений», 2006) со всеми знаками, какие там
 * напечатаны.
 *
 * Округлять их нельзя. Полиномы шестой степени, и слагаемые старших степеней
 * взаимно вычитаются: при β = 1000 член 1.2935074·10⁻¹⁴·β⁵ даёт 12.9, а
 * следующий за ним — минус 1.79, тогда как сам A₁ равен 9.16. Срезанный
 * восьмой знак у коэффициента пятой степени сдвигает A₁ на сотые, а k — на
 * доли процента, и результат перестаёт сходиться с настольным АНСДИМАТ.
 * `bouwerRiceCoefficients` возвращает их как есть, а сокращает только показ —
 * до ширины строки на экране, см. `formatFitting` в
 * screens/calculator/shared.js.
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
  // Сама граница отдана нижнему набору: в книге первый диапазон записан
  // как 1 ≤ β ≤ 200, а второй — как 200 < β < 2000, строгим неравенством
  const set = clamped <= BETA_SPLIT ? A_COEFFICIENTS.low : A_COEFFICIENTS.high;
  return {
    A1: polynomial(set.A1, clamped),
    A2: polynomial(set.A2, clamped),
    A3: polynomial(set.A3, clamped),
    beta: clamped,
  };
}

/**
 * Расстояние от уровня грунтовых вод до низа фильтра z
 *
 * Фильтр задан серединой, как в настольном АНСДИМАТ: LT_w — расстояние от
 * уровня грунтовых вод до середины фильтра. Низ лежит ниже неё на половину
 * длины фильтра.
 *
 * Спрашивать сразу z было ошибкой: в колонку «От УГВ до низа фильтра»
 * переносили число из колонки «Верх/Низ» настольной программы, а это разные
 * величины. На опыте с фильтром 7.9 м, отцентрованным в пласте 8 м, LT_w = 4
 * и z = 7.95 — ln(R/r_w) отличается на четверть, и вместе с ним k.
 *
 * @param {Object} params
 * @param {number} params.lt - расстояние от УГВ до середины фильтра LT_w, м
 * @param {number} params.lw - длина фильтра l_w, м
 * @returns {number} расстояние до низа фильтра z, м; NaN при неполных данных
 */
export function filterBottom({ lt, lw }) {
  if (!isFinite(lt) || !(lw > 0)) return NaN;
  return lt + lw / 2;
}

/**
 * Логарифм безразмерного радиуса влияния ln(R/r_w)
 *
 * Схема выбирается сама. Зависимость с A₁ и A₂ работает, только пока фильтр
 * несовершенный по-настоящему: и не достал до подошвы (z < m), и короче
 * пласта (l_w < m). Иначе — зависимость с A₃: она дана «для совершенной
 * скважины или для случая m = z». Формулу для несовершенной скважины при
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
 *   получен: partial — по зависимости с A₁ и A₂ для несовершенной скважины,
 *   иначе по зависимости с A₃,
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

  // Несовершенная скважина — только когда фильтр и не достал до подошвы
  // (z < m), и сам короче пласта (l_w < m). Второе условие в книге стоит
  // словами: зависимость с A₃ дана «для совершенной скважины или для случая
  // m = z», а совершенная — это и есть фильтр во всю мощность. Без проверки
  // длины фильтр l_w = m с чуть заниженным z уходил бы на A₁ и A₂, и k
  // получался близким к правде, но не тем.
  //
  // Мощность меньше z означала бы фильтр ниже подошвы — такой схемы нет, и
  // она тоже считается по A₃. Незаданная мощность — тоже: совершенная
  // скважина единственная схема, где m не нужна
  const partial = isFinite(m) && m > z && lw < m;
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
 * Сумма квадратов отклонений точек от прямой
 *
 * @param {Array<{x: number, y: number}>} points - точки
 * @param {{slope: number, intercept: number}} line - прямая
 * @returns {number} сумма квадратов
 */
function residualSum(points, line) {
  let sum = 0;
  for (const point of points) {
    sum += (point.y - line.slope * point.x - line.intercept) ** 2;
  }
  return sum;
}

/**
 * Разбиение журнала на два прямолинейных участка
 *
 * Примечание к табл. 3.1: «при наличии на графике двух прямых участков
 * обработку следует проводить по второму из них, так как первый
 * свидетельствует о нарушенной зоне вокруг скважины или о перетекании».
 * Излом ищется перебором: для каждого разреза журнала считаются две прямые и
 * берётся тот разрез, где сумма квадратов отклонений меньше всего.
 *
 * Первый участок ведётся через начало координат, второй — со свободным
 * членом. Это не произвол: первый начинается при t = 0, когда уровень ещё не
 * тронулся и lg(s⁰/s_w) равен нулю, а второй начинается посреди опыта и через
 * ноль проходить не обязан. Так же выглядит и чертёж настольного АНСДИМАТ:
 * крутая прямая из начала координат и пологая, поднятая над осью.
 *
 * Разбиение принимается, только когда оно кладётся заметно лучше одной
 * прямой, см. SEGMENT_GAIN: на журнале без излома две прямые дают тот же
 * разброс, и делить его надвое значит выдумать перелом там, где его нет.
 *
 * @param {Array<{x: number, y: number}>} points - точки графика
 * @returns {{index: number, first: Array, second: Array}|null} разбиение:
 *   index — с какого замера идёт второй участок; null, если излома нет
 */
export function splitSegments(points) {
  const all = points ?? [];
  if (all.length < 2 * SEGMENT_MIN_POINTS) return null;

  const whole = residualSum(all, regressionThroughOrigin(all));
  let best = null;
  for (
    let index = SEGMENT_MIN_POINTS;
    index <= all.length - SEGMENT_MIN_POINTS;
    index += 1
  ) {
    const first = all.slice(0, index);
    const second = all.slice(index);
    const sum =
      residualSum(first, regressionThroughOrigin(first)) +
      residualSum(second, linearRegression(second));
    if (!best || sum < best.sum) best = { index, first, second, sum };
  }

  if (!best || !(whole > best.sum * SEGMENT_GAIN)) return null;
  return { index: best.index, first: best.first, second: best.second };
}

/**
 * Прямая через начало координат методом наименьших квадратов
 *
 * Обычный МНК подбирает и свободный член, а здесь он задан: примечание к
 * табл. 3.1 требует, чтобы прямая выходила из начала координат, и это не
 * пожелание к чертежу, а само уравнение (3.3.4) — при t = 0 уровень ещё не
 * начал возвращаться, и lg(s⁰/s_w) равен нулю. Свободный член, подобранный
 * заодно с наклоном, забирает себе часть подъёма, и наклон занижается.
 *
 * R² считается относительно нуля, а не относительно среднего: у прямой без
 * свободного члена среднее не является опорным приближением, и обычная
 * формула дала бы отрицательные значения на хороших данных.
 *
 * @param {Array<{x: number, y: number}>} points - точки графика
 * @returns {{slope: number, intercept: number, r2: number, count: number}}
 *   прямая; наклон NaN, если точек меньше двух
 */
export function regressionThroughOrigin(points) {
  const valid = (points ?? []).filter((p) => isFinite(p.x) && isFinite(p.y));
  if (valid.length < 2) {
    return { slope: NaN, intercept: 0, r2: NaN, count: valid.length };
  }

  let sumXX = 0;
  let sumXY = 0;
  for (const p of valid) {
    sumXX += p.x * p.x;
    sumXY += p.x * p.y;
  }
  if (!(sumXX > 0)) {
    return { slope: NaN, intercept: 0, r2: NaN, count: valid.length };
  }

  const slope = sumXY / sumXX;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of valid) {
    ssTot += p.y * p.y;
    ssRes += (p.y - slope * p.x) ** 2;
  }
  const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : NaN;

  return { slope, intercept: 0, r2, count: valid.length };
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
 * Прямая либо подбирается сама, либо проводится через две отмеченные, либо
 * ведётся руками — так же, как на обычной откачке. Автоподбор сначала ищет
 * излом (`splitSegments`): нашёлся — считает по второму участку, как велит
 * примечание к табл. 3.1; не нашёлся — ведёт одну прямую через начало
 * координат по всему журналу. Отмеченные точки и прямая, проведённая руками,
 * — воля геолога, и она не ограничивается ничем: индексы отметок считаются по
 * всему журналу, излом на них не влияет.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - журнал замеров:
 *   время и восстановление уровня, см. `slugPoints`
 * @param {number} params.initialDrawdown - скачок понижения s⁰, м
 * @param {number} params.rw - радиус фильтра, м
 * @param {number} params.rc - радиус обсадной трубы, м
 * @param {number} params.lw - длина фильтра, м
 * @param {number} params.lt - расстояние от УГВ до середины фильтра LT_w, м
 * @param {number} params.m - обводнённая мощность, м
 * @param {Array<number>} [params.selected] - индексы двух отмеченных точек
 * @param {{slope: number, intercept: number}} [params.freeLine] - прямая,
 *   проведённая руками; важнее и подбора, и отмеченных точек
 * @returns {{points: Array, line: Object|null, k: number, slope: number,
 *   influenceLog: number, partial: boolean, capped: boolean, beta: number,
 *   A1: number, A2: number, A3: number, z: number, fit: string,
 *   split: number|null, firstK: number}} результат обработки; z — посчитанный
 *   низ фильтра, fit — чем проведена прямая ('auto', 'selected' или 'free'),
 *   split — с какого замера идёт второй участок (null, если излома нет или
 *   прямую задал геолог), firstK — коэффициент фильтрации по первому участку:
 *   в ответ он не идёт, но его показывают рядом, как настольный АНСДИМАТ
 *   подписывает на чертеже обе прямые
 */
export function processSlugTest({
  measurements,
  initialDrawdown,
  rw,
  rc,
  lw,
  lt,
  m,
  selected,
  freeLine,
}) {
  const points = slugPoints(measurements, initialDrawdown);
  const z = filterBottom({ lt, lw });
  const radius = influenceRadiusLog({ rw, lw, z, m });
  const split = splitSegments(points);

  let line = null;
  let fit = 'auto';
  if (freeLine && isFinite(freeLine.slope)) {
    line = { ...freeLine, count: points.length };
    fit = 'free';
  } else if (selected?.length === 2) {
    line = lineThroughPoints(points[selected[0]], points[selected[1]]);
    fit = 'selected';
  } else if (split) {
    // По второму участку: первый говорит о нарушенной зоне вокруг скважины
    // или о перетекании, а не о пласте
    line = linearRegression(split.second);
  } else if (points.length >= 2) {
    line = regressionThroughOrigin(points);
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
    z,
    fit,
    split: fit === 'auto' && split ? split.index : null,
    firstK:
      fit === 'auto' && split
        ? conductivityFromSlope({
            slope: regressionThroughOrigin(split.first).slope,
            rc,
            lw,
            influenceLog: radius.value,
          })
        : NaN,
    influenceLog: radius.value,
    partial: radius.partial,
    capped: radius.capped,
    beta: radius.beta,
    A1: radius.A1,
    A2: radius.A2,
    A3: radius.A3,
  };
}
