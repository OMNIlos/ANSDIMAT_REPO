/**
 * Приток подземных вод в котлован или карьер
 *
 * Порт расчётного ядра веб-калькулятора АНСДИМАТ. Стационарные формулы
 * Дюпюи и Дюпюи–Тима: выработка любой формы заменяется «большим колодцем»
 * равновеликой площади, и приток считается как к одиночной скважине радиуса r₀.
 *
 * Схем четыре — напорный и безнапорный пласт, каждый неограниченный или у реки.
 * Река входит границей I рода: методом зеркального отображения она даёт
 * эквивалентный радиус влияния R = 2L, то есть контур питания вместо
 * условной границы депрессии.
 *
 * Радиус влияния — самое спорное место расчёта: строгого решения у него нет,
 * и разные школы дают разброс в разы. Поэтому здесь собраны все ходовые
 * формулы, а `compareR` показывает их рядом: пользователю честнее видеть
 * разброс оценки, чем одно число без контекста.
 */

const PI = Math.PI;

/**
 * Проверяет, что значение — конечное число
 *
 * @param {*} x - проверяемое значение
 * @returns {boolean} true, если это конечное число
 */
function isNum(x) {
  return typeof x === 'number' && isFinite(x);
}

/**
 * Приведённый радиус по площади выработки
 *
 * Круг равновеликой площади: F = π r₀².
 *
 * @param {number} F - площадь котлована, м²
 * @returns {number} приведённый радиус, м; NaN при недопустимой площади
 */
export function r0FromArea(F) {
  if (!(F > 0)) return NaN;
  return Math.sqrt(F / PI);
}

/**
 * Приведённый радиус прямоугольной выработки по равновеликой площади
 *
 * @param {number} length - длина котлована, м
 * @param {number} width - ширина котлована, м
 * @returns {number} приведённый радиус, м; NaN при недопустимых размерах
 */
export function r0FromRect(length, width) {
  if (!(length > 0 && width > 0)) return NaN;
  return Math.sqrt((length * width) / PI);
}

/**
 * Приведённый радиус по Форхгеймеру (CIRIA C750)
 *
 * r₀ = (L + B) / π. Для вытянутых котлованов точнее равновеликой площади:
 * приток идёт через периметр, а не через площадь, и у длинной узкой траншеи
 * равновеликий круг занижает его.
 *
 * @param {number} length - длина котлована, м
 * @param {number} width - ширина котлована, м
 * @returns {number} приведённый радиус, м; NaN при недопустимых размерах
 */
export function r0Forchheimer(length, width) {
  if (!(length > 0 && width > 0)) return NaN;
  return (length + width) / PI;
}

/**
 * Площадь по приведённому радиусу
 *
 * @param {number} r0 - приведённый радиус, м
 * @returns {number} площадь, м²; NaN при недопустимом радиусе
 */
export function areaFromR0(r0) {
  if (!(r0 > 0)) return NaN;
  return PI * r0 * r0;
}

/**
 * Радиус влияния по Веригину: R = √(π a t)
 *
 * @param {number} a - пьезопроводность, м²/сут
 * @param {number} t - время работы дренажа, сут
 * @returns {number} радиус влияния, м; NaN при неполных данных
 */
export function R_verigin(a, t) {
  if (!(a > 0 && t > 0)) return NaN;
  return Math.sqrt(PI * a * t);
}

/**
 * Радиус влияния от центра котлована: R = r₀ + √(π a t)
 *
 * Основной метод расчёта. Отсчёт ведётся от стенки выработки, а не от точки,
 * поэтому к пути возмущения добавляется сам приведённый радиус.
 *
 * @param {number} a - пьезопроводность, м²/сут
 * @param {number} t - время работы дренажа, сут
 * @param {number} r0 - приведённый радиус, м
 * @returns {number} радиус влияния, м; NaN при неполных данных
 */
export function R_fromWall(a, t, r0) {
  if (!(a > 0 && t > 0 && r0 > 0)) return NaN;
  return r0 + Math.sqrt(PI * a * t);
}

/**
 * Радиус влияния по Кусакину для безнапорного пласта: R = 2 S √(k H)
 *
 * @param {number} S - понижение в котловане, м
 * @param {number} k - коэффициент фильтрации, м/сут
 * @param {number} H - мощность водоносного пласта, м
 * @returns {number} радиус влияния, м; NaN при неполных данных
 */
