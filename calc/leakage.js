/**
 * Пласт с перетеканием — инфильтрационные утечки через разделяющий слой
 *
 * Напорный пласт редко изолирован полностью: через слабопроницаемую кровлю
 * (суглинок, слабо трещиноватые породы) в него подтекает вода из смежного
 * горизонта. Чем сильнее откачка сажает уровень, тем больше перепад и тем
 * интенсивнее перетекание — воронка перестаёт углубляться и стабилизируется.
 *
 * Мера явления — фактор перетекания
 *   B = √(T·m' / k'),
 * где m' и k' — мощность и коэффициент фильтрации разделяющего слоя.
 * Чем меньше B, тем сильнее перетекание.
 *
 * Нестационарное решение — Хантуш и Джейкоб (1955):
 *   s = Q/(4πT) · W(u, r/B),
 *   W(u, β) = ∫ (1/y)·exp(−y − β²/(4y)) dy от u до ∞.
 * Стационарный предел — Де Глее (1930):
 *   s = Q/(2πT) · K₀(r/B).
 *
 * Источники: Hantush M.S., Jacob C.E. «Non-steady radial flow in an infinite
 * leaky aquifer»; Kruseman & de Ridder, «Analysis and evaluation of pumping
 * test data»; приближения Бесселя — Абрамовиц и Стиган, 9.8.5 и 9.8.6.
 */

/** Коэффициенты A&S 9.8.5: I₀(x) при |x| ≤ 3.75 (аргумент t = x/3.75) */
const I0_A = [1.0, 3.5156229, 3.0899424, 1.2067492, 0.2659732, 0.0360768, 0.0045813];

/** Коэффициенты A&S 9.8.6: K₀(x) при 0 < x ≤ 2 (аргумент t = x²/4) */
const K0_A = [-0.57721566, 0.42278420, 0.23069756, 0.03488590, 0.00262698, 0.00010750, 0.0000074];

/** Коэффициенты A&S 9.8.6: K₀(x) при x ≥ 2 (аргумент t = 2/x) */
const K0_B = [1.25331414, -0.07832358, 0.02189568, -0.01062446, 0.00587872, -0.00251540, 0.00053208];

/**
 * Модифицированная функция Бесселя первого рода I₀(x)
 *
 * Нужна только внутри разложения K₀ при малых x.
 *
 * @param {number} x - аргумент, x ≥ 0
 * @returns {number} значение I₀(x)
 */
function besselI0(x) {
  const t = x / 3.75;
  const t2 = t * t;
  let sum = 0;
  for (let i = I0_A.length - 1; i >= 0; i--) {
    sum = sum * t2 + I0_A[i];
  }
  return sum;
}

/**
 * Модифицированная функция Бесселя второго рода K₀(x)
 *
 * @param {number} x - аргумент, должен быть > 0
 * @returns {number} значение K₀(x); NaN при недопустимом аргументе
 */
export function besselK0(x) {
  if (!isFinite(x) || x <= 0) return NaN;

  if (x <= 2) {
    // A&S 9.8.5: K₀(x) = −ln(x/2)·I₀(x) + Σ aᵢ·(x²/4)ⁱ
    const t = (x * x) / 4;
    let sum = 0;
    for (let i = K0_A.length - 1; i >= 0; i--) {
      sum = sum * t + K0_A[i];
    }
    return -Math.log(x / 2) * besselI0(x) + sum;
  }

  // A&S 9.8.6: K₀(x) = e^(−x)/√x · Σ bᵢ·(2/x)ⁱ
  const t = 2 / x;
  let sum = 0;
  for (let i = K0_B.length - 1; i >= 0; i--) {
    sum = sum * t + K0_B[i];
  }
  return (Math.exp(-x) / Math.sqrt(x)) * sum;
}

/**
 * Фактор перетекания B
 *
 * B = √(T·m'/k'). Размерность — метры: это характерное расстояние, на котором
 * перетекание успевает восполнить откачку.
 *
 * @param {Object} params
 * @param {number} params.T - водопроводимость основного пласта, м²/сут
 * @param {number} params.aquitardThickness - мощность разделяющего слоя m', м
 * @param {number} params.aquitardK - коэффициент фильтрации слоя k', м/сут
 * @returns {number} фактор перетекания B, м; NaN при неполных данных
 */
export function leakageFactor({ T, aquitardThickness, aquitardK }) {
  if (!(T > 0) || !(aquitardThickness > 0) || !(aquitardK > 0)) return NaN;
  return Math.sqrt((T * aquitardThickness) / aquitardK);
}

