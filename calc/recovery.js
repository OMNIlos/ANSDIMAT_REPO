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
 * координат, а по его наклону a считается T = 0.183·Q/a. Проверка качества
 * опыта — та самая нулевая отсечка: заметный сдвиг говорит о влиянии границ
 * или о том, что дебит был непостоянным.
 *
 * Источник: Theis C.V. (1935); Kruseman & de Ridder, «Analysis and evaluation
 * of pumping test data», раздел Recovery tests.
 */

import { COOPER_JACOB_FACTOR, linearRegression, lineThroughPoints } from './cooperJacob';

/**
 * Переводит замеры восстановления в координаты графика Тейса
 *
 * @param {Array<{t: number, s: number}>} measurements - замеры восстановления:
 *   t — время от начала откачки, мин; s — остаточное понижение, м
 * @param {number} pumpingDuration - продолжительность откачки, мин
 * @returns {Array<{x: number, y: number, t: number, tPrime: number}>}
 *   x = lg(t/t'), y = остаточное понижение
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
      return { x: Math.log10(t / tPrime), y: s, t, tPrime };
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
 * @returns {{slope: number, intercept: number, r2: number, T: number,
 *   points: Array<Object>, count: number, warnings: string[]}}
 *   T — водопроводимость, м²/сут
 */
export function processRecovery({ measurements, Q, pumpingDuration, twoPoints }) {
  const warnings = [];
  const points = toRecoveryPoints(measurements, pumpingDuration);

  if (points.length < 2) {
    return {
      slope: NaN,
      intercept: NaN,
      r2: NaN,
      T: NaN,
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
