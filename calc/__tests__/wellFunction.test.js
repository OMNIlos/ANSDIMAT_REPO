/**
 * Проверка функции скважины W(u) по табличным значениям
 *
 * Эталон — классическая таблица W(u) (Wenzel, 1942; воспроизводится
 * в Kruseman & de Ridder, «Analysis and Evaluation of Pumping Test Data»,
 * Annex 1). Значения независимы от нашей реализации.
 */

import { wellFunction } from '../wellFunction';

describe('wellFunction', () => {
  // u → W(u) из таблицы Kruseman & de Ridder
  const TABLE = [
    [1e-10, 22.4486],
    [1e-8, 17.8435],
    [1e-6, 13.2383],
    [1e-5, 10.9357],
    [1e-4, 8.6332],
    [1e-3, 6.3315],
    [1e-2, 4.0379],
    [0.05, 2.4679],
    [0.1, 1.8229],
    [0.5, 0.5598],
    [1.0, 0.2194],
    [2.0, 0.04890],
    [5.0, 0.001148],
  ];

  test.each(TABLE)('W(%p) ≈ %p', (u, expected) => {
    const actual = wellFunction(u);
    // Относительная погрешность не хуже 0.1 %
    expect(Math.abs(actual - expected) / expected).toBeLessThan(1e-3);
  });

  test('возвращает NaN для недопустимых аргументов', () => {
    expect(wellFunction(0)).toBeNaN();
    expect(wellFunction(-1)).toBeNaN();
    expect(wellFunction(NaN)).toBeNaN();
    expect(wellFunction(Infinity)).toBeNaN();
  });

  test('монотонно убывает', () => {
    const values = [1e-6, 1e-4, 1e-2, 0.1, 1, 5].map(wellFunction);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });

  test('при малых u стремится к -γ - ln(u)', () => {
    const u = 1e-9;
    const asymptotic = -0.5772156649 - Math.log(u);
    expect(Math.abs(wellFunction(u) - asymptotic)).toBeLessThan(1e-6);
  });
});
