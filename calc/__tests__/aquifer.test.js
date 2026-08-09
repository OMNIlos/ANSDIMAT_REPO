/**
 * Проверка расчётов фильтрационных параметров
 */

import {
  estimateConductivity,
  predictDrawdownTheis,
  pitInflow,
  equivalentPitRadius,
  kozenyPenetrationFactor,
  AQUIFER_TYPES,
} from '../aquifer';
import { wellFunction } from '../wellFunction';

describe('estimateConductivity', () => {
  test('напорный пласт: обратная проверка через формулу Дюпюи', () => {
    // Задаём k, считаем дебит по Дюпюи, затем восстанавливаем k
    const k = 5;
    const m = 20;
    const s = 3;
    const R = 300;
    const r0 = 0.1;
    const Q = (2 * Math.PI * k * m * s) / Math.log(R / r0);

    const { k: restored } = estimateConductivity({
      Q,
      s,
      m,
      aquiferType: AQUIFER_TYPES.CONFINED,
      R,
      r0,
    });

    expect(restored).toBeCloseTo(k, 8);
  });

  test('безнапорный пласт: обратная проверка через формулу Дюпюи', () => {
    const k = 8;
    const m = 25;
    const s = 4;
    const R = 500;
    const r0 = 0.15;
    const Q = (Math.PI * k * s * (2 * m - s)) / Math.log(R / r0);

    const { k: restored } = estimateConductivity({
      Q,
      s,
      m,
      aquiferType: AQUIFER_TYPES.UNCONFINED,
      R,
      r0,
    });

    expect(restored).toBeCloseTo(k, 8);
  });

  test('без R и r₀ подставляет отношение по умолчанию и предупреждает', () => {
    const { k, warnings } = estimateConductivity({
      Q: 100,
      s: 3,
      m: 20,
      aquiferType: AQUIFER_TYPES.CONFINED,
    });

    expect(warnings).toContain('defaultInfluenceRatio');
    expect(k).toBeGreaterThan(0);
  });

  test('предупреждает, когда понижение превышает мощность безнапорного пласта', () => {
    const { warnings } = estimateConductivity({
      Q: 100,
      s: 25,
      m: 20,
      aquiferType: AQUIFER_TYPES.UNCONFINED,
      R: 300,
      r0: 0.1,
    });

    expect(warnings).toContain('drawdownExceedsThickness');
  });

  test('несовершенная скважина даёт большее k, чем совершенная', () => {
    const base = {
      Q: 100,
      s: 3,
      m: 20,
      aquiferType: AQUIFER_TYPES.CONFINED,
      R: 300,
      r0: 0.1,
    };

    const perfect = estimateConductivity(base);
    const imperfect = estimateConductivity({
      ...base,
      imperfect: true,
      penetrationRatio: 0.4,
    });

    expect(imperfect.k).toBeGreaterThan(perfect.k);
  });

  test('возвращает NaN при недостаточных данных', () => {
    expect(estimateConductivity({ Q: 0, s: 3, m: 20 }).k).toBeNaN();
    expect(estimateConductivity({ Q: 100, s: 0, m: 20 }).k).toBeNaN();
    expect(estimateConductivity({ Q: 100, s: 3, m: 0 }).k).toBeNaN();
  });
});

describe('kozenyPenetrationFactor', () => {
  test('совершенная скважина не корректируется', () => {
    expect(kozenyPenetrationFactor(1, 0.1, 20)).toBe(1);
    expect(kozenyPenetrationFactor(NaN, 0.1, 20)).toBe(1);
  });

  test('коэффициент растёт с долей вскрытия', () => {
    const low = kozenyPenetrationFactor(0.2, 0.1, 20);
    const high = kozenyPenetrationFactor(0.8, 0.1, 20);
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeLessThanOrEqual(1);
  });
});

describe('predictDrawdownTheis', () => {
  test('совпадает с ручным расчётом по формуле Тейса', () => {
    const Q = 1000;
    const T = 500;
    const S = 1e-4;
    const r = 50;
    const t = 1;

    const { s, u, W } = predictDrawdownTheis({ Q, T, S, r, t }, wellFunction);

    const expectedU = (r * r * S) / (4 * T * t);
    expect(u).toBeCloseTo(expectedU, 12);
    expect(W).toBeCloseTo(wellFunction(expectedU), 12);
    expect(s).toBeCloseTo((Q / (4 * Math.PI * T)) * W, 12);
  });

  test('понижение растёт со временем', () => {
    const base = { Q: 1000, T: 500, S: 1e-4, r: 50 };
    const early = predictDrawdownTheis({ ...base, t: 0.1 }, wellFunction).s;
    const late = predictDrawdownTheis({ ...base, t: 10 }, wellFunction).s;
    expect(late).toBeGreaterThan(early);
  });

  test('понижение убывает с расстоянием', () => {
    const base = { Q: 1000, T: 500, S: 1e-4, t: 1 };
    const near = predictDrawdownTheis({ ...base, r: 10 }, wellFunction).s;
    const far = predictDrawdownTheis({ ...base, r: 200 }, wellFunction).s;
    expect(near).toBeGreaterThan(far);
  });

  test('возвращает NaN при недопустимых данных', () => {
    expect(predictDrawdownTheis({ Q: 0, T: 500, S: 1e-4, r: 50, t: 1 }, wellFunction).s).toBeNaN();
    expect(predictDrawdownTheis({ Q: 100, T: 500, S: 1e-4, r: 50, t: 0 }, wellFunction).s).toBeNaN();
  });
});

describe('pitInflow', () => {
  test('считает приток по формуле Дюпюи', () => {
    const k = 10;
    const m = 15;
    const s0 = 5;
    const R = 400;
    const r0 = 20;

    const { Q } = pitInflow({ k, m, s0, R, r0 });
    const expected = (2 * Math.PI * k * m * s0) / Math.log(R / r0);

    expect(Q).toBeCloseTo(expected, 8);
  });

  test('возвращает NaN, если радиус влияния не больше радиуса котлована', () => {
    expect(pitInflow({ k: 10, m: 15, s0: 5, R: 20, r0: 20 }).Q).toBeNaN();
    expect(pitInflow({ k: 10, m: 15, s0: 5, R: 10, r0: 20 }).Q).toBeNaN();
  });
});

describe('equivalentPitRadius', () => {
  test('переводит площадь в приведённый радиус', () => {
    // Круг площадью πr² должен дать обратно r
    const r = 12;
    expect(equivalentPitRadius(Math.PI * r * r)).toBeCloseTo(r, 10);
  });

  test('возвращает NaN для неположительной площади', () => {
    expect(equivalentPitRadius(0)).toBeNaN();
    expect(equivalentPitRadius(-5)).toBeNaN();
  });
});