export function R_kusakin(S, k, H) {
  if (!(S > 0 && k > 0 && H > 0)) return NaN;
  return 2 * S * Math.sqrt(k * H);
}

/**
 * Радиус влияния по Кусакину для напорного пласта: R = 10 S √k
 *
 * @param {number} S - понижение, м
 * @param {number} k - коэффициент фильтрации, м/сут
 * @returns {number} радиус влияния, м; NaN при неполных данных
 */
export function R_kusakinConfined(S, k) {
  if (!(S > 0 && k > 0)) return NaN;
  return 10 * S * Math.sqrt(k);
}

/**
 * Радиус влияния по Зихардту: R = 3000 S √k, где k в м/с
 *
 * Европейская практика водопонижения (CIRIA). Формула записана для k в метрах
 * в секунду, поэтому здесь переводим из принятых в приложении м/сут.
 *
 * @param {number} S - понижение, м
 * @param {number} kDay - коэффициент фильтрации, м/сут
 * @returns {number} радиус влияния, м; NaN при неполных данных
 */
export function R_sichardt(S, kDay) {
  if (!(S > 0 && kDay > 0)) return NaN;
  return 3000 * S * Math.sqrt(kDay / 86400);
}

/**
 * Радиус влияния по Веберу: R = 3 √(k H t / μ)
 *
 * @param {number} k - коэффициент фильтрации, м/сут
 * @param {number} H - мощность пласта, м
 * @param {number} t - время, сут
 * @param {number} mu - гравитационная водоотдача, безразмерная
 * @returns {number} радиус влияния, м; NaN при неполных данных
 */
export function R_weber(k, H, t, mu) {
  if (!(k > 0 && H > 0 && t > 0 && mu > 0)) return NaN;
  return 3 * Math.sqrt((k * H * t) / mu);
}

/**
 * Эквивалентный радиус влияния для границы I рода: R = 2L
 *
 * Метод зеркального отображения: река заменяется фиктивной поглощающей
 * выработкой по другую сторону границы на том же расстоянии.
 *
 * @param {number} L - расстояние от центра котлована до реки, м
 * @returns {number} эквивалентный радиус влияния, м; NaN при недопустимом L
 */
export function R_image(L) {
  if (!(L > 0)) return NaN;
  return 2 * L;
}

/**
 * Логарифмический член формулы Дюпюи: ln(R / r₀)
 *
 * @param {number} R - радиус влияния, м
 * @param {number} r0 - приведённый радиус, м
 * @returns {number} значение логарифма; NaN, если контур внутри выработки
 */
export function lnThiem(R, r0) {
  if (!(R > r0 && r0 > 0)) return NaN;
  return Math.log(R / r0);
}

/**
 * Приток в напорном пласте (Дюпюи — Тим): Q = 2π k m S / ln(R/r₀)
 *
 * @param {number} k - коэффициент фильтрации, м/сут
 * @param {number} m - мощность напорного пласта, м
 * @param {number} S - понижение в котловане, м
 * @param {number} lnTerm - значение ln(R/r₀)
 * @returns {number} приток, м³/сут; NaN при неполных данных
 */
export function Q_confined(k, m, S, lnTerm) {
  if (!(k > 0 && m > 0 && S > 0 && lnTerm > 0)) return NaN;
  return (2 * PI * k * m * S) / lnTerm;
}

/**
 * Приток в безнапорном пласте (Дюпюи): Q = π k (h₀² − h_w²) / ln(R/r₀)
 *
 * @param {number} k - коэффициент фильтрации, м/сут
 * @param {number} h0 - начальная мощность потока, м
 * @param {number} S - понижение в котловане, м
 * @param {number} lnTerm - значение ln(R/r₀)
 * @returns {number} приток, м³/сут; NaN при неполных данных
 */
export function Q_unconfined(k, h0, S, lnTerm) {
  if (!(k > 0 && h0 > 0 && S > 0 && lnTerm > 0)) return NaN;
  const hw = Math.max(0, h0 - S);
  return (PI * k * (h0 * h0 - hw * hw)) / lnTerm;
}

/**
 * Пьезопроводность по водоотдаче: a = k · h / μ
 *
 * @param {number} k - коэффициент фильтрации, м/сут
 * @param {number} thickness - мощность пласта, м
 * @param {number} mu - водоотдача, безразмерная
 * @returns {number} пьезопроводность, м²/сут; NaN при неполных данных
 */
