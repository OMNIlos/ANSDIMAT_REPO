/**
 * Проверка учёта граничных условий методом отображений
 *
 * Эталоны выводятся из самой теории отображений, а не из реализации:
 * - на границе постоянного напора понижение обязано быть нулевым;
 * - непроницаемая граница удваивает понижение в точке на самой границе;
 * - пока фронт возмущения не дошёл до границы, решение совпадает
 *   с решением Тейса для бесконечного пласта.
 */

import { BOUNDARY_TYPES, barrageRise, drawdownWithBoundary, imageDistance } from '../boundaries';
import { wellFunction } from '../wellFunction';

describe('imageDistance', () => {
  test('точка на границе равноудалена от скважины и отображения', () => {
    // Скважина в 100 м от границы, точка наблюдения на самой границе
    expect(imageDistance(100, 100, 0)).toBeCloseTo(100, 10);
  });

  test('точка со стороны, противоположной границе', () => {
    // Скважина в 100 м от границы, точка в 50 м от скважины «наружу»
    // → до отображения 2·100 + 50 = 250 м
    expect(imageDistance(100, -50, 0)).toBeCloseTo(250, 10);
  });

  test('учитывает смещение вдоль границы', () => {
    // dx = 0, dy = 150, L = 100 → √(200² + 150²) = 250
    expect(imageDistance(100, 0, 150)).toBeCloseTo(250, 10);
  });

  test('за границей пласта решение неприменимо', () => {
    expect(imageDistance(100, 120, 0)).toBeNaN();
    expect(imageDistance(0, 10, 0)).toBeNaN();
  });
});

describe('drawdownWithBoundary', () => {
  const base = { Q: 1000, T: 500, S: 1e-4, t: 10 };

  test('на границе постоянного напора понижение равно нулю', () => {
    const { s } = drawdownWithBoundary({
      ...base,
      r: 100,
      L: 100,
      boundary: BOUNDARY_TYPES.RECHARGE,
    });
    expect(Math.abs(s)).toBeLessThan(1e-12);
  });

  test('на непроницаемой границе понижение удваивается', () => {
    const withBoundary = drawdownWithBoundary({
      ...base,
      r: 100,
      L: 100,
      boundary: BOUNDARY_TYPES.BARRIER,
    });
    expect(withBoundary.s).toBeCloseTo(2 * withBoundary.sInfinite, 10);
  });

  test('барраж углубляет воронку, река — выполаживает', () => {
    const params = { ...base, r: 50, L: 200 };
    const barrier = drawdownWithBoundary({ ...params, boundary: BOUNDARY_TYPES.BARRIER });
    const recharge = drawdownWithBoundary({ ...params, boundary: BOUNDARY_TYPES.RECHARGE });

    expect(barrier.s).toBeGreaterThan(barrier.sInfinite);
    expect(recharge.s).toBeLessThan(recharge.sInfinite);
    expect(barrier.effect).toBeGreaterThan(0);
    expect(recharge.effect).toBeLessThan(0);
  });

  test('понижение в бесконечном пласте совпадает с решением Тейса', () => {
    const { Q, T, S, t } = base;
    const r = 50;
    const u = (r * r * S) / (4 * T * t);
    const expected = (Q / (4 * Math.PI * T)) * wellFunction(u);

    const { sInfinite } = drawdownWithBoundary({ ...base, r, L: 1000 });
    expect(sInfinite).toBeCloseTo(expected, 10);
  });

  test('предупреждает, когда фронт ещё не дошёл до далёкой границы', () => {
    const { warnings, s, sInfinite } = drawdownWithBoundary({
      ...base,
      t: 0.001,
      r: 10,
      L: 5000,
    });
    expect(warnings).toContain('boundaryNotReached');
    // Влияние границы пока пренебрежимо мало
    expect(Math.abs(s - sInfinite) / sInfinite).toBeLessThan(1e-6);
  });

  test('точка за границей отбраковывается', () => {
    const { s, warnings } = drawdownWithBoundary({ ...base, r: 300, L: 100 });
    expect(s).toBeNaN();
    expect(warnings).toContain('observationBeyondBoundary');
  });

  test('возвращает NaN при неполных данных', () => {
    expect(drawdownWithBoundary({ ...base, r: 50 }).s).toBeNaN();
    expect(drawdownWithBoundary({ ...base, r: 0, L: 100 }).s).toBeNaN();
  });
});

describe('barrageRise', () => {
  test('подпор растёт с уклоном и длиной сооружения', () => {
    expect(barrageRise({ gradient: 0.01, barrierLength: 100 }).rise).toBeCloseTo(0.5, 10);
    expect(barrageRise({ gradient: 0.02, barrierLength: 100 }).rise).toBeCloseTo(1, 10);
  });

  test('возвращает NaN при неполных данных', () => {
    expect(barrageRise({ gradient: 0, barrierLength: 100 }).rise).toBeNaN();
    expect(barrageRise({ gradient: 0.01 }).rise).toBeNaN();
  });
});
