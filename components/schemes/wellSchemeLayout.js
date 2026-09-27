/**
 * Разметка типовых схем водозаборной скважины
 *
 * Это чертёж расчётной схемы, а не график: он показывает, как устроен пласт
 * и откуда в него поступает вода, и от чисел в форме не зависит. Так же он
 * устроен и в веб-калькуляторе, где подписан «типовая схема»: проверено
 * подстановкой — при изменении дебита, расстояния и проницаемости разметка
 * там не меняется ни на пиксель.
 *
 * Координаты сняты из веб-версии как есть, чтобы чертёж совпадал с сайтом.
 * Полотно у каждой схемы своей высоты: у Хантуша ниже лежит второй песок,
 * у границы питания снизу помещаются два дополнительных размера.
 */

/** Ширина полотна, общая для всех схем */
export const WIDTH = 540;

/** Палитра веб-версии: от темы приложения не зависит */
export const PALETTE = {
  caption: '#7a7774',
  sand: '#e6d39a',
  clay: '#c5beb3',
  topsoil: '#efe6c9',
  water: '#7eb8c0',
  waterLine: '#6aa3ab',
  waterLabel: '#4f8e96',
  waterMark: '#3d9aa8',
  curve: '#4f9aa4',
  casing: '#fbfaf6',
  steel: '#6a6664',
  arrow: '#3d8a94',
  ink: '#555',
  muted: '#8a8884',
  sandLabel: '#8a8070',
  clayLabel: '#7a756c',
  river: '#6a9aa4',
  riverCrest: '#8fb4bc',
  riverLabel: '#f4f7f7',
};

/**
 * Разметка одной схемы
 *
 * `layers`  — слои разреза сверху вниз;
 * `wells`   — опытная и наблюдательная скважины с уровнями воды в стволах;
 * `labels`  — подписи пород;
 * `dims`    — горизонтальные размеры под разрезом.
 */
