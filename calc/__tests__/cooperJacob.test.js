/**
 * Проверка графоаналитической обработки методом Купера — Джейкоба
 */

import {
  linearRegression,
  lineThroughPoints,
  transmissivityFromSlope,
  storativityFromIntercept,
  transformTime,
  processDrawdown,
  COOPER_JACOB_FACTOR,
  X_MODES,
} from '../cooperJacob';

describe('COOPER_JACOB_FACTOR', () => {
  test('равен 0.183 — это 2.3/(4π), а не подгоночное число', () => {
    expect(COOPER_JACOB_FACTOR).toBeCloseTo(0.183, 3);
  });
});

describe('transformTime', () => {
  test('логарифмический режим', () => {
    expect(transformTime(100, X_MODES.LOG)).toBeCloseTo(2, 12);
    expect(transformTime(0, X_MODES.LOG)).toBeNull();
    expect(transformTime(-5, X_MODES.LOG)).toBeNull();
  });

  test('корневой режим', () => {
    expect(transformTime(16, X_MODES.SQRT)).toBeCloseTo(4, 12);
    expect(transformTime(-1, X_MODES.SQRT)).toBeNull();
  });

  test('линейный режим', () => {
    expect(transformTime(42, X_MODES.LINEAR)).toBe(42);
  });
});

describe('linearRegression', () => {
  test('точно восстанавливает прямую без шума', () => {
    const points = [1, 2, 3, 4, 5].map((x) => ({ x, y: 3 * x + 7 }));
    const { slope, intercept, r2 } = linearRegression(points);

    expect(slope).toBeCloseTo(3, 10);
    expect(intercept).toBeCloseTo(7, 10);
    expect(r2).toBeCloseTo(1, 10);
  });

  test('требует минимум две точки', () => {
    expect(linearRegression([{ x: 1, y: 1 }]).slope).toBeNaN();
    expect(linearRegression([]).slope).toBeNaN();
  });

  test('возвращает NaN для вертикального набора точек', () => {
    const points = [
      { x: 2, y: 1 },
      { x: 2, y: 5 },
    ];
    expect(linearRegression(points).slope).toBeNaN();
  });

  test('игнорирует нечисловые точки', () => {
    const points = [
      { x: 1, y: 10 },
      { x: NaN, y: 20 },
      { x: 2, y: 20 },
      { x: 3, y: Infinity },
    ];
    expect(linearRegression(points).count).toBe(2);
  });
});

describe('lineThroughPoints', () => {
  test('строит прямую точно через обе точки', () => {
    const a = { x: 1, y: 0.4 };
    const b = { x: 3, y: 1.2 };
    const { slope, intercept } = lineThroughPoints(a, b);

    expect(slope).toBeCloseTo(0.4, 12);
    // Прямая обязана пройти ровно через заданные точки
    expect(slope * a.x + intercept).toBeCloseTo(a.y, 12);
    expect(slope * b.x + intercept).toBeCloseTo(b.y, 12);
  });

  test('порядок точек не влияет на результат', () => {
    const a = { x: 2, y: 1 };
    const b = { x: 5, y: 2.5 };
    const forward = lineThroughPoints(a, b);
    const backward = lineThroughPoints(b, a);

    expect(forward.slope).toBeCloseTo(backward.slope, 12);
    expect(forward.intercept).toBeCloseTo(backward.intercept, 12);
  });

  test('совпадает с регрессией, когда точек ровно две', () => {
    const a = { x: 1, y: 0.5 };
    const b = { x: 4, y: 1.7 };
    const line = lineThroughPoints(a, b);
    const fit = linearRegression([a, b]);

    expect(line.slope).toBeCloseTo(fit.slope, 10);
    expect(line.intercept).toBeCloseTo(fit.intercept, 10);
  });

  test('вертикальная пара и пропуски дают NaN', () => {
    expect(lineThroughPoints({ x: 2, y: 1 }, { x: 2, y: 5 }).slope).toBeNaN();
    expect(lineThroughPoints(null, { x: 1, y: 1 }).slope).toBeNaN();
    expect(lineThroughPoints({ x: 1, y: 1 }, undefined).slope).toBeNaN();
  });

  test('по двум точкам восстанавливается заданная T', () => {
    const Q = 1200;
    const T = 480;
    const slope = (COOPER_JACOB_FACTOR * Q) / T;

    // Две точки, лежащие на прямой Купера — Джейкоба
    const first = { x: Math.log10(10), y: slope * Math.log10(10) + 0.2 };
    const second = { x: Math.log10(100), y: slope * Math.log10(100) + 0.2 };

    const line = lineThroughPoints(first, second);
    expect(transmissivityFromSlope(Q, line.slope)).toBeCloseTo(T, 6);
  });
});

