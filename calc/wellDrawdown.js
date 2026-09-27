/**
 * Понижение уровня от работы водозаборной скважины
 *
 * Порт расчётной части веб-калькулятора АНСДИМАТ «Оценка запасов подземных
 * вод». Считает понижение в двух точках сразу — на стенке опытной скважины
 * радиуса r₀ и в наблюдательной на расстоянии r, — потому что проектировщику
 * нужны обе: первая упирается в допустимое понижение и осушение фильтра,
 * вторая показывает, дотянется ли воронка до соседа.
 *
 * Четыре схемы отличаются тем, откуда пласт берёт воду:
 *
 *   theis    — ниоткуда: напорный изолированный пласт, только собственная
 *              упругая ёмкость. Понижение растёт без предела;
 *   hantush  — сверху через слабопроницаемый слой. Перетекание догоняет
 *              откачку, и понижение выходит на стационар;
 *   boulton  — из осушаемых пор: безнапорный пласт с запаздывающей
 *              гравитационной водоотдачей;
 *   boundary — из реки: полуограниченный пласт с границей питания I рода,
 *              учитываемой методом зеркальных отображений.
 *
 * Все формулы работают в базовых единицах приложения: метры, сутки, м³/сут.
 */

import { wellFunction } from './wellFunction';
import { hantushWellFunction } from './leakage';
import { boultonDrawdown } from './boulton';

/** Расчётные схемы водозабора */
export const WELL_SCHEMES = {
  theis: { id: 'theis', confined: true, needs: [] },
  hantush: { id: 'hantush', confined: true, needs: ['B'] },
  boulton: { id: 'boulton', confined: false, needs: ['Sy'] },
  boundary: { id: 'boundary', confined: true, needs: ['Lw', 'Lp'] },
};

/** Сколько точек в ряду s(t) — столько же, сколько строк в таблице веб-версии */
export const SERIES_POINTS = 30;

/**
 * Расстояние от точки наблюдения до фиктивной скважины
 *
 * Граница I рода отражает откачку: по другую сторону реки на том же удалении
 * ставится нагнетательная скважина того же дебита. Обе реальные скважины
 * стоят на своих расстояниях от прямолинейной границы, поэтому смещение
 * вдоль неё равно √(r² − (L_w − L_p)²), а до зеркала выходит
 *
 *     √( r² − (L_w − L_p)² + (L_w + L_p)² ) = √( r² + 4 L_w L_p )
 *
 * @param {number} r - расстояние между скважинами, м
 * @param {number} Lw - расстояние от опытной скважины до реки, м
 * @param {number} Lp - расстояние от наблюдательной скважины до реки, м
 * @returns {number} расстояние до фиктивной скважины, м; NaN при неполных данных
 */
export function imageDistanceToObserver(r, Lw, Lp) {
  if (!(r > 0) || !(Lw > 0) || !(Lp > 0)) return NaN;
  return Math.sqrt(r * r + 4 * Lw * Lp);
}

/**
 * Понижение в одной точке по выбранной схеме
 *
 * @param {Object} params - подготовленные параметры расчёта
 * @param {number} params.r - расстояние до точки наблюдения, м
 * @param {number} params.t - время от начала откачки, сут
 * @param {number} params.rImage - расстояние до фиктивной скважины, м (схема boundary)
 * @returns {number} понижение, м; NaN при неполных данных
 */
function drawdownAt({ scheme, Q, T, storage, r, t, B, rImage, k, h0, Sy, S }) {
  if (scheme === 'boulton') {
    return boultonDrawdown({ Q, k, h0, Sy, S, r, t });
  }

  const factor = Q / (4 * Math.PI * T);
  const u = (r * r * storage) / (4 * T * t);

  if (scheme === 'hantush') return factor * hantushWellFunction(u, r / B);

  if (scheme === 'boundary') {
    const uImage = (rImage * rImage * storage) / (4 * T * t);
    // Фиктивная скважина нагнетает: её понижение вычитается, и на самой
    // границе вклады гасят друг друга — уровень там остаётся исходным
    return factor * (wellFunction(u) - wellFunction(uImage));
  }

  return factor * wellFunction(u);
}

