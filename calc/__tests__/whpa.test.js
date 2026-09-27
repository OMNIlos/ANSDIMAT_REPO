/**
 * Проверка расчёта зоны санитарной охраны
 *
 * Опорные числа взяты из веб-калькулятора ЗСО на примере по умолчанию:
 * Q = 720 м³/сут, k = 7 м/сут, m = 50 м, n = 0.35, I = 0.0015,
 * Tм = 400 сут, Tх = 9125 сут, R₁ = 50 м. Веб-версия показывает
 * II пояс — 80.6 / 64.6 / 144.3 м и III пояс — 547.8 / 192.5 / 644.5 м.
 *
 * Числа здесь не круглые и на глаз не проверяются, поэтому сверка с
 * эталоном — единственный способ поймать ошибку в решателе: он подбирает
 * корни численно, и опечатка в знаке даст правдоподобный, но неверный ответ.
 */

import {
  PROTECTED_DAYS,
  WHPA_METHODS,
  computeWhpa,
  contourArea,
  contourToGeo,
  layerPercolation,
  percolation,
  turningPoints,
  dimensionlessTime,
  isochrone,
  solveDownstream,
  solveHalfWidth,
  solveUpstream,
  specificDischarge,
  stagnationDistance,
  volumeRadius,
} from '../whpa';

/** Пример по умолчанию из веб-версии */
const EXAMPLE = {
  method: WHPA_METHODS.ANALYTICAL,
  Q: 720,
  k: 7,
  m: 50,
  n: 0.35,
  I: 0.0015,
  tBacterial: 400,
  tChemical: 9125,
  firstBeltRadius: 50,
};

describe('поток и водораздельная точка', () => {
  it('удельный расход — произведение k, m и уклона', () => {
    expect(specificDischarge({ k: 7, m: 50, I: 0.0015 })).toBeCloseTo(0.525, 12);
  });

  it('без уклона потока расхода нет', () => {
    expect(specificDischarge({ k: 7, m: 50, I: 0 })).toBe(0);
  });

  it('водораздельная точка ниже скважины', () => {
    expect(stagnationDistance({ Q: 720, q: 0.525 })).toBeCloseTo(218.27, 2);
  });

  it('без потока водораздельной точки не существует', () => {
    expect(stagnationDistance({ Q: 720, q: 0 })).toBe(Infinity);
  });
});

describe('решатели границ пояса', () => {
  const xL = stagnationDistance({ Q: 720, q: 0.525 });

  it('корни удовлетворяют своим уравнениям', () => {
    const tau = 1.2542;
    const up = solveUpstream(xL, tau) / xL;
    const down = solveDownstream(xL, tau) / xL;
    const half = solveHalfWidth(xL, tau) / xL;

    expect(up - Math.log1p(up)).toBeCloseTo(tau, 9);
    expect(-down - Math.log(1 - down)).toBeCloseTo(tau, 9);
    expect(1 - half / Math.tan(half) - Math.log(Math.sin(half) / half)).toBeCloseTo(tau, 9);
  });

  it('вниз по потоку граница не уходит за водораздельную точку', () => {
    // Сколько ни жди, вода из-за неё в скважину не придёт. На больших τ
    // граница неотличима от x_L уже в разрядной сетке, поэтому строгое
    // неравенство проверяется на умеренном сроке
    expect(solveDownstream(xL, 5)).toBeLessThan(xL);
    expect(solveDownstream(xL, 1e6)).toBeLessThanOrEqual(xL);
  });

  it('при нулевом времени пояса нет', () => {
    expect(solveUpstream(xL, 0)).toBe(0);
    expect(solveDownstream(xL, 0)).toBe(0);
    expect(solveHalfWidth(xL, 0)).toBe(0);
  });

  it('полуширина упирается в предельную ширину области захвата', () => {
    // Предел — π·x_L, то есть Q/(2q) в каждую сторону. Он достигается лишь
    // в бесконечности: при конечном τ граница подходит к нему снизу
    const limit = Math.PI * xL;
    const wide = solveHalfWidth(xL, 1e6);
    expect(wide).toBeLessThan(limit);
    expect(wide / limit).toBeGreaterThan(0.999);
  });
});

