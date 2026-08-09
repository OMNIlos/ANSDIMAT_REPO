/**
 * Граничные условия пласта — метод отображений (барраж)
 *
 * Реальный пласт почти никогда не бесконечен: рядом бывает река (граница
 * постоянного напора) или тектонический контакт, стена в грунте, борт долины
 * (непроницаемая граница, «барраж»). Ограниченный пласт сводится к
 * бесконечному добавлением фиктивной скважины-отображения, зеркальной
 * относительно границы (теория отображений, Ferris, 1959):
 *
 * - непроницаемая граница: отображение той же откачки — понижения
 *   складываются, воронка становится глубже;
 * - граница постоянного напора: отображение — нагнетательная скважина,
 *   понижения вычитаются, воронка выполаживается и стабилизируется.
 *
 * Расстояние от точки наблюдения до отображения считается через положение
 * скважины и точки относительно границы. Границу считаем прямой; ось x
 * направлена перпендикулярно ей, начало — на границе.
 *
 * Источники: Ferris J.G. et al. «Theory of aquifer tests» (USGS WSP 1536-E);
 * Ф.М. Бочевер, «Расчёты эксплуатационных запасов подземных вод».
 */

import { wellFunction } from './wellFunction';

export const BOUNDARY_TYPES = {
  /** Непроницаемая граница (барраж): отображение — такая же откачка */
  BARRIER: 'barrier',
  /** Граница постоянного напора (река): отображение — нагнетание */
  RECHARGE: 'recharge',
};

/**
 * Расстояние от точки наблюдения до скважины-отображения
 *
 * Скважина стоит в точке (L, 0), граница — прямая x = 0, отображение —
 * в точке (−L, 0). Точка наблюдения задаётся смещением от скважины:
 * dx — по нормали к границе (положительное направление — к границе),
 * dy — вдоль границы. Точка наблюдения оказывается в (L − dx, dy),
 * а до отображения от неё 2L − dx по нормали.
 *
 * @param {number} L - расстояние «скважина — граница», м
 * @param {number} dx - смещение точки к границе, м (отрицательное — от границы)
 * @param {number} [dy] - смещение точки вдоль границы, м
 * @returns {number} расстояние «отображение — точка наблюдения», м;
 *   NaN, если точка оказалась за границей пласта
 */
export function imageDistance(L, dx, dy = 0) {
  if (!(L > 0) || !isFinite(dx) || !isFinite(dy)) return NaN;
  // За границей пласта нет — там решение неприменимо. Сама граница (dx = L)
  // допустима: это предельный случай, на нём решение и проверяется
  if (dx > L) return NaN;
  const normal = 2 * L - dx;
  return Math.sqrt(normal * normal + dy * dy);
}

/**
 * Понижение в пласте с одной прямолинейной границей
 *
 * s = Q/(4πT) · [W(u_r) ± W(u_i)], знак «+» для непроницаемой границы,
 * «−» — для границы постоянного напора.
 *
 * @param {Object} params
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} params.T - водопроводимость, м²/сут
 * @param {number} params.S - водоотдача (безразмерная)
 * @param {number} params.r - расстояние от скважины до точки наблюдения, м
 * @param {number} params.t - время от начала откачки, сут
 * @param {number} params.L - расстояние от скважины до границы, м
 * @param {string} [params.boundary] - тип границы, см. BOUNDARY_TYPES
 * @param {boolean} [params.towardBoundary] - точка наблюдения между скважиной
 *   и границей (по умолчанию) или в противоположную сторону
 * @param {number} [params.alongBoundary] - смещение точки вдоль границы, м
 * @returns {{s: number, sInfinite: number, sImage: number, rImage: number,
 *   effect: number, warnings: string[]}}
 *   s — понижение с учётом границы, м; sInfinite — понижение в бесконечном
 *   пласте, м; effect — вклад границы (s − sInfinite), м
 */
export function drawdownWithBoundary({
  Q,
  T,
  S,
  r,
  t,
  L,
  boundary = BOUNDARY_TYPES.BARRIER,
  towardBoundary = true,
  alongBoundary = 0,
}) {
  const warnings = [];
  const empty = {
    s: NaN,
    sInfinite: NaN,
    sImage: NaN,
    rImage: NaN,
    effect: NaN,
    warnings,
  };

  if (!(Q > 0) || !(T > 0) || !(S > 0) || !(r > 0) || !(t > 0) || !(L > 0)) {
    return empty;
  }

  // Раскладываем расстояние до точки на нормальную и параллельную границе
  // составляющие: вдоль границы задано смещение alongBoundary
  const dy = Math.abs(alongBoundary);
  if (dy > r) return empty;
  const normalOffset = Math.sqrt(r * r - dy * dy);
  const dx = towardBoundary ? normalOffset : -normalOffset;

  const rImage = imageDistance(L, dx, dy);
  if (!(rImage > 0)) {
    return { ...empty, warnings: ['observationBeyondBoundary'] };
  }

  const factor = Q / (4 * Math.PI * T);
  const uReal = (r * r * S) / (4 * T * t);
  const uImage = (rImage * rImage * S) / (4 * T * t);

  const sInfinite = factor * wellFunction(uReal);
  const sImage = factor * wellFunction(uImage);

  const isBarrier = boundary === BOUNDARY_TYPES.BARRIER;
  const s = isBarrier ? sInfinite + sImage : sInfinite - sImage;

  // Пока фронт возмущения не дошёл до границы, она ещё не работает:
  // отображение даёт пренебрежимо малый вклад, и это стоит показать
  if (uImage > 5) {
    warnings.push('boundaryNotReached');
  }
  // У самой границы постоянного напора понижение обязано быть нулевым
  if (!isBarrier && s < 0) {
    return { ...empty, warnings: [...warnings, 'observationBeyondBoundary'] };
  }

  return { s, sInfinite, sImage, rImage, effect: s - sInfinite, warnings };
}

/**
 * Подпор уровня перед непроницаемым сооружением (барражный эффект)
 *
 * Стена в грунте, перегородившая поток, поднимает уровень выше по потоку.
 * В плановой постановке для потока с естественным уклоном i подпор перед
 * сооружением длиной b оценивается как доля перехваченного потока,
 * распределённая на ширину обтекания:
 *
 *   ΔH = i · b / 2
 *
 * Оценка верхняя: она отвечает полному перекрытию потока на длине b и
 * даёт запас при выборе дренажных мероприятий.
 *
 * @param {Object} params
 * @param {number} params.gradient - естественный уклон потока i (безразмерный)
 * @param {number} params.barrierLength - длина сооружения поперёк потока b, м
 * @returns {{rise: number, formula: string}} подпор ΔH, м
 */
export function barrageRise({ gradient, barrierLength }) {
  const formula = 'ΔH = i · b / 2';
  if (!(gradient > 0) || !(barrierLength > 0)) {
    return { rise: NaN, formula };
  }
  return { rise: (gradient * barrierLength) / 2, formula };
}
