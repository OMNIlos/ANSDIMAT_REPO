/**
 * Оценка параметров пласта по удельному дебиту
 *
 * Вкладка «Проводимость» диалога «Оценка параметров» настольного АНСДИМАТ:
 * по дебиту и понижению в опытной скважине — водопроводимость напорного
 * пласта или коэффициент фильтрации безнапорного. Границы и перетекание не
 * рассматриваются.
 *
 * Числа 1,22 и 2,43 — не универсальные константы: в них спрятано типичное
 * отношение радиуса влияния к радиусу скважины, ln(R/r_w) ≈ 7,67. Это оценка
 * порядка величины по одному замеру, а не обработка журнала. Формулы взяты из
 * настольной версии один в один, чтобы результаты сходились с ней.
 *
 * Поправка f на несовершенство скважины — ряд из справки настольной версии:
 *
 *   f = 4m²/(π²·l_w²) · Σ 1/n² · (sin(nπz₁/m) − sin(nπz₂/m))² · K₀(χ·nπr_w/m)
 *
 * z₁, z₂ — расстояния до верха и низа фильтра, χ = √(k_z/k_r). В поле
 * вводится одно z_w — расстояние до середины фильтра: только при таком
 * прочтении расчёт совпадает с настольной версией (31.44454 на примере из
 * справки; если считать z_w верхом или низом фильтра, выходит 31.45592).
 */

import { besselK0 } from './leakage';

export const AQUIFERS = {
  CONFINED: 'confined',
  UNCONFINED: 'unconfined',
};

/** Множитель напорного пласта: T = 1.22·Q/s */
const CONFINED_FACTOR = 1.22;

/** Множитель безнапорного пласта: k = 2.43·Q/(s·(2m − s)) */
const UNCONFINED_FACTOR = 2.43;

/** Аргумент K₀, за которым члены ряда пренебрежимы: K₀(40) ≈ 8·10⁻¹⁹ */
const ARGUMENT_LIMIT = 40;

/**
 * Сколько членов ряда суммировать напрямую
 *
 * Для тонкого фильтра в мощном пласте до пренебрежимого K₀ нужны сотни тысяч
 * членов. Дальше лимита хвост оценивается интегралом — сверено с прямым
 * суммированием: расхождение порядка 10⁻¹⁰ относительных.
 */
export const MAX_TERMS = 20000;

/** Шагов формулы Симпсона в оценке хвоста (обязательно чётное) */
const TAIL_STEPS = 400;

/** Допуск сравнения границ фильтра с границами пласта, м */
const EPSILON = 1e-9;

const FORMULAS = {
  [AQUIFERS.CONFINED]: {
    perfect: 'T = 1.22·Q/sw',
    imperfect: 'T = (1.22 + f/4π)·Q/sw',
  },
  [AQUIFERS.UNCONFINED]: {
    perfect: 'k = 2.43·Q / (sw·(2m − sw))',
    imperfect: 'k = Q / (sw·(2m − sw)) · (2.43 + f/2π)',
  },
};

/**
 * Положительное конечное число
 *
 * @param {*} value - значение
 * @returns {boolean} годится ли как длина, расход или понижение
 */
const positive = (value) => Number.isFinite(value) && value > 0;

/**
 * Хвост ряда после `terms` членов
 *
 * Σₙ₌ₜ₊₁^∞ (sin nα − sin nβ)²/n² · K₀(cn). Синусы при больших n осциллируют,
 * и среднее квадрата их разности равно 1, а медленно меняющийся множитель
 * K₀(cn)/n² заменяется интегралом: c·∫ K₀(u)/u² du от c·(terms + ½) до
 * предела. Подстановка u = eᵗ выравнивает шаг по логарифмической шкале.
 *
 * @param {number} c - χ·π·r_w/m
 * @param {number} terms - сколько членов уже просуммировано
 * @returns {number} оценка хвоста
 */
function seriesTail(c, terms) {
  const from = c * (terms + 0.5);
  if (from >= ARGUMENT_LIMIT) return 0;

  const a = Math.log(from);
  const h = (Math.log(ARGUMENT_LIMIT) - a) / TAIL_STEPS;

  let sum = 0;
  for (let i = 0; i <= TAIL_STEPS; i++) {
    const u = Math.exp(a + i * h);
    const weight = i === 0 || i === TAIL_STEPS ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight * (besselK0(u) / u);
  }
  return (c * sum * h) / 3;
}

