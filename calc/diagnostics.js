/**
 * Диагностика режима фильтрации по производной понижения
 *
 * Ключевой приём интерпретации ОФР: кроме самого понижения строится его
 * производная по логарифму времени — ds/d(ln t). На графике в двойных
 * логарифмических координатах она сразу показывает, что происходит в пласте,
 * потому что каждый режим даёт свою форму:
 *
 *   горизонтальная полка   — радиальный поток, работает Купер — Джейкоб
 *   подъём после полки     — непроницаемая граница (барраж): полка удваивается
 *   спад после полки       — переток из смежного пласта или граница с напором
 *   наклон 45° в начале    — ёмкость ствола скважины, эти точки не считают
 *
 * Зачем это в приложении. Формула T = 0.183·Q/a верна только на участке
 * радиального потока. Прямая, проведённая по точкам ёмкости ствола или уже
 * за границей пласта, даёт правдоподобное, но неверное число — и по самому
 * графику понижения это незаметно, потому что он всюду выглядит плавным.
 * Производная делает участок явным.
 *
 * Метод Бурдэ. Наивная разность соседних замеров превращает любой шум
 * в частокол, поэтому производная берётся по трём точкам, разнесённым не
 * ближе чем на L логарифмических единиц, и взвешивается по расстояниям.
 */

/**
 * Ширина окна сглаживания в единицах ln t
 *
 * 0.2 — обычный компромисс: меньше даёт зубцы на полевых данных, больше
 * съедает перегиб на границе пласта, ради которого всё и строится.
 */
export const DEFAULT_SMOOTHING = 0.2;

/** Режимы фильтрации, различимые по форме производной */
export const REGIMES = {
  WELLBORE: 'wellbore',   // ёмкость ствола скважины
  RADIAL: 'radial',       // радиальный поток
  BARRIER: 'barrier',     // непроницаемая граница
  RECHARGE: 'recharge',   // переток или граница с постоянным напором
  UNCLEAR: 'unclear',     // данных мало или они противоречивы
};

/**
 * Считает производную понижения по логарифму времени методом Бурдэ
 *
 * Для каждой точки берутся ближайшие соседи, отстоящие не менее чем на
 * `smoothing` по ln t. Крайние точки, для которых такой пары нет,
 * пропускаются: односторонняя производная на концах даёт выброс, который
 * потом читается как несуществующая граница.
 *
 * @param {Array<{t: number, s: number}>} measurements - замеры
 * @param {number} smoothing - ширина окна в единицах ln t
 * @returns {Array<{t: number, s: number, d: number}>} точки с производной
 */
export function bourdetDerivative(measurements, smoothing = DEFAULT_SMOOTHING) {
  const points = (measurements ?? [])
    .filter((m) => isFinite(m?.t) && isFinite(m?.s) && m.t > 0)
    .sort((a, b) => a.t - b.t);

  if (points.length < 3) return [];

  const result = [];

  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const lnCurrent = Math.log(current.t);

    // Ближайший слева, отстоящий достаточно далеко
    let left = null;
    for (let j = i - 1; j >= 0; j--) {
      if (lnCurrent - Math.log(points[j].t) >= smoothing) {
        left = points[j];
        break;
      }
    }

    // Ближайший справа
    let right = null;
    for (let k = i + 1; k < points.length; k++) {
      if (Math.log(points[k].t) - lnCurrent >= smoothing) {
        right = points[k];
        break;
      }
    }

    // Замеры сгущены плотнее окна — берём непосредственных соседей.
    // Иначе на частой записи логгера производной не осталось бы вовсе
    if (!left) left = points[i - 1];
    if (!right) right = points[i + 1];

    const dLeft = lnCurrent - Math.log(left.t);
    const dRight = Math.log(right.t) - lnCurrent;
    if (!(dLeft > 0) || !(dRight > 0)) continue;

    const slopeLeft = (current.s - left.s) / dLeft;
    const slopeRight = (right.s - current.s) / dRight;

    // Взвешивание крест-накрест: ближний сосед весит больше
    const d = (slopeLeft * dRight + slopeRight * dLeft) / (dLeft + dRight);

    result.push({ t: current.t, s: current.s, d });
  }

  return result;
}

