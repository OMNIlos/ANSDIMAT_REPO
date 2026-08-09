/**
 * Оценка фильтрационных параметров по данным опробования
 *
 * Стационарные формулы Дюпюи для одиночной скважины.
 *
 * ВАЖНО о коэффициентах прототипа.
 * В HTML-прототипе стояли формулы с зашитыми числами:
 *   безнапорный:  k = 2.43·Q / (s·(2m − s))
 *   напорный:     k = Q / (1.814·m·s)
 * Эти числа — не универсальные константы: в них неявно спрятано отношение
 * радиуса влияния к радиусу скважины R/r₀. Если раскрыть, получается
 *   напорный:     1/1.814 = 0.366·lg(R/r₀)  →  R/r₀ ≈ 32
 *   безнапорный:  2.43    = 0.732·lg(R/r₀)  →  R/r₀ ≈ 2090
 * То есть две формулы молча предполагали радиусы влияния, различающиеся
 * в 65 раз. Поэтому здесь R и r₀ вынесены в явные параметры.
 *
 * Источники формул:
 * - Дюпюи, стационарный приток к совершенной скважине (напорный и безнапорный
 *   пласт) — классика, см. Ф.М. Бочевер, «Расчёты эксплуатационных запасов
 *   подземных вод».
 * - Поправка на несовершенство по степени вскрытия — формула Козени
 *   (Kozeny), приводится в Todd & Mays, «Groundwater Hydrology».
 *
 * Вариант поправки на несовершенство в десктопной версии АНСДИМАТ может
 * отличаться — при расхождении результатов сверять именно этот блок.
 */

/** Отношение радиуса влияния к радиусу скважины по умолчанию */
export const DEFAULT_INFLUENCE_RATIO = 300;

export const AQUIFER_TYPES = {
  CONFINED: 'confined',
  UNCONFINED: 'unconfined',
};

/**
 * Коэффициент снижения дебита для скважины, несовершенной по степени вскрытия
 *
 * Формула Козени: Qp/Q = p·(1 + 7·√(r₀/(2·p·m))·cos(π·p/2)),
 * где p = l/m — доля вскрытия пласта.
 *
 * @param {number} penetrationRatio - доля вскрытия l/m в диапазоне (0, 1]
 * @param {number} wellRadius - радиус скважины r₀, м
 * @param {number} thickness - мощность пласта m, м
 * @returns {number} коэффициент в диапазоне (0, 1]; 1 для совершенной скважины
 */
export function kozenyPenetrationFactor(penetrationRatio, wellRadius, thickness) {
  const p = penetrationRatio;
  if (!isFinite(p) || p <= 0 || p >= 1) return 1;
  if (!isFinite(wellRadius) || wellRadius <= 0) return 1;
  if (!isFinite(thickness) || thickness <= 0) return 1;

  const factor = p * (1 + 7 * Math.sqrt(wellRadius / (2 * p * thickness)) * Math.cos((Math.PI * p) / 2));
  // Поправка не может увеличивать дебит выше совершенной скважины
  return Math.min(Math.max(factor, 1e-6), 1);
}

/**
 * Оценивает коэффициент фильтрации по данным опытной откачки
 *
 * Напорный пласт:    k = Q·ln(R/r₀) / (2π·m·s)
 * Безнапорный пласт: k = Q·ln(R/r₀) / (π·s·(2m − s))
 *
 * @param {Object} params
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} params.s - понижение уровня, м
 * @param {number} params.m - мощность пласта (для безнапорного — начальная
 *   мощность водоносного слоя), м
 * @param {string} params.aquiferType - 'confined' | 'unconfined'
 * @param {number} [params.R] - радиус влияния, м
 * @param {number} [params.r0] - радиус скважины, м
 * @param {boolean} [params.imperfect] - учитывать несовершенство по вскрытию
 * @param {number} [params.penetrationRatio] - доля вскрытия l/m, если imperfect
 * @returns {{k: number, formula: string, warnings: string[]}}
 *   k — коэффициент фильтрации, м/сут (NaN, если данных недостаточно)
 */