/**
 * Функция Хантуша W(u, β)
 *
 * Интеграл ∫ exp(−y − β²/(4y))/y dy от u до ∞ берётся численно: подынтегральная
 * функция гладкая и быстро затухает, поэтому достаточно составной формулы
 * Симпсона по логарифмической сетке. При β = 0 выражение вырождается в обычную
 * функцию скважины Тейса.
 *
 * @param {number} u - параметр u = r²S/(4Tt), должен быть > 0
 * @param {number} beta - параметр β = r/B, должен быть ≥ 0
 * @returns {number} значение W(u, β); NaN при недопустимых аргументах
 */
export function hantushWellFunction(u, beta) {
  if (!isFinite(u) || u <= 0 || !isFinite(beta) || beta < 0) return NaN;

  const b2 = (beta * beta) / 4;

  // Верхний предел: интегрируем, пока exp(−y) не уйдёт ниже точности double
  const upper = Math.max(u * 1e3, 40 + b2 / Math.max(u, 1e-12));

  // Логарифмическая замена y = e^z: dy = y·dz, подынтегральное выражение
  // становится exp(−y − β²/(4y)) — без особенности 1/y у нижнего предела
  const z0 = Math.log(u);
  const z1 = Math.log(upper);
  if (!(z1 > z0)) return 0;

  const steps = 2000;
  const h = (z1 - z0) / steps;

  /**
   * @param {number} z - логарифм переменной интегрирования
   * @returns {number} значение подынтегрального выражения
   */
  const f = (z) => {
    const y = Math.exp(z);
    return Math.exp(-y - b2 / y);
  };

  let sum = f(z0) + f(z1);
  for (let i = 1; i < steps; i++) {
    sum += f(z0 + i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return (h / 3) * sum;
}

/**
 * Нестационарное понижение в пласте с перетеканием (Хантуш — Джейкоб)
 *
 * @param {Object} params
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} params.T - водопроводимость, м²/сут
 * @param {number} params.S - упругая водоотдача (безразмерная)
 * @param {number} params.r - расстояние до точки наблюдения, м
 * @param {number} params.t - время от начала откачки, сут
 * @param {number} params.B - фактор перетекания, м
 * @returns {{s: number, u: number, beta: number, W: number}} понижение, м
 */
export function leakyDrawdown({ Q, T, S, r, t, B }) {
  if (!(Q > 0) || !(T > 0) || !(S > 0) || !(r > 0) || !(t > 0) || !(B > 0)) {
    return { s: NaN, u: NaN, beta: NaN, W: NaN };
  }
  const u = (r * r * S) / (4 * T * t);
  const beta = r / B;
  const W = hantushWellFunction(u, beta);
  return { s: (Q / (4 * Math.PI * T)) * W, u, beta, W };
}

/**
 * Стационарное понижение в пласте с перетеканием (Де Глее)
 *
 * s = Q/(2πT) · K₀(r/B) — предел нестационарного решения при больших временах.
 *
 * @param {Object} params
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} params.T - водопроводимость, м²/сут
 * @param {number} params.r - расстояние до точки наблюдения, м
 * @param {number} params.B - фактор перетекания, м
 * @returns {{s: number, beta: number, formula: string}} понижение, м
 */
export function steadyLeakyDrawdown({ Q, T, r, B }) {
  const formula = 's = Q/(2πT) · K₀(r/B)';
  if (!(Q > 0) || !(T > 0) || !(r > 0) || !(B > 0)) {
    return { s: NaN, beta: NaN, formula };
  }
  const beta = r / B;
  return { s: (Q / (2 * Math.PI * T)) * besselK0(beta), beta, formula };
}

/**
 * Интенсивность вертикального перетекания через разделяющий слой
 *
 * По закону Дарси при перепаде напора, равном понижению:
 *   w = k'·s / m'   — модуль утечки, м/сут (расход с 1 м² площади).
 *
 * @param {Object} params
 * @param {number} params.s - понижение в основном пласте, м
 * @param {number} params.aquitardThickness - мощность слоя m', м
 * @param {number} params.aquitardK - коэффициент фильтрации слоя k', м/сут
 * @param {number} [params.area] - площадь, по которой считать расход, м²
 * @returns {{rate: number, total: number, formula: string}}
 *   rate — модуль утечки, м/сут; total — расход по площади, м³/сут
 */
export function leakageRate({ s, aquitardThickness, aquitardK, area }) {
  const formula = "w = k'·s / m'";
  if (!(s > 0) || !(aquitardThickness > 0) || !(aquitardK > 0)) {
    return { rate: NaN, total: NaN, formula };
  }
  const rate = (aquitardK * s) / aquitardThickness;
  const total = area > 0 ? rate * area : NaN;
  return { rate, total, formula };
}
