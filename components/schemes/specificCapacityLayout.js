/**
 * Разметка схемы «Оценки по Q/s»
 *
 * Разрез повторяет окно «Оценка параметров» настольного АНСДИМАТ: скважина в
 * пласте, воронка депрессии, окошки ввода прямо на чертеже. Настольное окно
 * лежит на боку — окошки разбросаны по ширине. На телефоне так не поместится,
 * поэтому разрез переложен в столбик: ствол посередине, окошки двумя
 * колонками по бокам от него, строками сверху вниз.
 *
 * | строка | слева                 | справа                         |
 * |--------|-----------------------|--------------------------------|
 * | 0      | Q                     | sw                             |
 * | A      | zw                    | rw                             |
 * | B      | m                     | kz/kr                          |
 * | C      | результат             | lw (или формула у совершенной) |
 * | D      | формула на всю ширину — только у несовершенной скважины  |
 *
 * Строки появляются, только когда нужны их окошки: у совершенной скважины в
 * напорном пласте из пласта остаётся одна строка C, и схема короче.
 *
 * Чертёж схематичный, как и в настольной версии: фильтр рисуется между
 * строками B и C при любых числах. Разметка — чистая функция без React:
 * проверяется, что окошки не налезают друг на друга и на ствол.
 */

import { AQUIFERS } from '../../calc/specificCapacity';

/** Высота подписи над окошком */
export const QS_LABEL_HEIGHT = 18;

/** Высота окошка */
export const QS_BOX_HEIGHT = 40;

/** Шаг строк: подпись, окошко и зазор */
const ROW_STEP = QS_LABEL_HEIGHT + QS_BOX_HEIGHT + 12;

/** Поле по краю полотна */
const EDGE = 12;

/** Зазор между стволом и окошками */
const GAP = 12;

/** Ширина ствола */
const WELL_WIDTH = 20;

/**
 * Запас слева под размер мощности m
 *
 * Размерная линия идёт вдоль левой колонки окошек, и ствол сдвигается
 * вправо на половину запаса — колонки остаются одной ширины.
 */
const DIM_ROOM = 16;

/** Окошко шире этого на планшете растягивалось бы на полэкрана */
const MAX_SLOT_WIDTH = 180;

/** Отступ сверху до первой строки */
const TOP = 8;

/** Палитра чертежа: от темы не зависит, как у остальных схем калькулятора */
export const QS_PALETTE = {
  paper: '#fbfaf6',
  aquifer: '#cfe6ee',
  hatch: '#8a8580',
  line: '#2b2724',
  water: '#2f6db5',
  casing: '#fbfaf6',
  steel: '#5d5956',
  ink: '#2b2724',
  muted: '#6f6a66',
  box: '#ffffff',
  boxBorder: '#b8b0a8',
  result: '#fdf2bf',
  resultBorder: '#d6c26e',
};

/**
 * Место окошка
 *
 * @param {number} x - левый край
 * @param {number} y - верх подписи
 * @param {number} w - ширина
 * @returns {{x: number, y: number, boxY: number, w: number}}
 */
const slot = (x, y, w) => ({ x, y, boxY: y + QS_LABEL_HEIGHT, w });

/**
 * Разметка схемы
 *
 * @param {Object} params
 * @param {number} params.width - ширина полотна, px
 * @param {string} params.aquifer - AQUIFERS.CONFINED | AQUIFERS.UNCONFINED
 * @param {boolean} params.imperfect - несовершенная скважина
 * @returns {Object} размеры полотна, уровни, ствол, места окошек и размерные линии
 */