describe('transmissivityFromSlope', () => {
  test('T = 0.183·Q/a', () => {
    expect(transmissivityFromSlope(1000, 0.5)).toBeCloseTo((0.183 * 1000) / 0.5, 0);
  });

  test('использует модуль наклона — знак зависит от направления оси', () => {
    expect(transmissivityFromSlope(1000, -0.5)).toBeCloseTo(transmissivityFromSlope(1000, 0.5), 10);
  });

  test('возвращает NaN при нулевом наклоне', () => {
    expect(transmissivityFromSlope(1000, 0)).toBeNaN();
  });
});

describe('storativityFromIntercept', () => {
  test('обратная проверка: восстанавливает заданную водоотдачу', () => {
    const T = 500;
    const S = 1e-4;
    const r = 50;

    // Прямая Купера — Джейкоба: s = a·lg t + b, время в минутах.
    // При s = 0: t₀ = 2.25·T·r⁻²·S⁻¹ в сутках
    const t0Days = (S * r * r) / (2.25 * T);
    const t0Minutes = t0Days * 1440;
    const slope = 0.4;
    const intercept = -slope * Math.log10(t0Minutes);

    const restored = storativityFromIntercept(T, slope, intercept, r);
    expect(restored).toBeCloseTo(S, 10);
  });
});

describe('processDrawdown', () => {
  test('восстанавливает T из синтетического ряда Купера — Джейкоба', () => {
    const Q = 1200;
    const T = 480;
    // Наклон, который даёт заданную T
    const slope = (COOPER_JACOB_FACTOR * Q) / T;

    const measurements = [1, 2, 5, 10, 30, 60, 120].map((t) => ({
      t,
      s: slope * Math.log10(t) + 0.2,
    }));

    const result = processDrawdown({ measurements, Q, mode: X_MODES.LOG });

    expect(result.applicable).toBe(true);
    expect(result.slope).toBeCloseTo(slope, 10);
    expect(result.T).toBeCloseTo(T, 6);
    expect(result.r2).toBeCloseTo(1, 10);
  });

  test('в линейном режиме T не считается', () => {
    const measurements = [1, 2, 5].map((t) => ({ t, s: t * 0.1 }));
    const result = processDrawdown({ measurements, Q: 1000, mode: X_MODES.LINEAR });

    expect(result.applicable).toBe(false);
    expect(result.T).toBeNaN();
    expect(result.note).toBe('switchToLogMode');
  });

  test('сообщает о нехватке замеров', () => {
    const result = processDrawdown({ measurements: [{ t: 1, s: 0.5 }], Q: 1000 });
    expect(result.note).toBe('needMoreMeasurements');
  });

  test('отбрасывает замеры с нулевым временем в логарифмическом режиме', () => {
    const measurements = [
      { t: 0, s: 0 },
      { t: 10, s: 0.5 },
      { t: 100, s: 1.0 },
    ];
    const result = processDrawdown({ measurements, Q: 1000, mode: X_MODES.LOG });
    expect(result.count).toBe(2);
  });
});