/**
 * Приводит ввод к набору величин, которыми пользуются формулы
 *
 * @param {Object} raw - поля формы в базовых единицах
 * @returns {Object} параметры расчёта и список ошибок
 */
function prepare(raw) {
  const errors = [];
  const scheme = WELL_SCHEMES[raw.scheme] ? raw.scheme : 'theis';
  const unconfined = scheme === 'boulton';

  const Q = Number(raw.Q);
  const t = Number(raw.t);
  const r0 = Number(raw.r0);
  const r = Number(raw.r);
  const k = Number(raw.k);
  const thickness = unconfined ? Number(raw.h0) : Number(raw.m);
  const Sy = Number(raw.Sy);
  const B = Number(raw.B);
  const Lw = Number(raw.Lw);
  const Lp = Number(raw.Lp);

  if (!(Q > 0)) errors.push('Q');
  if (!(t > 0)) errors.push('t');
  if (!(r0 > 0)) errors.push('r0');
  if (!(r > 0)) errors.push('r');
  if (!(k > 0)) errors.push('k');
  if (!(thickness > 0)) errors.push(unconfined ? 'h0' : 'm');

  const T = k > 0 && thickness > 0 ? k * thickness : NaN;

  // Упругую водоотдачу можно не задавать: если известна пьезопроводность,
  // она восстанавливается из неё, и наоборот — это две записи одного и того же
  let S = Number(raw.S);
  const a = Number(raw.a);
  if (!(S > 0) && a > 0 && T > 0) S = T / a;
  if (!(S > 0)) errors.push('S');

  if (unconfined && !(Sy > 0)) errors.push('Sy');
  if (scheme === 'hantush' && !(B > 0)) errors.push('B');
  if (scheme === 'boundary') {
    if (!(Lw > 0)) errors.push('Lw');
    if (!(Lp > 0)) errors.push('Lp');
  }

  return {
    scheme,
    unconfined,
    Q,
    t,
    r0,
    r,
    k,
    m: unconfined ? null : thickness,
    h0: unconfined ? thickness : null,
    thickness,
    S,
    Sy,
    a: T > 0 && S > 0 ? T / S : NaN,
    B,
    Lw,
    Lp,
    T,
    errors,
  };
}

/**
 * Формула, по которой посчитано понижение
 *
 * Показывается рядом с результатом: расчёт по чужой программе принимают
 * охотнее, когда видно, что именно она считала.
 *
 * @param {string} scheme - идентификатор схемы
 * @returns {string} запись формулы
 */
export function schemeFormula(scheme) {
  switch (scheme) {
    case 'hantush':
      return 's = Q / (4πT) · W(u, r/B), u = r²S / (4Tt), B = √(T m′/k′)';
    case 'boulton':
      return 's = Q / (4πT) · W(u_a, u_y, α), T = k h₀, α = 3k / (Sy h₀)';
    case 'boundary':
      return 's = Q / (4πT) · [W(u) − W(u′)], u′ = r′²S / (4Tt), r′ = √(r² + 4 L_w L_p)';
    case 'theis':
    default:
      return 's = Q / (4πT) · W(r²S / 4Tt), T = k m, W(u) = E₁(u)';
  }
}

/**
 * Полный расчёт понижения от водозаборной скважины
 *
 * @param {Object} raw - поля формы в базовых единицах
 * @param {string} raw.scheme - идентификатор схемы, см. WELL_SCHEMES
 * @param {number} raw.Q - дебит скважины, м³/сут
 * @param {number} raw.t - длительность откачки, сут
 * @param {number} raw.r0 - радиус опытной скважины, м
 * @param {number} raw.r - расстояние до наблюдательной скважины, м
 * @param {number} [raw.allowable] - допустимое понижение на конец откачки, м
 * @returns {Object} ok, errors, warnings, sWell, sObs, formula и параметры
 */
