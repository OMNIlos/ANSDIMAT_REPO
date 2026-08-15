/**
 * Расстояния между скважинами по координатам
 *
 * Сверка идёт с гаверсинусом: на масштабе куста плоская формула обязана
 * совпадать с точной, иначе расстояние в таблице расходилось бы с картой.
 */

import { distanceBetween, offsetBy } from '../geo';

/** Точное расстояние по гаверсинусу — эталон для сверки */
function haversine(from, to) {
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLon = rad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const SPB = { lat: 59.9386, lon: 30.3141 };

describe('distanceBetween', () => {
  it('совпадает сама с собой в нуле', () => {
    expect(distanceBetween(SPB, SPB)).toBe(0);
  });

  it('градус широты — около 111 км', () => {
    const d = distanceBetween({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeCloseTo(111195, 0);
  });

  it('градус долготы на экваторе длиннее, чем на широте Петербурга', () => {
    const equator = distanceBetween({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    const north = distanceBetween(SPB, { lat: SPB.lat, lon: SPB.lon + 1 });
    expect(equator).toBeGreaterThan(north);
    // cos(59.9386°) ≈ 0.5011
    expect(north / equator).toBeCloseTo(Math.cos((59.9386 * Math.PI) / 180), 3);
  });

  it('на масштабе куста сходится с гаверсинусом до миллиметра', () => {
    for (const metres of [10, 50, 200, 1000]) {
      const to = offsetBy(SPB, metres, 37);
      const flat = distanceBetween(SPB, to);
      expect(Math.abs(flat - haversine(SPB, to))).toBeLessThan(0.001);
    }
  });

  it('симметрично', () => {
    const other = offsetBy(SPB, 250, 200);
    expect(distanceBetween(SPB, other)).toBeCloseTo(distanceBetween(other, SPB), 9);
  });

  it('без координат даёт NaN, а не ноль', () => {
    expect(distanceBetween(null, SPB)).toBeNaN();
    expect(distanceBetween(SPB, { lat: NaN, lon: 0 })).toBeNaN();
    expect(distanceBetween(SPB, { lat: 1 })).toBeNaN();
    // null глобальный isFinite приводит к нулю — проверка обязана его ловить
    expect(distanceBetween(SPB, { lat: null, lon: null })).toBeNaN();
    expect(distanceBetween({ lat: null, lon: null }, SPB)).toBeNaN();
  });
});

describe('offsetBy', () => {
  it('обратна distanceBetween: смещение на d даёт ровно d', () => {
    for (const bearing of [0, 45, 90, 180, 270, 315]) {
      const to = offsetBy(SPB, 137, bearing);
      expect(distanceBetween(SPB, to)).toBeCloseTo(137, 6);
    }
  });

  it('азимут отсчитывается от севера по часовой стрелке', () => {
    expect(offsetBy(SPB, 100, 0).lat).toBeGreaterThan(SPB.lat);
    expect(offsetBy(SPB, 100, 180).lat).toBeLessThan(SPB.lat);
    expect(offsetBy(SPB, 100, 90).lon).toBeGreaterThan(SPB.lon);
    expect(offsetBy(SPB, 100, 270).lon).toBeLessThan(SPB.lon);
  });

  it('нулевое смещение оставляет точку на месте', () => {
    const same = offsetBy(SPB, 0, 90);
    expect(same.lat).toBeCloseTo(SPB.lat, 12);
    expect(same.lon).toBeCloseTo(SPB.lon, 12);
  });

  it('на полюсе не делит на ноль', () => {
    const pole = offsetBy({ lat: 90, lon: 0 }, 100, 90);
    expect(isFinite(pole.lat)).toBe(true);
    expect(isFinite(pole.lon)).toBe(true);
  });
});
