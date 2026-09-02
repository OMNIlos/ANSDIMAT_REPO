/**
 * Волна голосовой заметки
 *
 * Волна строится по реальному уровню сигнала, а не рисуется декоративным
 * узором: рекордер отдаёт metering в дБFS, здесь он переводится в 0..1 и
 * прореживается до числа столбиков, которое влезает в строку шириной с экран.
 *
 * Функции чистые и живут отдельно от хука записи: так их проверяет Jest без
 * нативных моков, а компонент волны не зависит от того, откуда пришли уровни.
 */

/**
 * Порог тишины
 *
 * Ниже -60 дБFS полевая запись не несёт ничего, кроме шума ветра, — тянуть
 * шкалу до -160, которые отдаёт рекордер, значило бы прижать всю речь
 * к верхней трети столбика.
 */
export const SILENCE_FLOOR_DB = -60;

/** Сколько столбиков хранится у сохранённой записи */
export const WAVEFORM_BARS = 40;

/**
 * Переводит уровень рекордера в высоту столбика
 *
 * @param {number|undefined} db - уровень в дБFS
 * @returns {number} 0..1
 */
export function levelFromMetering(db) {
  // В вебе getStatus не отдаёт metering вовсе — там волна будет ровной,
  // и это честнее, чем подрисовать её случайными числами
  if (typeof db !== 'number' || Number.isNaN(db)) return 0;

  const level = (db - SILENCE_FLOOR_DB) / -SILENCE_FLOOR_DB;
  return Math.min(1, Math.max(0, level));
}

/**
 * Округляет до сотых
 *
 * Волна лежит в базе строкой JSON, и полная точность double раздувала бы её
 * в десять раз, ничего не добавляя к картинке из сорока столбиков.
 *
 * @param {number} value - уровень
 * @returns {number} уровень с двумя знаками
 */
const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Сжимает набор уровней до числа столбиков
 *
 * Берётся пик окна, а не среднее: усреднение съедает короткие всплески речи,
 * и волна вырождается в ровную полосу, по которой запись не отличить от
 * тишины.
 *
 * @param {number[]} levels - уровни 0..1
 * @param {number} [bars] - сколько столбиков оставить
 * @returns {number[]} прореженные уровни
 */
export function condense(levels, bars = WAVEFORM_BARS) {
  if (levels.length === 0) return [];
  if (levels.length <= bars) return levels.map(round2);

  const condensed = [];
  for (let index = 0; index < bars; index++) {
    const from = Math.floor((index * levels.length) / bars);
    const to = Math.floor(((index + 1) * levels.length) / bars);

    let peak = 0;
    for (let cursor = from; cursor < to; cursor++) {
      peak = Math.max(peak, levels[cursor]);
    }
    condensed.push(round2(peak));
  }
  return condensed;
}

/**
 * Выводит длительность записи
 *
 * Минуты без ведущего нуля, секунды с ним: полевая заметка редко длиннее
 * пары минут, и «0:07» читается быстрее, чем «00:07».
 *
 * @param {number} millis - длительность в миллисекундах
 * @returns {string} длительность вида «1:14»
 */
export function formatDuration(millis) {
  const total = Math.max(0, Math.round(millis / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
