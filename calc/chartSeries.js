/**
 * Серии графика понижения
 *
 * На полотне до этого жили три несовместимых представления кривых: ряд замеров
 * с признаком скважины (комбинированное прослеживание), отдельный список
 * соседних кривых куста и ничего для восстановления уровня. Каждое со своими
 * цветами, своей отрисовкой и своим местом в масштабе. Здесь они сводятся к
 * одному списку серий, и кривая восстановления становится просто ещё одной.
 *
 * Роль серии решает, участвует ли она в подборе прямой. Серий подбора может
 * быть несколько: на комбинированном прослеживании прямая ведётся по точкам
 * всего куста сразу, а цвет только показывает, чья точка.
 */

import { transformTime } from './cooperJacob';

/** Участвует ли серия в подборе прямой и отметке точек */
export const SERIES_ROLES = { FIT: 'fit', REFERENCE: 'reference' };

/**
 * Цвета кривых
 *
 * Фиксированный набор, а не цвета темы: кривых на плоскости столько, сколько
 * в кусте наблюдательных скважин, и различать их надо между собой. Оттенки
 * подобраны так, чтобы читались и на светлом, и на тёмном фоне.
 */
export const SERIES_COLORS = [
  '#2E86AB',
  '#E07A5F',
  '#3D9970',
  '#B5179E',
  '#F4A261',
  '#5C6BC0',
];

/**
 * Собирает серии для отрисовки
 *
 * Серия с признаком группы разбивается на несколько — по одной на скважину, —
 * и все они остаются сериями подбора: прямая ведётся по ним сразу.
 *
 * @param {Object} params
 * @param {Array<Object>} params.raw - описания серий: id, name, role, color,
 *   measurements вида [{t, s, group?, groupName?}]
 * @param {string} params.mode - ось абсцисс, см. X_MODES
 * @param {Array<string>} [params.palette] - цвета; повторяются по кругу
 * @returns {Array<{id: string, name: string, color: string, role: string,
 *   points: Array<{x: number, y: number, index: number}>}>} серии
 */
export function buildSeries({ raw, mode, palette = SERIES_COLORS }) {
  const result = [];
  let colorSlot = 0;

  /** Следующий цвет палитры; серия со своим цветом слот не занимает */
  const nextColor = () => palette[colorSlot++ % palette.length];

  for (const entry of raw ?? []) {
    // Точки помнят место в исходном журнале, а не в отфильтрованном ряду: по
    // этим же номерам идёт отметка точек в таблице замеров, и сдвиг нумерации
    // ставил бы галочку не на ту строку
    const points = (entry?.measurements ?? [])
      .map((m, index) => ({
        x: transformTime(m.t, mode),
        y: m.s,
        index,
        group: m.group,
        groupName: m.groupName,
      }))
      .filter((p) => p.x != null && isFinite(p.x) && isFinite(p.y));

    if (points.length === 0) continue;

    const grouped = points.some((p) => p.group != null);

    if (!grouped) {
      result.push({
        id: entry.id,
        name: entry.name,
        color: entry.color ?? nextColor(),
        role: entry.role ?? SERIES_ROLES.REFERENCE,
        points: points.map(({ x, y, index }) => ({ x, y, index })),
      });
      continue;
    }

    // Серии идут в порядке первого появления, а не по алфавиту: порядок
    // задаёт список скважин, и цвет скважины не должен меняться от
    // переименования соседней
    const byGroup = new Map();
    for (const point of points) {
      const key = point.group ?? '';
      if (!byGroup.has(key)) {
        byGroup.set(key, {
          id: `${entry.id}:${key}`,
          name: point.groupName ?? entry.name,
          color: nextColor(),
          role: entry.role ?? SERIES_ROLES.FIT,
          points: [],
        });
      }
      byGroup.get(key).points.push({
        x: point.x,
        y: point.y,
        index: point.index,
      });
    }
    result.push(...byGroup.values());
  }

  return result;
}

/**
 * Переводит журнал восстановления в остаточное понижение
 *
 * В журнале лежит величина подъёма уровня, отсчитанная от момента остановки
 * насоса. На общей с откачкой оси понижения её надо читать как остаток:
 * иначе кривые смотрят в разные стороны и вместе не читаются. Остаток
 * начинается с понижения на остановке и сходит к нулю — уровень вернулся.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - журнал
 *   восстановления: t от остановки насоса, s — подъём уровня
 * @param {number} params.finalDrawdown - понижение на момент остановки
 * @returns {Array<{t: number, s: number}>} остаточное понижение
 */
export function residualDrawdown({ measurements, finalDrawdown }) {
  // Без понижения на остановке остаток не с чем считать: кривой нет, и экран
  // объясняет, какого поля не хватает
  if (!(finalDrawdown > 0)) return [];

  return (measurements ?? [])
    .map((m) => ({
      t: m.t,
      // Ниже нуля остаток не опускается: это означало бы уровень выше
      // исходного, чего при восстановлении не бывает, — а на графике
      // выглядело бы как настоящий замер
      s: Math.max(0, finalDrawdown - m.s),
    }))
    .filter((p) => isFinite(p.t) && isFinite(p.s));
}
