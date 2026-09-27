/**
 * Обработка восстановления уровня (метод Тейса)
 *
 * ТЗ требует вид опробования «откачка/восстановление». Восстановление —
 * вторая половина опыта: насос остановлен, уровень поднимается обратно.
 * Замеры на восстановлении обрабатывать выгодно: насос не работает,
 * колебания дебита уже ничего не портят, и оценка T получается устойчивее.
 *
 * Остаточное понижение считается наложением двух скважин — реальной,
 * работающей с дебитом Q с начала опыта, и фиктивной нагнетательной с тем же
 * дебитом, включённой в момент остановки:
 *   s' = Q/(4πT) · [W(u) − W(u')].
 * При малых u обе функции переходят в логарифмы, и остаётся
 *   s' = 0.183·Q/T · lg(t/t'),
 * где t — время от начала откачки, t' — время от остановки насоса.
 *
 * То есть график «s' — lg(t/t')» прямолинеен и проходит через начало
 * координат, а по его наклону C считается T = 0.183·Q/C.
 *
 * Пьезопроводность одним наклоном не берётся: отсечка A на этом графике
 * отвечает не за a, а за отношение водоотдач при откачке и восстановлении.
 * Зато в квазистационарный режим на конец откачки входит та же прямая, и
 * понижение на остановке насоса s₀ замыкает недостающее уравнение — см.
 * `diffusivityFromRecovery`. Отсюда же и водоотдача: S = T/a.
 *
 * Источники: Theis C.V. (1935); Kruseman & de Ridder, «Analysis and evaluation
 * of pumping test data», раздел Recovery tests; АНСДИМАТ, табл. 3.13
 * (разд. 3.6.1.1.1) — графоаналитическая обработка восстановления.
 */

import {
  COOPER_JACOB_FACTOR,
  LG_MINUTES_PER_DAY,
  linearRegression,
  lineThroughPoints,
} from './cooperJacob';

/**
 * Пьезопроводность по прямой восстановления
 *
 * Табл. 3.13 АНСДИМАТ, график s — lg((t₀+t′)/t′), примечание (3) (зависимость
 * из работы Боревского и др., 1973):
 *   lg a = lg(r²/2.25) + s₀/C − lg t₀,   время в сутках.
 *
 * Откуда она берётся. Наклон прямой восстановления C = 0.183·Q/T — тот же
 * самый, что у прямой Купера — Джейкоба на откачке, а понижение на момент
 * остановки насоса лежит на этой прямой: s₀ = C·lg(2.25·a·t₀/r²). Одно
 * уравнение, одно неизвестное — остаётся выразить a.
 *
 * Почему не из отсечки, как на откачке. Прямая восстановления обязана
 * проходить через начало координат: при t′ → ∞ отношение (t₀+t′)/t′ → 1, и
 * логарифм обращается в ноль вместе с остаточным понижением. Отсечка тут
 * поэтому несёт не пьезопроводность, а расхождение водоотдач, см.
 * `storageRatioFromIntercept`.
 *
 * @param {Object} params
 * @param {number} params.slope - наклон прямой C, м на логарифмический цикл
 * @param {number} params.finalDrawdown - понижение на конец откачки s₀, м
 * @param {number} params.pumpingDuration - продолжительность откачки t₀, мин
 * @param {number} params.r - расстояние до наблюдательной скважины, м;
 *   у самой опытной — её радиус r₀
 * @returns {number} пьезопроводность a, м²/сут; NaN при неполных данных
 */
export function diffusivityFromRecovery({
  slope,
  finalDrawdown,
  pumpingDuration,
  r,
}) {
  const C = Math.abs(slope);
  if (!(C > 1e-9) || !isFinite(C)) return NaN;
  if (!(r > 0) || !(finalDrawdown > 0) || !(pumpingDuration > 0)) return NaN;

  // Формула написана для времени в сутках, журнал ведётся в минутах
  const logA =
    Math.log10((r * r) / 2.25) +
    finalDrawdown / C -
    (Math.log10(pumpingDuration) - LG_MINUTES_PER_DAY);

  const a = Math.pow(10, logA);
  return isFinite(a) && a > 0 ? a : NaN;
}

/**
 * Отношение водоотдач при откачке и восстановлении по отсечке прямой
 *
 * Табл. 3.13 АНСДИМАТ: S/S′ = 10^(A/C). Единица означает, что пласт отдаёт и
 * принимает воду одинаково, — тогда прямая и выходит из начала координат.
 * Уход от единицы читается двояко (Jacob, 1963; Шестаков, 1973): либо
 * водоотдача при восстановлении и правда другая, либо неверно замерен
 * статический уровень.
 *
 * @param {number} slope - наклон прямой C
 * @param {number} intercept - отсечка A на оси ординат
 * @returns {number} отношение S/S′; NaN при неполных данных
 */
export function storageRatioFromIntercept(slope, intercept) {
  const C = Math.abs(slope);
  if (!(C > 1e-9) || !isFinite(C) || !isFinite(intercept)) return NaN;
  const ratio = Math.pow(10, intercept / C);
  return isFinite(ratio) && ratio > 0 ? ratio : NaN;
}

