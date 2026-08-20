/**
 * Проверка разметки полотна графиков
 */

import {
  plotArea,
  linearScale,
  logScale,
  niceTicks,
  decadeTicks,
  polyline,
  HEIGHT,
} from '../plotArea';

describe('plotArea', () => {
  it('область построения умещается в полотно', () => {
    const plot = plotArea(340);
    expect(plot.x).toBeGreaterThan(0);
    expect(plot.x + plot.w).toBeLessThanOrEqual(340);
    expect(plot.y + plot.h).toBeLessThanOrEqual(HEIGHT);
  });

  it('узкое полотно не даёт отрицательной ширины', () => {
    expect(plotArea(20).w).toBeGreaterThan(0);
  });
});

describe('linearScale', () => {
  it('переводит края диапазона в края области', () => {
    const scale = linearScale(0, 10, 100, 200);
    expect(scale(0)).toBe(100);
    expect(scale(10)).toBe(200);
    expect(scale(5)).toBe(150);
  });

  it('вырожденный диапазон ставит значение в середину', () => {
    const scale = linearScale(5, 5, 100, 200);
    expect(scale(5)).toBe(150);
  });
});

describe('logScale', () => {
  it('порядок величины занимает равные доли', () => {
    const scale = logScale(1e-2, 1e2, 0, 400);
    expect(scale(1e-2)).toBeCloseTo(0, 6);
    expect(scale(1)).toBeCloseTo(200, 6);
    expect(scale(1e2)).toBeCloseTo(400, 6);
  });

  it('значение ниже минимума прижимается к краю', () => {
    const scale = logScale(1e-2, 1e2, 0, 400);
    expect(scale(1e-9)).toBeCloseTo(0, 6);
  });

  it('неположительный минимум не ломает шкалу', () => {
    expect(Number.isFinite(logScale(0, 100, 0, 400)(50))).toBe(true);
  });
});

describe('niceTicks', () => {
  it('деления круглые и покрывают диапазон', () => {
    const ticks = niceTicks(0, 3597, 4);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(3597);
  });

  it('деления идут по возрастанию', () => {
    const ticks = niceTicks(0, 12.7, 4);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });

  it('вырожденный диапазон отдаёт одно деление', () => {
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});

describe('decadeTicks', () => {
  it('отдаёт только целые порядки', () => {
    expect(decadeTicks(1e-4, 9125)).toEqual([1e-4, 1e-3, 1e-2, 1e-1, 1, 10, 100, 1000]);
  });

  it('неположительный минимум даёт пустой список', () => {
    expect(decadeTicks(0, 100)).toEqual([]);
  });
});

describe('polyline', () => {
  it('первая команда — переход, остальные — линии', () => {
    const d = polyline([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(d.startsWith('M1.00 2.00')).toBe(true);
    expect(d).toContain('L3.00 4.00');
  });

  it('пустой список даёт пустой путь', () => {
    expect(polyline([])).toBe('');
  });
});
