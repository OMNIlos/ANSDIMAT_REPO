/**
 * Оценка параметров по удельному дебиту
 *
 * Эталон — окно «Оценка параметров» настольного АНСДИМАТ, вкладка
 * «Проводимость», пример из справки. Числа должны сходиться один в один:
 * человек сверяет вкладку с настольной версией, открыв обе рядом.
 */

import {
  AQUIFERS,
  estimateFromSpecificCapacity,
  imperfectionTerm,
} from '../specificCapacity';

/** Пример из справки настольной версии */
const DESKTOP = { Q: 100, s: 15, m: 20, lw: 2, zw: 10, rw: 0.1, anisotropy: 1 };

describe('estimateFromSpecificCapacity', () => {
  test('напорный пласт, совершенная скважина: T = 1.22·Q/s', () => {
    const result = estimateFromSpecificCapacity({ Q: 100, s: 15, aquifer: AQUIFERS.CONFINED });

    expect(result.quantity).toBe('T');
    expect(result.value).toBeCloseTo(8.133333, 5);
    expect(result.secondary).toBeNaN();
    expect(result.f).toBeNaN();
    expect(result.invalid).toEqual([]);
  });

  test('напорный пласт, несовершенная скважина: как в настольной версии', () => {
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.value).toBeCloseTo(31.44454, 4);
    expect(result.f).toBeCloseTo(43.94059, 4);
    // k = T/m: в настольной версии — всплывающая подсказка у поля результата
    expect(result.secondary).toBeCloseTo(31.44454 / 20, 4);
  });

  test('безнапорный пласт, совершенная скважина: k = 2.43·Q/(s·(2m − s))', () => {
    const result = estimateFromSpecificCapacity({
      Q: 100,
      s: 15,
      m: 20,
      aquifer: AQUIFERS.UNCONFINED,
    });

    expect(result.quantity).toBe('k');
    expect(result.value).toBeCloseTo(0.648, 6);
    expect(result.secondary).toBeCloseTo(12.96, 6);
  });

  test('безнапорный пласт, несовершенная скважина', () => {
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      aquifer: AQUIFERS.UNCONFINED,
      imperfect: true,
    });

    // f та же, что в напорном примере: k = Q/(s·(2m − s))·(2.43 + f/2π)
    expect(result.value).toBeCloseTo(2.512896, 5);
  });

  test('фильтр на всю мощность: поправка нулевая, результат как у совершенной', () => {
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      lw: 20,
      zw: 10,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.f).toBeCloseTo(0, 8);
    expect(result.value).toBeCloseTo(8.133333, 5);
    expect(result.warnings).toContain('filterFullThickness');
  });

  test('фильтр за пределами пласта — ошибка, результата нет', () => {
    // z₁ = 0.5 − 1 < 0: верх фильтра выше кровли
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      zw: 0.5,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.errors).toEqual(['filterOutsideAquifer']);
    expect(result.value).toBeNaN();
  });

  test('безнапорный: понижение не меньше мощности — ошибка', () => {
    const result = estimateFromSpecificCapacity({
      Q: 100,
      s: 20,
      m: 20,
      aquifer: AQUIFERS.UNCONFINED,
    });

    expect(result.errors).toEqual(['drawdownExceedsThickness']);
    expect(result.value).toBeNaN();
  });

  test('пустые и недопустимые поля перечисляются, результата нет', () => {
    const result = estimateFromSpecificCapacity({
      Q: NaN,
      s: 0,
      m: 20,
      lw: 2,
      zw: 10,
      rw: undefined,
      anisotropy: -1,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.invalid).toEqual(['Q', 's', 'rw', 'anisotropy']);
    expect(result.value).toBeNaN();
  });

  test('совершенной скважине в напорном пласте мощность не нужна', () => {
    const result = estimateFromSpecificCapacity({ Q: 100, s: 15, m: NaN });

    expect(result.invalid).toEqual([]);
    expect(result.value).toBeCloseTo(8.133333, 5);
  });
});

describe('imperfectionTerm', () => {
  test('оценка хвоста ряда сходится с прямым суммированием', () => {
    // r_w/m мал, и прямое суммирование требует 254 648 членов. С лимитом
    // в 2000 членов остальное оценивается интегралом
    const params = { m: 20, lw: 2, zw: 10, rw: 0.001, anisotropy: 1 };

    const exact = imperfectionTerm(params, { maxTerms: 1_000_000 });
    const approx = imperfectionTerm(params, { maxTerms: 2000 });

    expect(exact).toBeCloseTo(125.85617, 4);
    expect(Math.abs(approx - exact) / exact).toBeLessThan(1e-6);
  });

  test('слабая вертикальная проницаемость увеличивает поправку', () => {
    const base = { m: 20, lw: 2, zw: 10, rw: 0.1 };

    expect(imperfectionTerm({ ...base, anisotropy: 0.1 })).toBeGreaterThan(
      imperfectionTerm({ ...base, anisotropy: 1 })
    );
  });

  test('невозможная геометрия даёт NaN', () => {
    expect(imperfectionTerm({ m: 20, lw: 2, zw: 0.5, rw: 0.1 })).toBeNaN();
    expect(imperfectionTerm({ m: 20, lw: 0, zw: 10, rw: 0.1 })).toBeNaN();
  });
});