export function diffusivityFromStorage(k, thickness, mu) {
  if (!(k > 0 && thickness > 0 && mu > 0)) return NaN;
  return (k * thickness) / mu;
}

/**
 * Водоотдача по пьезопроводности: μ = k · h / a
 *
 * @param {number} k - коэффициент фильтрации, м/сут
 * @param {number} thickness - мощность пласта, м
 * @param {number} a - пьезопроводность, м²/сут
 * @returns {number} водоотдача, безразмерная; NaN при неполных данных
 */
export function storageFromDiffusivity(k, thickness, a) {
  if (!(k > 0 && thickness > 0 && a > 0)) return NaN;
  return (k * thickness) / a;
}

/** Расчётные схемы: тип пласта и наличие границы питания */
export const PIT_SCHEMES = {
  confined_unlimited: { id: 'confined_unlimited', confined: true, river: false },
  confined_river: { id: 'confined_river', confined: true, river: true },
  unconfined_unlimited: { id: 'unconfined_unlimited', confined: false, river: false },
  unconfined_river: { id: 'unconfined_river', confined: false, river: true },
};

/** Способы задания радиуса влияния, доступные пользователю */
export const R_METHODS = {
  fromWall: { id: 'fromWall', needsTime: true },
  manual: { id: 'manual', needsTime: false },
};

/**
 * Способы расчёта R, показываемые в таблице сравнения
 *
 * Наличие границы питания отменяет любой из них: у реки радиус влияния задан
 * геометрией, а не временем работы дренажа.
 */
const COMPARED_METHODS = ['fromWall', 'verigin', 'kusakin', 'sichardt', 'weber'];

/**
 * Выбирает радиус влияния по заданному способу
 *
 * @param {Object} input - подготовленные параметры расчёта
 * @returns {{R: number, via: string}} радиус влияния и способ его получения
 */
function resolveR(input) {
  if (input.river) return { R: R_image(input.L), via: 'image' };

  const H = input.confined ? input.m : input.h0;
  switch (input.rMethod) {
    case 'manual':
      return { R: input.Rmanual, via: 'manual' };
    case 'verigin':
      return { R: R_verigin(input.a, input.t), via: 'verigin' };
    case 'kusakin':
      return {
        R: input.confined
          ? R_kusakinConfined(input.S, input.k)
          : R_kusakin(input.S, input.k, H),
        via: 'kusakin',
      };
    case 'sichardt':
      return { R: R_sichardt(input.S, input.k), via: 'sichardt' };
    case 'weber':
      return { R: R_weber(input.k, H, input.t, input.mu), via: 'weber' };
    case 'fromWall':
    default:
      return { R: R_fromWall(input.a, input.t, input.r0), via: 'fromWall' };
  }
}

/**
 * Приводит геометрию котлована к площади и приведённому радиусу
 *
 * @param {Object} raw - исходные поля ввода
 * @param {Array<string>} errors - список ошибок, пополняется на месте
 * @returns {{F: number, r0: number}} площадь и приведённый радиус
 */
function resolveGeometry(raw, errors) {
  const geom = raw.geom || 'area';
  const length = Number(raw.length);
  const width = Number(raw.width);

  if (geom === 'rect') {
    if (!(length > 0 && width > 0)) errors.push('rect');
    return {
      F: length * width,
      r0:
        raw.r0mode === 'forchheimer'
          ? r0Forchheimer(length, width)
          : r0FromRect(length, width),
    };
  }

  if (geom === 'radius') {
    const r0 = Number(raw.r0);
    return { F: areaFromR0(r0), r0 };
  }

  const F = Number(raw.F);
  if (!(F > 0)) errors.push('F');
  return { F, r0: r0FromArea(F) };
}

/**
 * Полный расчёт притока в котлован
 *
 * Ошибки возвращаются списком, а не выбрасываются: экран подсвечивает по ним
 * конкретные поля, а расчёт при неполном вводе — обычное состояние формы,
 * а не исключительная ситуация.
 *
 * @param {Object} raw - поля формы в базовых единицах
 * @param {string} raw.scheme - идентификатор схемы, см. PIT_SCHEMES
 * @param {string} [raw.geom] - способ задания геометрии: area, rect, radius
 * @param {string} [raw.r0mode] - приведение прямоугольника: area или forchheimer
 * @param {string} [raw.rMethod] - способ расчёта R, см. R_METHODS
 * @returns {Object} результат расчёта с полями ok, errors, warnings, Q, R и др.
 */
