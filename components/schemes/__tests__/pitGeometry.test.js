/**
 * Проверка геометрии разреза котлована
 *
 * Смотрим не на пиксели, а на смысл: слои идут сверху вниз в правильном
 * порядке, воронка начинается у стенки и выходит на исходный уровень, а при
 * пустом вводе разрез всё равно строится.
 */

import { compute } from '../../../calc/pitInflow';
import { pitGeometry, coneY, conePath, wallX, WIDTH, HEIGHT } from '../pitGeometry';

const base = { k: 5, m: 20, h0: 20, S: 10, a: 1000, mu: 0.1, t: 100, L: 2200, factor: 1 };
const confined = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' });
const unconfined = compute({ ...base, scheme: 'unconfined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' });
const river = compute({ ...base, scheme: 'confined_river', geom: 'area', F: 44000, rMethod: 'fromWall' });

describe('pitGeometry', () => {
  it('слои напорного пласта идут сверху вниз', () => {
    const g = pitGeometry(confined);
    expect(g.groundY).toBeLessThan(g.aquiferTop);
    expect(g.aquiferTop).toBeLessThan(g.aquiferBottom);
    expect(g.aquiferBottom).toBeLessThan(g.baseY);
  });

  it('в безнапорном пласте водоносный слой начинается от поверхности', () => {
    const g = pitGeometry(unconfined);
    expect(g.aquiferTop).toBe(g.groundY);
    expect(g.aquiferBottom).toBe(g.baseY);
  });

  it('дно котлована ниже уровня воды и выше подошвы', () => {
    [confined, unconfined].forEach((result) => {
      const g = pitGeometry(result);
      expect(g.pitBottomY).toBeGreaterThan(g.waterLevelY);
      expect(g.pitBottomY).toBeLessThan(g.baseY);
    });
  });

  it('котлован сужается книзу', () => {
    const g = pitGeometry(confined);
    expect(g.pitTopRight - g.pitTopLeft).toBeGreaterThan(g.pitBottomRight - g.pitBottomLeft);
  });

  it('глубже понижение — глубже котлован', () => {
    const shallow = pitGeometry(compute({ ...base, scheme: 'unconfined_unlimited', geom: 'area', F: 44000, S: 2, rMethod: 'fromWall' }));
    const deep = pitGeometry(compute({ ...base, scheme: 'unconfined_unlimited', geom: 'area', F: 44000, S: 18, rMethod: 'fromWall' }));
    expect(deep.pitBottomY).toBeGreaterThan(shallow.pitBottomY);
  });

  it('у реки полотно оставляет место под русло', () => {
    const g = pitGeometry(river);
    expect(g.river).toBe(true);
    expect(g.riverX).toBeGreaterThan(g.x1);
    expect(g.riverX + 88).toBeLessThanOrEqual(WIDTH);
  });

  it('воронка не выходит за полотно', () => {
    [confined, unconfined, river].forEach((result) => {
      const g = pitGeometry(result);
      expect(g.cx + g.Rpx).toBeLessThanOrEqual(g.x1);
      expect(g.cx - g.Rpx).toBeGreaterThanOrEqual(g.x0);
    });
  });

  it('при пустом вводе разрез всё равно строится', () => {
    const g = pitGeometry(null);
    expect(g.ok).toBe(false);
    expect(g.pitBottomY).toBeGreaterThan(g.waterLevelY);
    expect(Number.isFinite(g.Rpx)).toBe(true);
  });

  it('неудавшийся расчёт не ломает разрез', () => {
    const failed = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 0, rMethod: 'fromWall' });
    expect(failed.ok).toBe(false);
    const g = pitGeometry(failed);
    expect(Number.isFinite(g.Rpx)).toBe(true);
    expect(Number.isFinite(g.pitBottomY)).toBe(true);
  });

  it('полотно не меняет пропорций', () => {
    expect(WIDTH / HEIGHT).toBeCloseTo(700 / 378, 9);
  });
});

describe('coneY', () => {
  const g = pitGeometry(confined);

  it('у стенки котлована воронка на уровне дна', () => {
    expect(coneY(g, g.r0px)).toBe(g.pitBottomY);
    expect(coneY(g, g.r0px / 2)).toBe(g.pitBottomY);
  });

  it('на контуре влияния воронка выходит на исходный уровень', () => {
    expect(coneY(g, g.Rpx)).toBe(g.waterLevelY);
    expect(coneY(g, g.Rpx * 2)).toBe(g.waterLevelY);
  });

  it('между стенкой и контуром уровень поднимается монотонно', () => {
    let previous = g.pitBottomY;
    for (let i = 1; i <= 20; i++) {
      const d = g.r0px + ((g.Rpx - g.r0px) * i) / 20;
      const y = coneY(g, d);
      expect(y).toBeLessThanOrEqual(previous);
      previous = y;
    }
  });

  it('у стенки кривая идёт полого, а не обрывается', () => {
    // Первая двадцатая пути должна отыграть заметную долю подъёма,
    // иначе воронка читалась бы как вертикальный разрыв
    const step = (g.Rpx - g.r0px) / 20;
    const climb = g.pitBottomY - coneY(g, g.r0px + step);
    const total = g.pitBottomY - g.waterLevelY;
    expect(climb / total).toBeGreaterThan(0.05);
  });
});

describe('conePath', () => {
  const g = pitGeometry(confined);

  it('путь начинается командой M и содержит все точки', () => {
    const path = conePath(g, 1);
    expect(path.startsWith('M')).toBe(true);
    expect((path.match(/L/g) || []).length).toBe(16);
  });

  it('левая и правая ветви зеркальны', () => {
    const left = conePath(g, -1);
    const right = conePath(g, 1);
    const xs = (path) => path.split(' ').filter((_, i) => i % 2 === 0).map((token) => parseFloat(token.slice(1)));
    const leftXs = xs(left);
    const rightXs = xs(right);
    leftXs.forEach((x, i) => {
      expect(g.cx - x).toBeCloseTo(rightXs[i] - g.cx, 1);
    });
  });
});

describe('wallX', () => {
  const g = pitGeometry(confined);

  it('на уровне поверхности стенка совпадает с бровкой', () => {
    expect(wallX(g, g.groundY, -1)).toBeCloseTo(g.pitTopLeft, 9);
    expect(wallX(g, g.groundY, 1)).toBeCloseTo(g.pitTopRight, 9);
  });

  it('на уровне дна стенка совпадает с основанием', () => {
    expect(wallX(g, g.pitBottomY, -1)).toBeCloseTo(g.pitBottomLeft, 9);
    expect(wallX(g, g.pitBottomY, 1)).toBeCloseTo(g.pitBottomRight, 9);
  });
});
