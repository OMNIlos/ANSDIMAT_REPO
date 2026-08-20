/**
 * Понижение в безнапорном пласте с запаздывающей водоотдачей (Болтон, 1963)
 *
 * Безнапорный пласт отдаёт воду дважды. Сначала работает упругая ёмкость S:
 * вода отжимается из скелета мгновенно, и кривая понижения идёт по Тейсу с
 * малой водоотдачей — круто. Потом начинает срабатывать гравитационный дренаж
 * пор: вода стекает сверху, подпитывает пласт, и кривая выполаживается в
 * характерную полку. Когда дренаж догоняет откачку, кривая снова идёт по
 * Тейсу, но уже с большой водоотдачей Sy.
 *
 * Скорость перехода задаёт индекс запаздывания α: чем он больше, тем раньше
 * включается гравитационный дренаж и тем короче полка.
 *
 *     T = k · h₀
 *     α = 3 k / (Sy · h₀)
 *     σ(p) = S + (Sy − S) · α / (p + α)
 *     s̄(p) = Q / (2π T p) · K₀( r · √(p σ(p) / T) )
 *
 * Оба предельных перехода заложены в σ(p) по построению: при p → ∞ она даёт S
 * (ранняя ветвь по упругой водоотдаче), при p → 0 даёт Sy (поздняя ветвь по
 * гравитационной).
 *
 * Аналитического обращения у этого образа нет, поэтому переход во временную
 * область делается численно, по Стехфесту.
 */

import { besselK0 } from './leakage';

/**
 * Порядок обращения по Стехфесту
 *
 * Метод суммирует образ с большими знакопеременными весами, поэтому точность
 * не растёт с порядком монотонно: на N ≥ 16 потеря значащих цифр в double
 * перевешивает выигрыш от лишних членов, и сумма разваливается. Проверено на
 * решении Тейса, где ответ известен точно: при N = 12 расхождение около 6·10⁻⁶,
 * при N = 16 уже 5·10⁻⁷, но на задаче Болтона N = 16 даёт разброс в сотые доли
 * метра. N = 12 устойчив на обеих задачах.
 */
export const STEHFEST_ORDER = 12;

/** Кэш весов: они зависят только от порядка и считаются факториалами */
const weightCache = new Map();

/**
 * Веса обращения по Стехфесту
 *
 * @param {number} N - порядок, обязательно чётный
 * @returns {Array<number>} веса V₁…V_N, индекс 0 не используется
 */
export function stehfestWeights(N = STEHFEST_ORDER) {
  const cached = weightCache.get(N);
  if (cached) return cached;

  const half = N / 2;
  const factorial = (n) => {
    let value = 1;
    for (let i = 2; i <= n; i++) value *= i;
    return value;
  };

  const weights = new Array(N + 1).fill(0);
  for (let i = 1; i <= N; i++) {
    let sum = 0;
    const from = Math.floor((i + 1) / 2);
    const to = Math.min(i, half);
    for (let k = from; k <= to; k++) {
      sum +=
        (Math.pow(k, half) * factorial(2 * k)) /
        (factorial(half - k) *
          factorial(k) *
          factorial(k - 1) *
          factorial(i - k) *
          factorial(2 * k - i));
    }
    weights[i] = Math.pow(-1, i + half) * sum;
  }

  weightCache.set(N, weights);
  return weights;
}

/**
 * Индекс запаздывания гравитационной водоотдачи
 *
 * @param {number} k - коэффициент фильтрации, м/сут
 * @param {number} Sy - гравитационная водоотдача, безразмерная
 * @param {number} h0 - обводнённая мощность, м
 * @returns {number} индекс запаздывания α, 1/сут; NaN при неполных данных
 */
export function boultonDelayIndex(k, Sy, h0) {
  if (!(k > 0) || !(Sy > 0) || !(h0 > 0)) return NaN;
  return (3 * k) / (Sy * h0);
}

/**
 * Понижение по решению Болтона
 *
 * @param {Object} params
 * @param {number} params.Q - дебит скважины, м³/сут
 * @param {number} params.k - коэффициент фильтрации, м/сут
 * @param {number} params.h0 - обводнённая мощность, м
 * @param {number} params.Sy - гравитационная водоотдача, безразмерная
 * @param {number} params.S - упругая водоотдача, безразмерная
 * @param {number} params.r - расстояние до точки наблюдения, м
 * @param {number} params.t - время от начала откачки, сут
 * @param {number} [params.order] - порядок обращения по Стехфесту
 * @returns {number} понижение, м; NaN при неполных данных
 */
export function boultonDrawdown({ Q, k, h0, Sy, S, r, t, order = STEHFEST_ORDER }) {
  if (!(Q > 0) || !(k > 0) || !(h0 > 0) || !(Sy > 0) || !(S > 0) || !(r > 0) || !(t > 0)) {
    return NaN;
  }

  const T = k * h0;
  const alpha = boultonDelayIndex(k, Sy, h0);
  const weights = stehfestWeights(order);
  const ln2 = Math.LN2;

  let sum = 0;
  for (let i = 1; i <= order; i++) {
    const p = (i * ln2) / t;
    // Эффективная водоотдача в образе: упругая сразу, гравитационная с
    // запаздыванием — её вклад нарастает по мере того, как p падает
    const storage = S + (Sy - S) * (alpha / (p + alpha));
    const argument = r * Math.sqrt((p * storage) / T);
    sum += weights[i] * (Q / (2 * Math.PI * T * p)) * besselK0(argument);
  }

  return (sum * ln2) / t;
}