describe('пояса на примере веб-версии', () => {
  const result = computeWhpa(EXAMPLE);

  it('расчёт проходит', () => {
    expect(result.ok).toBe(true);
    expect(result.q).toBeCloseTo(0.525, 9);
    expect(result.xL).toBeCloseTo(218.27, 2);
  });

  it('II пояс совпадает с эталоном', () => {
    const belt = result.belts.find((item) => item.key === 'bacterial');
    expect(belt.R).toBeCloseTo(80.6, 1);
    expect(belt.r).toBeCloseTo(64.6, 1);
    expect(2 * belt.d).toBeCloseTo(144.3, 0);
  });

  it('III пояс совпадает с эталоном', () => {
    const belt = result.belts.find((item) => item.key === 'chemical');
    expect(belt.R).toBeCloseTo(547.8, 1);
    expect(belt.r).toBeCloseTo(192.5, 1);
    expect(2 * belt.d).toBeCloseTo(644.5, 0);
  });

  it('I пояс — заданный радиус, одинаковый во все стороны', () => {
    const belt = result.belts.find((item) => item.key === 'first');
    expect(belt.R).toBe(50);
    expect(belt.r).toBe(50);
    expect(belt.d).toBe(50);
  });

  it('вверх по потоку пояс уходит дальше, чем вниз', () => {
    result.belts
      .filter((belt) => belt.key !== 'first')
      .forEach((belt) => expect(belt.R).toBeGreaterThan(belt.r));
  });
});

describe('объёмный способ', () => {
  const result = computeWhpa({ ...EXAMPLE, method: WHPA_METHODS.VOLUME });

  it('пояс — круг, одинаковый во все стороны', () => {
    const belt = result.belts.find((item) => item.key === 'bacterial');
    const radius = volumeRadius({ Q: 720, t: 400, m: 50, n: 0.35 });
    expect(belt.R).toBeCloseTo(radius, 9);
    expect(belt.r).toBeCloseTo(radius, 9);
    expect(belt.d).toBeCloseTo(radius, 9);
    expect(radius).toBeCloseTo(72.4, 1);
  });

  it('не требует ни коэффициента фильтрации, ни уклона', () => {
    const bare = computeWhpa({ ...EXAMPLE, method: WHPA_METHODS.VOLUME, k: 0, I: 0 });
    expect(bare.ok).toBe(true);
  });
});

describe('проверка исходных данных', () => {
  it('аналитический способ без уклона потока не считается', () => {
    const result = computeWhpa({ ...EXAMPLE, I: 0 });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('I');
  });

  it('пустой дебит и мощность попадают в ошибки', () => {
    const result = computeWhpa({ ...EXAMPLE, Q: NaN, m: 0 });
    expect(result.errors).toEqual(expect.arrayContaining(['Q', 'm']));
  });

  it('пористость больше единицы отвергается', () => {
    expect(computeWhpa({ ...EXAMPLE, n: 1.4 }).errors).toContain('n_gt_1');
  });

  it('третий пояс внутри огороженной площадки — предупреждение', () => {
    // Огромный первый пояс при крошечном отборе: считать охрану не от чего
    const result = computeWhpa({ ...EXAMPLE, Q: 1, firstBeltRadius: 5000 });
    expect(result.warnings).toContain('beltInsideFirst');
  });
});

describe('контур изохроны', () => {
  const result = computeWhpa(EXAMPLE);
  const belt = result.belts.find((item) => item.key === 'chemical');
  const contour = isochrone({ xL: result.xL, tau: belt.tau, points: 120 });

  it('контур замкнут и не вырожден', () => {
    expect(contour).toHaveLength(120);
    contour.forEach((point) => {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    });
  });

  it('на оси потока контур совпадает с границами пояса', () => {
    // Первая точка смотрит вниз по потоку, средняя — вверх
    expect(contour[0].x).toBeCloseTo(belt.r, 6);
    expect(contour[60].x).toBeCloseTo(-belt.R, 6);
  });

  it('самая широкая часть контура — удвоенная полуширина', () => {
    const width = Math.max(...contour.map((point) => point.y)) -
      Math.min(...contour.map((point) => point.y));
    expect(width).toBeCloseTo(2 * belt.d, 0);
  });

  it('без времени контура нет', () => {
    expect(isochrone({ xL: 200, tau: 0 })).toEqual([]);
  });
});

describe('безразмерное время', () => {
  it('растёт со временем и падает с пористостью', () => {
    const base = dimensionlessTime({ q: 0.525, t: 400, n: 0.35, m: 50, xL: 218.27 });
    expect(base).toBeCloseTo(0.055, 3);
    expect(dimensionlessTime({ q: 0.525, t: 800, n: 0.35, m: 50, xL: 218.27 })).toBeCloseTo(
      2 * base,
      9
    );
  });

  it('без потока обращается в ноль', () => {
    expect(dimensionlessTime({ q: 0, t: 400, n: 0.35, m: 50, xL: Infinity })).toBe(0);
  });
});