/**
 * Наклон прямой в двойных логарифмических координатах
 *
 * @param {Array<{x: number, y: number}>} points - точки (положительные)
 * @returns {number} наклон lg y по lg x или NaN
 */
function logLogSlope(points) {
  const usable = points.filter((p) => p.x > 0 && p.y > 0);
  if (usable.length < 2) return NaN;

  let sumX = 0;
  let sumY = 0;
  for (const p of usable) {
    sumX += Math.log10(p.x);
    sumY += Math.log10(p.y);
  }
  const meanX = sumX / usable.length;
  const meanY = sumY / usable.length;

  let num = 0;
  let den = 0;
  for (const p of usable) {
    const dx = Math.log10(p.x) - meanX;
    num += dx * (Math.log10(p.y) - meanY);
    den += dx * dx;
  }
  return den > 0 ? num / den : NaN;
}

/**
 * Индекс точки, с которой начинается установившийся участок
 *
 * Начало любой откачки пласт не характеризует. Сперва скважина опорожняет
 * собственный ствол — на логарифмическом графике это наклон 1:1, — потом
 * идёт переходный горб, и только затем производная выходит на полку.
 * Отбрасывать один лишь участок наклона 1:1 мало: спад после горба
 * читался бы как подпитка пласта, которой нет.
 *
 * Поэтому распознаём именно эту последовательность: крутой подъём в начале
 * записи, затем вершина горба, затем спад. Спад в конце записи — совсем
 * другое дело, это подпитка пласта, и его трогать нельзя. Отличает их то,
 * что здесь спаду предшествует подъём с самого первого замера.
 *
 * @param {Array<{t: number, d: number}>} derivative - точки производной
 * @returns {number} индекс начала установившегося участка
 */
function steadyStartIndex(derivative) {
  const WINDOW = 3;
  const count = derivative.length;
  if (count < WINDOW) return -1;

  // Ведущий подъём: наклон около единицы — скважина работает на себя
  let riseEnd = -1;
  for (let i = 0; i + WINDOW <= count; i++) {
    const window = derivative.slice(i, i + WINDOW).map((p) => ({ x: p.t, y: p.d }));
    const slope = logLogSlope(window);
    if (!isFinite(slope) || slope <= 0.5) break;
    riseEnd = i + WINDOW - 1;
  }

  // Запись начинается сразу с установившегося участка — редкий, но лучший случай
  if (riseEnd < 0) return 0;

  let i = riseEnd;
  while (i + 1 < count && derivative[i + 1].d >= derivative[i].d) i++;     // вершина горба
  while (i + 1 < count && derivative[i + 1].d < derivative[i].d * 0.98) i++; // спад к полке

  return i;
}

/**
 * Определяет режим фильтрации по форме производной
 *
 * Смотрит на поздний участок — именно он определяет, какой метод применим.
 * Ранний отбрасывается вместе с ёмкостью ствола.
 *
 * @param {Array<{t: number, s: number}>} measurements - замеры
 * @param {number} smoothing - ширина окна в единицах ln t
 * @returns {Object} режим, границы участка и пояснения
 */