export function compute(raw) {
  const warnings = [];
  const errors = [];

  const scheme = PIT_SCHEMES[raw.scheme] || PIT_SCHEMES.confined_unlimited;
  const confined = scheme.confined;
  const river = scheme.river;

  const k = Number(raw.k);
  const m = Number(raw.m);
  const h0 = Number(raw.h0);
  const S = Number(raw.S);
  const t = Number(raw.t);
  const mu = Number(raw.mu);
  const L = Number(raw.L);
  const Rmanual = Number(raw.Rmanual);

  let factor = Number(raw.factor);
  if (!isNum(factor) || factor <= 0) factor = 1;

  const { F, r0 } = resolveGeometry(raw, errors);

  if (!(k > 0)) errors.push('k');
  if (confined && !(m > 0)) errors.push('m');
  if (!confined && !(h0 > 0)) errors.push('h0');
  if (!(S > 0)) errors.push('S');
  if (!(r0 > 0)) errors.push('r0');

  const Hsat = confined ? m : h0;
  if (!confined && isNum(S) && h0 > 0 && S > h0) errors.push('S_gt_h0');
  if (confined && S > 20 * m) warnings.push('S_large');

  // Пьезопроводность можно не задавать: если известна водоотдача,
  // она восстанавливается из неё — пользователю не нужно считать вручную
  let a = Number(raw.a);
  if (!(a > 0) && k > 0 && Hsat > 0 && mu > 0) {
    a = diffusivityFromStorage(k, Hsat, mu);
  }

  const rMethod = raw.rMethod || 'fromWall';
  if (river) {
    if (!(L > 0)) errors.push('L');
    else if (isNum(r0) && L <= r0) errors.push('L_le_r0');
  } else if (rMethod === 'manual') {
    if (!(Rmanual > 0)) errors.push('Rmanual');
  } else if (rMethod === 'fromWall' || rMethod === 'verigin') {
    if (!(t > 0)) errors.push('t');
    if (!(a > 0)) errors.push('a');
  } else if (rMethod === 'weber') {
    if (!(t > 0)) errors.push('t');
    if (!(mu > 0)) errors.push('mu');
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      scheme: scheme.id,
      confined,
      river,
      F,
      r0,
    };
  }

  const hw = confined ? null : Math.max(0, h0 - S);
  const resolved = resolveR({
    rMethod,
    r0,
    a,
    t,
    S,
    k,
    m,
    h0,
    mu,
    L,
    Rmanual,
    confined,
    river,
  });

  const R = resolved.R;
  const lnTerm = lnThiem(R, r0);

  if (!(lnTerm > 0)) {
    return {
      ok: false,
      errors: ['R_le_r0'],
      warnings,
      scheme: scheme.id,
      confined,
      river,
      F,
      r0,
      R,
    };
  }

  const Q = confined ? Q_confined(k, m, S, lnTerm) : Q_unconfined(k, h0, S, lnTerm);
  // Водопроводимость безнапорного пласта берётся по средней обводнённой
  // мощности: у стенки котлована поток тоньше, чем на контуре питания
  const T = confined ? k * m : k * ((h0 + hw) / 2);
  const Qdesign = Q * factor;

  if (R < 2 * r0) warnings.push('R_close');
  if (!river && t > 0 && t < 10) warnings.push('t_small');
  if (k > 100) warnings.push('k_high');
  if (k < 0.01) warnings.push('k_low');

  const out = {
    ok: true,
    errors: [],
    warnings,
    scheme: scheme.id,
    confined,
    river,
    k,
    m: confined ? m : null,
    h0: confined ? null : h0,
    S,
    hw,
    t,
    mu,
    a,
    aCheck: mu > 0 ? diffusivityFromStorage(k, Hsat, mu) : NaN,
    F,
    r0,
    L: river ? L : null,
    R,
    Rvia: resolved.via,
    lnTerm,
    T,
    Q,
    factor,
    Qdesign,
    Q_m3h: Q / 24,
    Q_ls: Q / 86.4,
    Qd_m3h: Qdesign / 24,
    Qd_ls: Qdesign / 86.4,
    ratio: R / r0,
    k_ms: k / 86400,
  };

  if ((raw.geom || 'area') === 'rect') {
    const length = Number(raw.length);
    const width = Number(raw.width);
    const aspect = Math.max(length, width) / Math.min(length, width);
    if (aspect > 4) warnings.push('elongated');
    out.length = length;
    out.width = width;
    out.aspect = aspect;
  }

  return out;
}