/**
 * Поправка f на несовершенство скважины
 *
 * @param {Object} params
 * @param {number} params.m - мощность пласта (у безнапорного — начальная обводнённая), м
 * @param {number} params.lw - длина фильтра, м
 * @param {number} params.zw - от кровли (у безнапорного — от статического уровня) до середины фильтра, м
 * @param {number} params.rw - радиус скважины, м
 * @param {number} [params.anisotropy] - k_z/k_r
 * @param {Object} [options]
 * @param {number} [options.maxTerms] - сколько членов суммировать напрямую
 * @returns {number} f; NaN, если геометрия невозможна
 */
export function imperfectionTerm({ m, lw, zw, rw, anisotropy = 1 }, { maxTerms = MAX_TERMS } = {}) {
  if (![m, lw, rw, anisotropy].every(positive) || !Number.isFinite(zw)) return NaN;

  const z1 = zw - lw / 2;
  const z2 = zw + lw / 2;
  if (z1 < -EPSILON || z2 > m + EPSILON) return NaN;

  const c = (Math.sqrt(anisotropy) * Math.PI * rw) / m;
  const needed = Math.ceil(ARGUMENT_LIMIT / c);
  const terms = Math.min(needed, maxTerms);
  const alpha = (Math.PI * z1) / m;
  const beta = (Math.PI * z2) / m;

  let sum = 0;
  for (let n = 1; n <= terms; n++) {
    const d = Math.sin(n * alpha) - Math.sin(n * beta);
    sum += ((d * d) / (n * n)) * besselK0(c * n);
  }
  if (needed > terms) sum += seriesTail(c, terms);

  return ((4 * m * m) / (Math.PI * Math.PI * lw * lw)) * sum;
}

/**
 * Водопроводимость или коэффициент фильтрации по удельному дебиту
 *
 * @param {Object} params
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} params.s - понижение в опытной скважине, м
 * @param {string} [params.aquifer] - AQUIFERS.CONFINED | AQUIFERS.UNCONFINED
 * @param {boolean} [params.imperfect] - учитывать несовершенство скважины
 * @param {number} [params.m] - мощность пласта, м: у безнапорного всегда, у напорного — для несовершенной
 * @param {number} [params.lw] - длина фильтра, м
 * @param {number} [params.zw] - до середины фильтра, м
 * @param {number} [params.rw] - радиус скважины, м
 * @param {number} [params.anisotropy] - k_z/k_r
 * @returns {{quantity: string, value: number, secondary: number, f: number,
 *   formula: string, invalid: string[], errors: string[], warnings: string[]}}
 *   value — T, м²/сут, или k, м/сут; NaN, если считать нечего
 */
export function estimateFromSpecificCapacity({
  Q,
  s,
  aquifer = AQUIFERS.CONFINED,
  imperfect = false,
  m,
  lw,
  zw,
  rw,
  anisotropy = 1,
}) {
  const unconfined = aquifer === AQUIFERS.UNCONFINED;
  const invalid = [];
  const errors = [];
  const warnings = [];
  const result = {
    quantity: unconfined ? 'k' : 'T',
    value: NaN,
    secondary: NaN,
    f: NaN,
    formula: FORMULAS[unconfined ? AQUIFERS.UNCONFINED : AQUIFERS.CONFINED][
      imperfect ? 'imperfect' : 'perfect'
    ],
    invalid,
    errors,
    warnings,
  };

  if (!positive(Q)) invalid.push('Q');
  if (!positive(s)) invalid.push('s');
  if ((unconfined || imperfect) && !positive(m)) invalid.push('m');
  if (imperfect) {
    if (!positive(lw)) invalid.push('lw');
    if (!Number.isFinite(zw) || zw < 0) invalid.push('zw');
    if (!positive(rw)) invalid.push('rw');
    if (!positive(anisotropy)) invalid.push('anisotropy');
  }
  if (invalid.length) return result;

  if (unconfined && s >= m) {
    errors.push('drawdownExceedsThickness');
    return result;
  }

  let f = 0;
  if (imperfect) {
    if (zw - lw / 2 < -EPSILON || zw + lw / 2 > m + EPSILON) {
      errors.push('filterOutsideAquifer');
      return result;
    }
    // Фильтр на всю мощность — это уже совершенная скважина: ряд обнуляется
    // сам, а предупреждение объясняет, почему тумблер ничего не меняет
    if (lw >= m - EPSILON) warnings.push('filterFullThickness');
    f = imperfectionTerm({ m, lw, zw, rw, anisotropy });
    result.f = f;
  }

  if (unconfined) {
    result.value = (Q / (s * (2 * m - s))) * (UNCONFINED_FACTOR + f / (2 * Math.PI));
    result.secondary = result.value * m;
  } else {
    result.value = (CONFINED_FACTOR + f / (4 * Math.PI)) * (Q / s);
    result.secondary = imperfect ? result.value / m : NaN;
  }

  return result;
}