export function diagnose(measurements, smoothing = DEFAULT_SMOOTHING) {
  const derivative = bourdetDerivative(measurements, smoothing);

  const empty = {
    derivative,
    regime: REGIMES.UNCLEAR,
    wellboreEndsAt: 0,
    radialFrom: NaN,
    lateSlope: NaN,
    plateau: NaN,
    warnings: [],
  };

  if (derivative.length < 3) {
    return { ...empty, warnings: ['needMorePoints'] };
  }

  const steadyFrom = steadyStartIndex(derivative);
  const afterWellbore = steadyFrom >= 0 ? derivative.slice(steadyFrom) : [];
  const wellboreEndsAt = steadyFrom > 0 ? derivative[steadyFrom - 1].t : 0;

  // Если установившегося участка не набралось, судить о пласте не по чему
  if (afterWellbore.length < 3) {
    return {
      ...empty,
      wellboreEndsAt,
      regime: REGIMES.WELLBORE,
      warnings: ['wellboreDominates'],
    };
  }

  // Запись делится на трети по логарифму времени: сравнивать надо начало
  // и конец, а не смотреть на один наклон. Непроницаемая граница успевает
  // вывести производную на новую полку внутри опыта — наклон в конце тогда
  // снова нулевой, и по нему граница неотличима от радиального потока
  const lnStart = Math.log(afterWellbore[0].t);
  const lnEnd = Math.log(afterWellbore[afterWellbore.length - 1].t);
  const third = (lnEnd - lnStart) / 3;

  let early = afterWellbore.filter((p) => Math.log(p.t) <= lnStart + third);
  let late = afterWellbore.filter((p) => Math.log(p.t) >= lnEnd - third);
  if (early.length < 2) early = afterWellbore.slice(0, 2);
  if (late.length < 2) late = afterWellbore.slice(-2);

  const mean = (points) => points.reduce((sum, p) => sum + p.d, 0) / points.length;
  const earlyPlateau = mean(early);
  const latePlateau = mean(late);
  const lateSlope = logLogSlope(late.map((p) => ({ x: p.t, y: p.d })));

  // Во сколько раз изменилась производная за опыт. Ровно 2 — классическая
  // подпись непроницаемой границы: отражённая скважина удваивает наклон
  const ratio = earlyPlateau > 0 ? latePlateau / earlyPlateau : NaN;

  let regime;
  if (!(latePlateau > 0)) {
    // Производная села в ноль: понижение перестало расти, пласт подпитывается
    regime = REGIMES.RECHARGE;
  } else if (!isFinite(ratio)) {
    regime = REGIMES.UNCLEAR;
  } else if (ratio > 1.5 || lateSlope > 0.15) {
    regime = REGIMES.BARRIER;
  } else if (ratio < 0.7 || lateSlope < -0.15) {
    regime = REGIMES.RECHARGE;
  } else {
    regime = REGIMES.RADIAL;
  }

  const warnings = [];
  if (wellboreEndsAt > 0) warnings.push('wellboreStorage');
  if (derivative.length < 6) warnings.push('fewPoints');

  return {
    derivative,
    regime,
    wellboreEndsAt,
    radialFrom: afterWellbore[0].t,
    lateSlope,
    ratio,
    earlyPlateau: earlyPlateau > 0 ? earlyPlateau : NaN,
    // Полка, по которой считать T. При чистом радиальном потоке это конец
    // записи — там режим установился. Если же дальше вмешались граница или
    // переток, радиальным остаётся только начало: по удвоенной полке T
    // вышла бы вдвое заниженной
    plateau:
      regime === REGIMES.RADIAL
        ? (latePlateau > 0 ? latePlateau : NaN)
        : (earlyPlateau > 0 ? earlyPlateau : NaN),
    warnings,
  };
}

/**
 * Водопроводимость по полке производной
 *
 * На радиальном участке производная равна наклону прямой Купера — Джейкоба,
 * пересчитанному из десятичного логарифма в натуральный: a = 2.3 · ds/d(ln t).
 * Это независимая оценка T — она не зависит от того, какие точки геолог
 * выбрал для прямой, поэтому расхождение с основным расчётом сразу видно.
 *
 * @param {number} Q - дебит, м³/сут
 * @param {number} plateau - уровень полки производной, м
 * @returns {number} водопроводимость, м²/сут
 */
export function transmissivityFromPlateau(Q, plateau) {
  if (!isFinite(Q) || !isFinite(plateau) || plateau <= 0) return NaN;
  return Q / (4 * Math.PI * plateau);
}
