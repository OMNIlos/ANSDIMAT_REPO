/**
 * Волна голосовой заметки
 *
 * Волна строится по реальному уровню сигнала, а не рисуется узором, поэтому
 * проверяются обе стороны договора: перевод дБFS в 0..1 и прореживание
 * набора до числа столбиков, которое влезает в строку.
 */

const {
  SILENCE_FLOOR_DB,
  WAVEFORM_BARS,
  levelFromMetering,
  condense,
  formatDuration,
} = require('../waveform');

test('тишина даёт ноль, максимум — единицу', () => {
  expect(levelFromMetering(SILENCE_FLOOR_DB)).toBe(0);
  expect(levelFromMetering(0)).toBe(1);
});

test('уровень ниже порога не уходит в минус', () => {
  // Ниже -60 дБFS полевая запись не несёт ничего, кроме шума ветра,
  // а отрицательная высота столбика сломала бы отрисовку
  expect(levelFromMetering(-120)).toBe(0);
});

test('отсутствующий уровень считается тишиной', () => {
  // В вебе getStatus не отдаёт metering вовсе
  expect(levelFromMetering(undefined)).toBe(0);
  expect(levelFromMetering(NaN)).toBe(0);
});

test('середина шкалы попадает в середину', () => {
  expect(levelFromMetering(-30)).toBeCloseTo(0.5, 5);
});

test('короткий набор прореживанию не подвергается', () => {
  expect(condense([0.1, 0.9], 40)).toEqual([0.1, 0.9]);
});

test('длинный набор сжимается до заданного числа столбиков', () => {
  const levels = Array.from({ length: 500 }, (_, i) => (i % 10) / 10);

  expect(condense(levels, 40)).toHaveLength(40);
});

test('прореживание берёт пик, а не среднее', () => {
  // Усреднение съедает короткие всплески речи, и волна вырождается
  // в ровную полосу — по такой картинке запись не отличить от тишины
  const levels = [0, 0, 0, 1, 0, 0, 0, 0];

  expect(condense(levels, 2)).toEqual([1, 0]);
});

test('пустой набор даёт пустую волну', () => {
  expect(condense([], 40)).toEqual([]);
});

test('уровни округляются до сотых — волна лежит в базе строкой', () => {
  expect(condense([0.123456, 0.987654], 40)).toEqual([0.12, 0.99]);
});

test('по умолчанию столбиков WAVEFORM_BARS', () => {
  const levels = Array.from({ length: 500 }, () => 0.5);

  expect(condense(levels)).toHaveLength(WAVEFORM_BARS);
});

test('длительность выводится как М:СС', () => {
  expect(formatDuration(0)).toBe('0:00');
  expect(formatDuration(7_000)).toBe('0:07');
  expect(formatDuration(74_000)).toBe('1:14');
  expect(formatDuration(605_000)).toBe('10:05');
});
