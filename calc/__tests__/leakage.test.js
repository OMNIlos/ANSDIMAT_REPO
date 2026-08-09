/**
 * Проверка расчётов пласта с перетеканием
 *
 * Эталоны независимы от реализации:
 * - K₀(x) — табличные значения модифицированной функции Бесселя;
 * - W(u, β) при u → 0 обязана сходиться к 2·K₀(β) (стационарный предел
 *   решения Хантуша — Джейкоба, он же решение Де Глее);
 * - W(u, 0) совпадает с функцией скважины Тейса W(u).
 */

import {
  besselK0,
  hantushWellFunction,
  leakageFactor,
  leakageRate,
  leakyDrawdown,
  steadyLeakyDrawdown,
} from '../leakage';
import { wellFunction } from '../wellFunction';

describe('besselK0', () => {
  // x → K₀(x), значения из таблиц Абрамовица и Стигана
  const TABLE = [
    [0.1, 2.427069],
    [0.5, 0.924419],
    [1.0, 0.421024],
    [2.0, 0.1138939],
    [3.0, 0.0347395],
    [5.0, 0.00369110],
    [10.0, 1.778006e-5],
  ];

  test.each(TABLE)('K₀(%p) ≈ %p', (x, expected) => {
    expect(Math.abs(besselK0(x) - expected) / expected).toBeLessThan(1e-4);
  });

  test('возвращает NaN для недопустимых аргументов', () => {
    expect(besselK0(0)).toBeNaN();
    expect(besselK0(-1)).toBeNaN();
    expect(besselK0(NaN)).toBeNaN();
  });

  test('монотонно убывает', () => {
    const values = [0.1, 0.5, 1, 2, 5, 10].map(besselK0);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });
});

describe('hantushWellFunction', () => {
  test('при β = 0 совпадает с функцией скважины Тейса', () => {
    [1e-4, 1e-2, 0.1, 1].forEach((u) => {
      const hantush = hantushWellFunction(u, 0);
      const theis = wellFunction(u);
      expect(Math.abs(hantush - theis) / theis).toBeLessThan(1e-3);
    });
  });

  test('при малых u сходится к стационарному пределу 2·K₀(β)', () => {
    [0.05, 0.2, 0.5, 1, 2].forEach((beta) => {
      const limit = 2 * besselK0(beta);
      const value = hantushWellFunction(1e-10, beta);
      expect(Math.abs(value - limit) / limit).toBeLessThan(1e-3);
    });
  });

  test('перетекание уменьшает понижение: W(u, β) < W(u, 0)', () => {
    const u = 1e-3;
    expect(hantushWellFunction(u, 0.5)).toBeLessThan(hantushWellFunction(u, 0));
    expect(hantushWellFunction(u, 1)).toBeLessThan(hantushWellFunction(u, 0.5));
  });

  test('возвращает NaN для недопустимых аргументов', () => {
    expect(hantushWellFunction(0, 1)).toBeNaN();
    expect(hantushWellFunction(1, -1)).toBeNaN();
  });
});

describe('leakageFactor', () => {
  test('считает B = √(T·m′/k′)', () => {
    // T = 500, m′ = 5, k′ = 0.01 → B = √(500·5/0.01) = √250000 = 500
    expect(leakageFactor({ T: 500, aquitardThickness: 5, aquitardK: 0.01 })).toBeCloseTo(500, 6);
  });

  test('чем хуже проницаемость кровли, тем больше B', () => {
    const tight = leakageFactor({ T: 500, aquitardThickness: 5, aquitardK: 1e-4 });
    const leaky = leakageFactor({ T: 500, aquitardThickness: 5, aquitardK: 1e-2 });
    expect(tight).toBeGreaterThan(leaky);
  });

  test('возвращает NaN при неполных данных', () => {
    expect(leakageFactor({ T: 0, aquitardThickness: 5, aquitardK: 0.01 })).toBeNaN();
    expect(leakageFactor({ T: 500, aquitardThickness: 5 })).toBeNaN();
  });
});

describe('steadyLeakyDrawdown', () => {
  test('совпадает с формулой Де Глее', () => {
    const Q = 1000;
    const T = 500;
    const r = 100;
    const B = 400;
    const expected = (Q / (2 * Math.PI * T)) * besselK0(r / B);
    expect(steadyLeakyDrawdown({ Q, T, r, B }).s).toBeCloseTo(expected, 10);
  });

  test('нестационарное решение при больших временах выходит на стационар', () => {
    const params = { Q: 1000, T: 500, S: 1e-4, r: 100, B: 400 };
    const late = leakyDrawdown({ ...params, t: 1e6 }).s;
    const steady = steadyLeakyDrawdown(params).s;
    expect(Math.abs(late - steady) / steady).toBeLessThan(1e-3);
  });
});

describe('leakyDrawdown', () => {
  test('перетекание даёт меньшее понижение, чем изолированный пласт', () => {
    const params = { Q: 1000, T: 500, S: 1e-4, r: 100, t: 10 };
    const leaky = leakyDrawdown({ ...params, B: 200 }).s;
    const theis = (params.Q / (4 * Math.PI * params.T)) *
      wellFunction((params.r * params.r * params.S) / (4 * params.T * params.t));
    expect(leaky).toBeLessThan(theis);
  });

  test('возвращает NaN при неполных данных', () => {
    expect(leakyDrawdown({ Q: 1000, T: 500, S: 1e-4, r: 100, t: 10 }).s).toBeNaN();
  });
});

describe('leakageRate', () => {
  test('считает модуль утечки по закону Дарси', () => {
    // k′ = 0.01 м/сут, s = 2 м, m′ = 5 м → w = 0.004 м/сут
    const { rate, total } = leakageRate({
      s: 2,
      aquitardThickness: 5,
      aquitardK: 0.01,
      area: 10000,
    });
    expect(rate).toBeCloseTo(0.004, 10);
    expect(total).toBeCloseTo(40, 10);
  });

  test('без площади расход не считается', () => {
    const { rate, total } = leakageRate({ s: 2, aquitardThickness: 5, aquitardK: 0.01 });
    expect(rate).toBeCloseTo(0.004, 10);
    expect(total).toBeNaN();
  });
});