const LAYOUTS = {
  theis: {
    height: 256,
    layers: [
      { y: 28, h: 48, fill: PALETTE.clay },
      { y: 76, h: 112, fill: PALETTE.sand },
      { y: 188, h: 44, fill: PALETTE.clay },
    ],
    levelY: 46,
    levelRight: 532,
    levelLabel: 'schemeInitialHead',
    curve: 'M 50 46 C 177.6 46, 240 108, 270 108 C 300 108, 362.4 46, 490 46',
    pumped: { x: 262, top: 20, bottom: 188, waterY: 108 },
    observer: { x: 398, top: 20, bottom: 188, waterY: 85.68 },
    thickness: { x: 78, y1: 76, y2: 188, label: 'm', labelY: 136 },
    storageY: 132,
    storageX: 470,
    storageSub: null,
    labels: [
      { y: 56, key: 'schemeClay' },
      { y: 120, key: 'schemeSand' },
      { y: 214, key: 'schemeClay' },
    ],
    dims: [{ from: 270, to: 402, y: 198, label: 'r', labelY: 214 }],
  },

  hantush: {
    height: 276,
    layers: [
      { y: 28, h: 36, fill: PALETTE.clay },
      { y: 64, h: 87, fill: PALETTE.sand },
      { y: 151, h: 30, fill: PALETTE.clay },
      { y: 181, h: 51, fill: PALETTE.sand },
    ],
    levelY: 46,
    levelRight: 532,
    levelLabel: 'schemeInitialHead',
    curve: 'M 50 46 C 177.6 46, 240 108, 270 108 C 300 108, 362.4 46, 490 46',
    pumped: { x: 262, top: 20, bottom: 151, waterY: 108 },
    observer: { x: 398, top: 20, bottom: 151, waterY: 85.68 },
    thickness: { x: 78, y1: 64, y2: 151, label: 'm', labelY: 111.5 },
    storageY: 107.5,
    storageX: 470,
    storageSub: null,
    labels: [
      { y: 56, key: 'schemeAquitard' },
      { y: 95.5, key: 'schemeSand' },
      { y: 171, key: 'schemeAquitard' },
      { y: 210.5, key: 'schemeSand' },
    ],
    dims: [{ from: 270, to: 402, y: 246, label: 'r', labelY: 262 }],
  },

  boulton: {
    height: 256,
    layers: [
      { y: 40, h: 32, fill: PALETTE.topsoil },
      { y: 72, h: 116, fill: PALETTE.sand },
      { y: 188, h: 44, fill: PALETTE.clay },
    ],
    levelY: 72,
    levelRight: 532,
    levelLabel: 'schemeInitialGwl',
    curve: 'M 50 72 C 177.6 72, 240 128, 270 128 C 300 128, 362.4 72, 490 72',
    pumped: { x: 262, top: 32, bottom: 188, waterY: 128 },
    observer: { x: 398, top: 32, bottom: 188, waterY: 107.84 },
    thickness: { x: 78, y1: 72, y2: 188, label: 'h₀', labelY: 134 },
    storageY: 130,
    storageX: 470,
    // Безнапорный пласт отдаёт воду гравитационно, поэтому подписан Sy
    storageSub: 'y',
    labels: [
      { y: 118, key: 'schemeSand' },
      { y: 214, key: 'schemeClay' },
    ],
    dims: [{ from: 270, to: 402, y: 198, label: 'r', labelY: 214 }],
  },

  boundary: {
    height: 286,
    layers: [
      { y: 28, h: 48, fill: PALETTE.clay },
      { y: 76, h: 112, fill: PALETTE.sand },
      { y: 188, h: 44, fill: PALETTE.clay },
    ],
    // Река стоит справа, поэтому наблюдательная скважина уходит влево от
    // опытной: иначе размеры L_w и L_p наложились бы друг на друга
    river: { x: 462, y: 28, w: 78, h: 204, labelX: 484, labelY: 120 },
    levelY: 46,
    levelRight: 462,
    levelLabel: 'schemeInitialHead',
    curve: 'M 50 46 C 130 52, 260 108, 330 108 C 346 108, 432.96 53.44, 462 46',
    pumped: { x: 322, top: 20, bottom: 188, waterY: 108 },
    observer: { x: 194, top: 20, bottom: 188, waterY: 94.2208 },
    thickness: { x: 78, y1: 76, y2: 188, label: 'm', labelY: 136 },
    storageY: 132,
    storageX: 400,
    storageSub: null,
    labels: [
      { y: 56, key: 'schemeClay' },
      { y: 120, key: 'schemeSand' },
      { y: 214, key: 'schemeClay' },
    ],
    dims: [
      { from: 330, to: 198, y: 202, label: 'r', labelY: 218 },
      { from: 330, to: 462, y: 224, label: 'L_w', labelY: 240 },
      { from: 198, to: 462, y: 248, label: 'L_p', labelY: 264 },
    ],
  },
};

/**
 * Разметка схемы по идентификатору
 *
 * Неизвестная схема отдаёт Тейса: чертёж рисуется всегда, потому что стоит
 * рядом с полями ввода и не может пропадать, пока их заполняют.
 *
 * @param {string} scheme - идентификатор схемы, см. WELL_SCHEMES
 * @returns {Object} разметка чертежа
 */
export function wellSchemeLayout(scheme) {
  return LAYOUTS[scheme] || LAYOUTS.theis;
}

/**
 * Положение прорезей фильтра в стволе скважины
 *
 * Фильтр показывается штрихами по всей рабочей части ствола: без них
 * скважина читалась бы как глухая труба.
 *
 * @param {Object} well - описание скважины из разметки
 * @param {number} step - шаг штрихов, px
 * @returns {Array<number>} координаты y штрихов
 */
export function screenLines(well, step) {
  const start = well.top + 62;
  const lines = [];
  for (let y = start; y <= well.bottom - 4; y += step) lines.push(y);
  return lines;
}

export { LAYOUTS };
