/**
 * Проверка прогноза понижения по Тейсу
 */

import { predictDrawdownTheis } from '../aquifer';
import { wellFunction } from '../wellFunction';

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