export function estimateConductivity({
  Q,
  s,
  m,
  aquiferType = AQUIFER_TYPES.CONFINED,
  R,
  r0,
  imperfect = false,
  penetrationRatio,
}) {
  const warnings = [];

  const radiusOfInfluence = isFinite(R) && R > 0 ? R : null;
  const wellRadius = isFinite(r0) && r0 > 0 ? r0 : null;

  let logTerm;
  if (radiusOfInfluence && wellRadius && radiusOfInfluence > wellRadius) {
    logTerm = Math.log(radiusOfInfluence / wellRadius);
  } else {
    logTerm = Math.log(DEFAULT_INFLUENCE_RATIO);
    warnings.push('defaultInfluenceRatio');
  }

  const isUnconfined = aquiferType === AQUIFER_TYPES.UNCONFINED;

  let k = NaN;
  let formula;

  if (isUnconfined) {
    formula = 'k = Q·ln(R/r₀) / (π·s·(2m − s))';
    const denominator = Math.PI * s * (2 * m - s);
    if (Q > 0 && s > 0 && m > 0 && denominator > 0) {
      k = (Q * logTerm) / denominator;
    }
    if (s >= m) {
      warnings.push('drawdownExceedsThickness');
    }
  } else {
    formula = 'k = Q·ln(R/r₀) / (2π·m·s)';
    const denominator = 2 * Math.PI * m * s;
    if (Q > 0 && s > 0 && m > 0 && denominator > 0) {
      k = (Q * logTerm) / denominator;
    }
  }

  if (imperfect && isFinite(k)) {
    const p = isFinite(penetrationRatio) ? penetrationRatio : NaN;
    const factor = kozenyPenetrationFactor(p, wellRadius ?? 0.1, m);
    if (factor < 1) {
      // Несовершенная скважина даёт тот же дебит при большем понижении,
      // поэтому фактическая проницаемость выше рассчитанной по формуле
      // для совершенной скважины
      k = k / factor;
      formula += ' · поправка Козени';
    } else {
      warnings.push('penetrationRatioMissing');
    }
  }

  return { k, formula, warnings };
}

/**
 * Прогноз понижения по методу Тейса
 *
 * u = r²S / (4·T·t),  s = Q/(4π·T) · W(u)
 *
 * @param {Object} params
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} params.T - водопроводимость, м²/сут
 * @param {number} params.S - упругая водоотдача (безразмерная)
 * @param {number} params.r - расстояние до точки наблюдения, м
 * @param {number} params.t - время от начала откачки, сут
 * @param {Function} wellFunction - функция скважины W(u)
 * @returns {{s: number, u: number, W: number}} понижение, м
 */
export function predictDrawdownTheis({ Q, T, S, r, t }, wellFunction) {
  if (!(Q > 0) || !(T > 0) || !(S > 0) || !(r > 0) || !(t > 0)) {
    return { s: NaN, u: NaN, W: NaN };
  }
  const u = (r * r * S) / (4 * T * t);
  const W = wellFunction(u);
  const s = (Q / (4 * Math.PI * T)) * W;
  return { s, u, W };
}

/**
 * Приток в котлован (стационарный, напорный пласт)
 *
 * Q = 2π·k·m·s₀ / ln(R/r₀)
 *
 * @param {Object} params
 * @param {number} params.k - коэффициент фильтрации, м/сут
 * @param {number} params.m - мощность пласта, м
 * @param {number} params.s0 - понижение в котловане, м
 * @param {number} params.R - радиус влияния, м
 * @param {number} params.r0 - приведённый радиус котлована, м
 * @returns {{Q: number, formula: string}} приток, м³/сут
 */
export function pitInflow({ k, m, s0, R, r0 }) {
  const formula = 'Q = 2π·k·m·s₀ / ln(R/r₀)';
  if (!(k > 0) || !(m > 0) || !(s0 > 0) || !(r0 > 0) || !(R > r0)) {
    return { Q: NaN, formula };
  }
  const Q = (2 * Math.PI * k * m * s0) / Math.log(R / r0);
  return { Q, formula };
}

/**
 * Приведённый радиус котлована прямоугольной формы
 *
 * r₀ = η·(a + b)/4, для практических расчётов принимается r₀ = √(F/π),
 * где F — площадь котлована.
 *
 * @param {number} area - площадь котлована, м²
 * @returns {number} приведённый радиус, м
 */
export function equivalentPitRadius(area) {
  if (!(area > 0)) return NaN;
  return Math.sqrt(area / Math.PI);
}