/**
 * Переводит замеры восстановления в координаты графика Тейса
 *
 * @param {Array<{t: number, s: number, row?: string}>} measurements - замеры
 *   восстановления: t — время от начала откачки, мин; s — остаточное
 *   понижение, м; row — строка журнала, из которой взят замер
 * @param {number} pumpingDuration - продолжительность откачки, мин
 * @returns {Array<{x: number, y: number, t: number, tPrime: number,
 *   row?: string}>} x = lg(t/t'), y = остаточное понижение
 */
export function toRecoveryPoints(measurements, pumpingDuration) {
  if (!Array.isArray(measurements) || !(pumpingDuration > 0)) return [];

  return measurements
    .map((m) => {
      const t = Number(m.t);
      const s = Number(m.s);
      // Время от остановки насоса
      const tPrime = t - pumpingDuration;
      if (!isFinite(t) || !isFinite(s) || !(tPrime > 0) || !(t > 0)) return null;
      // Замеры до остановки насоса отсюда выпадают, поэтому точка помнит свою
      // строку журнала: по номеру в этом ряду таблица нашла бы не ту строку
      return { x: Math.log10(t / tPrime), y: s, t, tPrime, row: m.row };
    })
    .filter(Boolean);
}

/**
 * Обрабатывает замеры восстановления уровня
 *
 * Прямая проводится либо методом наименьших квадратов по всем точкам, либо
 * через две выбранные — так же, как на графике понижения.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - замеры
 * @param {number} params.Q - дебит откачки, м³/сут
 * @param {number} params.pumpingDuration - продолжительность откачки, мин
 * @param {Array<{x: number, y: number}>} [params.twoPoints] - две точки для
 *   построения прямой вручную
 * @param {number} [params.r] - расстояние до наблюдательной скважины, м
 * @param {number} [params.finalDrawdown] - понижение на конец откачки s₀, м
 * @returns {{slope: number, intercept: number, r2: number, T: number, a: number,
 *   S: number, storageRatio: number, points: Array<Object>, count: number,
 *   warnings: string[]}}
 *   T — водопроводимость, м²/сут; a — пьезопроводность, м²/сут; S — водоотдача
 */
export function processRecovery({
  measurements,
  Q,
  pumpingDuration,
  twoPoints,
  r,
  finalDrawdown,
}) {
  const warnings = [];
  const points = toRecoveryPoints(measurements, pumpingDuration);

  if (points.length < 2) {
    return {
      slope: NaN,
      intercept: NaN,
      r2: NaN,
      T: NaN,
      a: NaN,
      S: NaN,
      storageRatio: NaN,
      points,
      count: points.length,
      warnings: [...warnings, 'needMoreMeasurements'],
    };
  }

  const manual = Array.isArray(twoPoints) && twoPoints.length === 2;
  const line = manual
    ? { ...lineThroughPoints(twoPoints[0], twoPoints[1]), r2: NaN }
    : linearRegression(points);

  const { slope, intercept } = line;
  const T = Q > 0 && isFinite(slope) && Math.abs(slope) > 1e-9
    ? (COOPER_JACOB_FACTOR * Q) / Math.abs(slope)
    : NaN;

  // Пьезопроводность требует расстояния и понижения на остановке насоса:
  // одного наклона ей мало, см. diffusivityFromRecovery
  const a = diffusivityFromRecovery({
    slope,
    finalDrawdown,
    pumpingDuration,
    r,
  });
  const S = isFinite(T) && a > 0 ? T / a : NaN;
  const storageRatio = storageRatioFromIntercept(slope, intercept);

  // Прямая восстановления обязана проходить через начало координат:
  // при t → ∞ отношение t/t' → 1, и остаточное понижение исчезает
  if (isFinite(intercept) && isFinite(slope) && Math.abs(slope) > 1e-9) {
    if (Math.abs(intercept) > 0.1 * Math.abs(slope)) {
      warnings.push('recoveryInterceptNotZero');
    }
  }

  return {
    slope,
    intercept,
    r2: line.r2 ?? NaN,
    T,
    a,
    S,
    storageRatio,
    points,
    count: points.length,
    warnings,
  };
}

/**
 * Оценивает полноту восстановления уровня
 *
 * Практический критерий завершённости опыта: уровень считают восстановленным,
 * когда остаточное понижение упало ниже 5 % от максимального понижения на
 * откачке.
 *
 * @param {number} residualDrawdown - последнее остаточное понижение, м
 * @param {number} maxDrawdown - максимальное понижение на откачке, м
 * @returns {{ratio: number, complete: boolean}} доля невосстановленного
 *   уровня и признак завершённости
 */
export function recoveryCompleteness(residualDrawdown, maxDrawdown) {
  if (!(maxDrawdown > 0) || !isFinite(residualDrawdown)) {
    return { ratio: NaN, complete: false };
  }
  const ratio = Math.abs(residualDrawdown) / maxDrawdown;
  return { ratio, complete: ratio <= 0.05 };
}