export function specificCapacityLayout({ width, aquifer, imperfect }) {
  const unconfined = aquifer === AQUIFERS.UNCONFINED;

  const columns = width - 2 * EDGE - WELL_WIDTH - 2 * GAP - DIM_ROOM;
  const slotW = Math.min(MAX_SLOT_WIDTH, Math.floor(columns / 2));
  const wellX = Math.round(width / 2 - WELL_WIDTH / 2 + DIM_ROOM / 2);
  const leftX = wellX - GAP - slotW;
  const rightX = wellX + WELL_WIDTH + GAP;

  const slots = {
    Q: slot(leftX, TOP, slotW),
    s: slot(rightX, TOP, slotW),
  };
  const headBottom = TOP + QS_LABEL_HEIGHT + QS_BOX_HEIGHT;

  // Над пластом: у напорного — пьезометрический уровень и кровля, у
  // безнапорного — поверхность земли и зеркало грунтовых вод
  let roof = null;
  let ground = null;
  let staticY;
  let dynamicY;
  let aquiferTop;
  let fillTop;
  if (unconfined) {
    ground = headBottom + 16;
    staticY = ground + 14;
    dynamicY = staticY + 34;
    aquiferTop = staticY;
    fillTop = ground;
  } else {
    staticY = headBottom + 16;
    roof = { top: staticY + 30, bottom: staticY + 52 };
    dynamicY = roof.top - 6;
    aquiferTop = roof.bottom;
    fillTop = roof.bottom;
  }

  // Строки окошек в пласте — ниже дна воронки, чтобы кривая не уходила под
  // окошки
  let rowY = Math.max(aquiferTop, dynamicY) + 14;
  const nextRow = () => {
    const y = rowY;
    rowY += ROW_STEP;
    return y;
  };

  if (imperfect) {
    const a = nextRow();
    slots.zw = slot(leftX, a, slotW);
    slots.rw = slot(rightX, a, slotW);
  }
  if (unconfined || imperfect) {
    const b = nextRow();
    slots.m = slot(leftX, b, slotW);
    if (imperfect) slots.anisotropy = slot(rightX, b, slotW);
  }
  const c = nextRow();
  slots.result = slot(leftX, c, slotW);
  if (imperfect) {
    slots.lw = slot(rightX, c, slotW);
    // Ствол кончается фильтром в строке C, и под ним формула помещается
    // на всю ширину
    slots.formula = slot(leftX, nextRow(), rightX + slotW - leftX);
  } else {
    slots.formula = slot(rightX, c, slotW);
  }

  const aquiferBottom = rowY - ROW_STEP + QS_LABEL_HEIGHT + QS_BOX_HEIGHT + 14;
  const floor = { top: aquiferBottom, bottom: aquiferBottom + 18 };

  const boxMiddle = (key) => slots[key].boxY + QS_BOX_HEIGHT / 2;
  const screenTop = imperfect ? boxMiddle('m') : aquiferTop;
  const screenBottom = imperfect ? boxMiddle('lw') : aquiferBottom;

  const well = {
    x: wellX,
    w: WELL_WIDTH,
    headY: TOP + 2,
    casingTop: TOP + 22,
    bottom: screenBottom,
    screenTop,
    screenBottom,
  };

  const dims = {
    sw: { x1: rightX + 10, y1: headBottom, x2: wellX + WELL_WIDTH, y2: dynamicY },
  };
  if (slots.m) {
    dims.m = { x: leftX - 14, y1: aquiferTop, y2: aquiferBottom, connectY: boxMiddle('m') };
  }
  if (imperfect) {
    dims.zw = {
      x: wellX - 6,
      y1: aquiferTop,
      y2: (screenTop + screenBottom) / 2,
      connectY: boxMiddle('zw'),
    };
    dims.lw = { x: wellX + WELL_WIDTH + 6, y1: screenTop, y2: screenBottom, connectY: boxMiddle('lw') };
    dims.rw = { x1: rightX, x2: wellX + WELL_WIDTH, y: boxMiddle('rw') };
  }

  const right = wellX + WELL_WIDTH;
  const cone = {
    left: `M 0 ${staticY} C ${wellX * 0.55} ${staticY}, ${wellX * 0.8} ${dynamicY}, ${wellX} ${dynamicY}`,
    right: `M ${right} ${dynamicY} C ${right + (width - right) * 0.2} ${dynamicY}, ${
      right + (width - right) * 0.45
    } ${staticY}, ${width} ${staticY}`,
  };

  return {
    width,
    height: floor.bottom + 6,
    unconfined,
    imperfect,
    levels: { staticY, dynamicY },
    roof,
    ground,
    floor,
    aquifer: { top: aquiferTop, bottom: aquiferBottom, fillTop },
    well,
    cone,
    slots,
    dims,
  };
}