export function computeWellDrawdown(raw) {
  const params = prepare(raw);
  const warnings = [];

  if (params.errors.length) {
    return { ok: false, errors: params.errors, warnings, scheme: params.scheme };
  }

  const rImage =
    params.scheme === 'boundary'
      ? imageDistanceToObserver(params.r, params.Lw, params.Lp)
      : NaN;

  const shared = {
    scheme: params.scheme,
    Q: params.Q,
    T: params.T,
    storage: params.S,
    B: params.B,
    k: params.k,
    h0: params.h0,
    Sy: params.Sy,
    S: params.S,
  };

  const sWell = drawdownAt({
    ...shared,
    r: params.r0,
    t: params.t,
    // Для самой опытной скважины зеркало стоит по другую сторону реки
    // на том же удалении: расстояние до него равно удвоенному
    rImage: 2 * params.Lw,
  });
  const sObs = drawdownAt({ ...shared, r: params.r, t: params.t, rImage });

  if (params.r <= params.r0) warnings.push('r_le_r0');

  const allowable = Number(raw.allowable);
  const exceedsAllowable = allowable > 0 && sWell > allowable;
  if (exceedsAllowable) warnings.push('exceeds_allowable');

  // Осушение считаем только для безнапорной схемы: в напорной понижение
  // ниже кровли переводит пласт в безнапорный режим, а не осушает его
  const dewatered = params.unconfined && sWell >= params.h0;
  if (dewatered) warnings.push('dewatered');

  return {
    ok: true,
    errors: [],
    warnings,
    scheme: params.scheme,
    unconfined: params.unconfined,
    Q: params.Q,
    t: params.t,
    r0: params.r0,
    r: params.r,
    k: params.k,
    m: params.m,
    h0: params.h0,
    S: params.S,
    Sy: params.unconfined ? params.Sy : null,
    a: params.a,
    B: params.scheme === 'hantush' ? params.B : null,
    Lw: params.scheme === 'boundary' ? params.Lw : null,
    Lp: params.scheme === 'boundary' ? params.Lp : null,
    rImage,
    T: params.T,
    sWell,
    sObs,
    allowable: allowable > 0 ? allowable : null,
    exceedsAllowable,
    dewatered,
    formula: schemeFormula(params.scheme),
  };
}

/**
 * Ряд «понижение во времени» для графика и таблицы
 *
 * Время разложено логарифмически: на линейной шкале первые пять порядков
 * слиплись бы в одну точку, а именно там кривая и меняет форму.
 *
 * @param {Object} raw - те же поля, что у computeWellDrawdown
 * @param {Object} [options]
 * @param {number} [options.points] - число точек ряда
 * @param {number} [options.tStart] - начало ряда, сут
 * @returns {Array<{t: number, sWell: number, sObs: number}>} точки ряда
 */
export function drawdownSeries(raw, { points = SERIES_POINTS, tStart = 1e-4 } = {}) {
  const params = prepare(raw);
  if (params.errors.length || !(params.t > tStart)) return [];

  const rImage =
    params.scheme === 'boundary'
      ? imageDistanceToObserver(params.r, params.Lw, params.Lp)
      : NaN;

  const shared = {
    scheme: params.scheme,
    Q: params.Q,
    T: params.T,
    storage: params.S,
    B: params.B,
    k: params.k,
    h0: params.h0,
    Sy: params.Sy,
    S: params.S,
  };

  const ratio = Math.pow(params.t / tStart, 1 / (points - 1));
  return Array.from({ length: points }, (_, i) => {
    const t = tStart * Math.pow(ratio, i);
    return {
      t,
      sWell: drawdownAt({ ...shared, r: params.r0, t, rImage: 2 * params.Lw }),
      sObs: drawdownAt({ ...shared, r: params.r, t, rImage }),
    };
  });
}
