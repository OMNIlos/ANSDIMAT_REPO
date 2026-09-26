/**
 * Показ числа во всю ширину строки
 *
 * Коэффициенты Бауэра — Райса и ln(R/r_w) расчёт держит во всей точности
 * double, а экран сокращает только запись — ровно до ширины строки. Здесь
 * проверяется, что сокращение округляет, а не отрезает, не вылезает за
 * отведённые знаки и не выдаёт за цифры двоичный шум после пятнадцатого знака.
 */

import {
  formatFitting,
  formatPrecise,
  monoCapacity,
  MAX_SHOWN_DIGITS,
  MIN_SHOWN_DIGITS,
} from '../shared';

// A₁ при β = 158 (фильтр 7.9 м, r_w = 0.05 м) и ln(R/r_w) того же опыта —
// в том виде, в каком их держит расчёт
const A1 = 5.4527630887013565;
const LN_R = 3.9758177012474927;

describe('formatFitting', () => {
  test('в широкой строке показывает пятнадцать значащих цифр', () => {
    expect(MAX_SHOWN_DIGITS).toBe(15);
    expect(formatFitting(A1, 40)).toBe('5.45276308870136');
  });

  test('в узкой — столько цифр, сколько влезает', () => {
    expect(formatFitting(A1, 9)).toBe('5.4527631');
    expect(formatFitting(A1, 8)).toBe('5.452763');
  });

  test('сокращает округлением, а не отрезанием', () => {
    // 3.9758177… шестью цифрами — 3.97582, а не 3.97581
    expect(formatFitting(LN_R, 7)).toBe('3.97582');
  });

  test('запись не длиннее отведённого места', () => {
    const values = [A1, LN_R, -0.0651429, 158, 4.158205756582884e-4, 1.23456789e-7, 123456.789];
    for (const value of values) {
      for (let chars = 10; chars <= 30; chars += 1) {
        expect(formatFitting(value, chars).length).toBeLessThanOrEqual(chars);
      }
    }
  });

  test('хвостовые нули не дописывает — ни в обычной записи, ни в экспоненциальной', () => {
    expect(formatFitting(158, 40)).toBe('158');
    expect(formatFitting(6.89, 40)).toBe('6.89');
    expect(formatFitting(1.23456789e-7, 40)).toBe('1.23456789e-7');
  });

  test('меньше четырёх цифр не показывает даже в самой узкой строке', () => {
    // Урезанное до одной цифры «5» выглядело бы значением, а не сокращением
    expect(MIN_SHOWN_DIGITS).toBe(4);
    expect(formatFitting(A1, 2)).toBe('5.453');
  });

  test('пока ширина не измерена, показывает девять цифр', () => {
    expect(formatFitting(A1, NaN)).toBe(formatPrecise(A1));
    expect(formatFitting(A1, NaN)).toBe('5.45276309');
  });

  test('нечисловое значение — прочерк', () => {
    expect(formatFitting(NaN, 40)).toBe('—');
    expect(formatFitting(Infinity, 40)).toBe('—');
  });
});

describe('monoCapacity', () => {
  test('знаков в строке — ширина, делённая на ширину знака JetBrains Mono', () => {
    // Кегль 12: знак 0.6·12 = 7.2 px, в 300 px помещается 41 знак
    expect(monoCapacity(300, 12)).toBe(41);
    // Кегль 14: знак 8.4 px
    expect(monoCapacity(300, 14)).toBe(35);
  });

  test('крупный шрифт системы уменьшает число знаков', () => {
    expect(monoCapacity(300, 12, 2)).toBe(20);
  });

  test('строка ровно во всю ширину теряет знак на запас', () => {
    // 40·7.2 = 288: без запаса такая строка переносится от округления до
    // пикселей устройства
    expect(monoCapacity(288, 12)).toBe(39);
    expect(monoCapacity(289.1, 12)).toBe(40);
  });

  test('до замера ширины знаков нет', () => {
    expect(monoCapacity(NaN, 12)).toBeNaN();
    expect(monoCapacity(0, 12)).toBeNaN();
  });
});