describe('перенос контура на местность', () => {
  const origin = { lat: 60.281711, lon: 29.536609 };

  it('точка вниз по потоку ложится по азимуту потока', () => {
    // Поток на восток: точка ниже по течению уходит по долготе, широта стоит
    const east = contourToGeo([{ x: 100, y: 0 }], origin, 90)[0];
    expect(east.lat).toBeCloseTo(origin.lat, 6);
    expect(east.lon).toBeGreaterThan(origin.lon);

    // Поток на север: уходит по широте
    const north = contourToGeo([{ x: 100, y: 0 }], origin, 0)[0];
    expect(north.lat).toBeGreaterThan(origin.lat);
    expect(north.lon).toBeCloseTo(origin.lon, 6);
  });

  it('вверх по потоку точка уходит в противоположную сторону', () => {
    const up = contourToGeo([{ x: -100, y: 0 }], origin, 0)[0];
    expect(up.lat).toBeLessThan(origin.lat);
  });

  it('без координат устья контура на местности нет', () => {
    expect(contourToGeo([{ x: 10, y: 0 }], { lat: NaN, lon: 0 }, 0)).toEqual([]);
  });
});

describe('площадь и поворотные точки', () => {
  const result = computeWhpa(EXAMPLE);
  const belt = result.belts.find((item) => item.key === 'chemical');
  const contour = isochrone({ xL: result.xL, tau: belt.tau, points: 180 });

  it('площадь круга совпадает с формулой', () => {
    const circle = [];
    for (let i = 0; i < 360; i += 1) {
      const angle = (2 * Math.PI * i) / 360;
      circle.push({ x: 50 * Math.cos(angle), y: 50 * Math.sin(angle) });
    }
    expect(contourArea(circle)).toBeCloseTo(Math.PI * 50 * 50, 0);
  });

  it('площадь третьего пояса — сотни тысяч квадратных метров', () => {
    const area = contourArea(contour);
    expect(area).toBeGreaterThan(1e5);
    expect(area).toBeLessThan(1e6);
  });

  it('поворотных точек ровно шестнадцать и они лежат на контуре', () => {
    const points = turningPoints(contour);
    expect(points).toHaveLength(16);
    points.forEach((point) => expect(contour).toContain(point));
  });

  it('короткий контур отдаётся целиком', () => {
    const short = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(turningPoints(short)).toBe(short);
  });
});

describe('зона аэрации по Аверьянову', () => {
  /** Разрез из примера веб-версии */
  const LAYERS = [
    { k: 10, m: 3, n: 0.15 },
    { k: 1e-4, m: 2, n: 0.05 },
    { k: 10, m: 2, n: 0.15 },
    { k: 0.1, m: 4, n: 0.1 },
    { k: 10, m: 1.5, n: 0.15 },
  ];
  const W = 0.0003;

  it('проницаемый слой считается по неполному насыщению', () => {
    // k ≥ w: t₀ = n m / ∛(k w²)
    const { t0, saturated } = layerPercolation({ k: 10, m: 3, n: 0.15 }, W);
    expect(saturated).toBe(false);
    expect(t0).toBeCloseTo((0.15 * 3) / Math.cbrt(10 * W * W), 6);
    expect(t0).toBeCloseTo(46.6, 0);
  });

  it('слабопроницаемый слой работает насыщенным', () => {
    // k < w: слой не успевает пропустить питание, t₀ = n m / k
    const { t0, saturated } = layerPercolation({ k: 1e-4, m: 2, n: 0.05 }, W);
    expect(saturated).toBe(true);
    expect(t0).toBeCloseTo(1000, 6);
  });

  it('время по разрезу складывается по слоям', () => {
    const result = percolation(W, LAYERS);
    const sum = LAYERS.reduce((total, layer) => total + layerPercolation(layer, W).t0, 0);
    expect(result.t0).toBeCloseTo(sum, 9);
    expect(result.t0).toBeCloseTo(1293, 0);
  });

  it('горизонт считается защищённым от четырёхсот суток', () => {
    expect(percolation(W, LAYERS).protected).toBe(true);
    // Один тонкий проницаемый слой такого срока не даёт
    expect(percolation(W, [{ k: 10, m: 1, n: 0.15 }]).protected).toBe(false);
    expect(PROTECTED_DAYS).toBe(400);
  });

  it('слой без мощности не ломает сумму', () => {
    const result = percolation(W, [{ k: 10, m: 0, n: 0.15 }, { k: 10, m: 3, n: 0.15 }]);
    expect(Number.isNaN(result.layers[0].t0)).toBe(true);
    expect(result.t0).toBeCloseTo(layerPercolation(LAYERS[0], W).t0, 9);
  });

  it('пустой разрез даёт ноль и незащищённый горизонт', () => {
    expect(percolation(W, []).t0).toBe(0);
    expect(percolation(W, []).protected).toBe(false);
  });
});