/**
 * Ряд «приток во времени» для графика Q(t)
 *
 * У реки приток стационарен — контур питания задан геометрией, и от времени
 * ничего не зависит, поэтому ряд для таких схем пуст.
 *
 * @param {Object} raw - те же поля, что у compute
 * @param {number} [tMax] - правая граница по времени, сут
 * @param {number} [steps] - число интервалов разбиения
 * @returns {Array<{t: number, Q: number, R: number}>} точки графика
 */
export function seriesQ(raw, tMax, steps = 32) {
  const scheme = PIT_SCHEMES[raw.scheme] || PIT_SCHEMES.confined_unlimited;
  if (scheme.river) return [];

  let limit = tMax || Number(raw.t) || 365;
  if (!(limit > 0)) limit = 365;

  const points = [];
  for (let i = 0; i <= steps; i++) {
    // Нулевое время дало бы нулевой радиус влияния: начинаем с малой доли шага
    const t = i === 0 ? Math.max(0.25, limit / (steps * 4)) : Math.max(0.25, (limit * i) / steps);
    const result = compute({ ...raw, t });
    if (result.ok) points.push({ t, Q: result.Q, R: result.R });
  }
  return points;
}

/**
 * Сравнение способов расчёта радиуса влияния
 *
 * Схема у реки на время сравнения заменяется неограниченной: иначе все строки
 * дали бы один и тот же R = 2L и таблица потеряла бы смысл.
 *
 * @param {Object} raw - те же поля, что у compute
 * @returns {Array<{method: string, R: number, Q: number, lnTerm: number}>} строки
 */
export function compareR(raw) {
  const scheme = String(raw.scheme || '');
  const unlimited = scheme.includes('unconfined')
    ? 'unconfined_unlimited'
    : 'confined_unlimited';

  return COMPARED_METHODS.map((method) => {
    const result = compute({ ...raw, scheme: unlimited, rMethod: method });
    return result.ok
      ? { method, R: result.R, Q: result.Q, lnTerm: result.lnTerm }
      : null;
  }).filter(Boolean);
}

/**
 * Готовые примеры из веб-калькулятора
 *
 * Ожидаемые значения — не декорация: на них стоят тесты, поэтому правка
 * любой формулы, меняющая результат, сразу видна.
 */
export const PIT_EXAMPLES = {
  confined_unlimited: {
    scheme: 'confined_unlimited',
    geom: 'area',
    F: 44000,
    k: 5,
    m: 20,
    h0: 20,
    S: 10,
    a: 1000,
    mu: 0.1,
    t: 100,
    L: 2200,
    rMethod: 'fromWall',
    factor: 1,
    expectedQ: 3597,
    expectedR: 678.8445,
  },
  confined_river: {
    scheme: 'confined_river',
    geom: 'area',
    F: 44000,
    k: 5,
    m: 20,
    h0: 20,
    S: 10,
    a: 1000,
    mu: 0.1,
    t: 100,
    L: 2200,
    rMethod: 'fromWall',
    factor: 1,
    expectedQ: 1737.552,
    expectedR: 4400,
  },
  unconfined_unlimited: {
    scheme: 'unconfined_unlimited',
    geom: 'area',
    F: 44000,
    k: 5,
    m: 20,
    h0: 20,
    S: 10,
    a: 1000,
    mu: 0.1,
    t: 100,
    L: 2200,
    rMethod: 'fromWall',
    factor: 1,
    expectedQ: 2697.75,
    expectedR: 678.8445,
  },
  unconfined_river: {
    scheme: 'unconfined_river',
    geom: 'area',
    F: 44000,
    k: 5,
    m: 20,
    h0: 20,
    S: 10,
    a: 1000,
    mu: 0.1,
    t: 100,
    L: 2200,
    rMethod: 'fromWall',
    factor: 1,
    expectedQ: 1303.164,
    expectedR: 4400,
  },
};
