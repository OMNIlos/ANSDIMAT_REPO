/**
 * Эталоны получены прогоном расчётного ядра веб-калькулятора
 * (https://ansdimat.com/download/calc/pit_calc/calc.js) на тех же входных
 * данных. Сверяемся именно с кодом, а не с константами `expectedQ` в его
 * объекте EXAMPLES: для речных схем они разошлись с формулами — заявлено
 * 1737.552 и 1303.164, а движок считает 1737.7256 и 1303.2942.
 */

import {
  compute,
  compareR,
  seriesQ,
  r0FromArea,
  r0FromRect,
  r0Forchheimer,
  areaFromR0,
  R_fromWall,
  R_verigin,
  R_kusakin,
  R_sichardt,
  R_weber,
  R_image,
  lnThiem,
  diffusivityFromStorage,
  storageFromDiffusivity,
  PIT_EXAMPLES,
} from '../pitInflow';

const base = { k: 5, m: 20, h0: 20, S: 10, a: 1000, mu: 0.1, t: 100, L: 2200, factor: 1 };

describe('приведение геометрии', () => {
  it('круг равновеликой площади', () => {
    expect(r0FromArea(44000)).toBeCloseTo(118.34540545, 6);
  });

  it('прямоугольник по равновеликой площади', () => {
    expect(r0FromRect(400, 110)).toBeCloseTo(118.34540545, 6);
  });

  it('прямоугольник по Форхгеймеру шире равновеликого круга', () => {
    expect(r0Forchheimer(400, 110)).toBeCloseTo(162.33804195, 6);
    expect(r0Forchheimer(400, 110)).toBeGreaterThan(r0FromRect(400, 110));
  });

  it('площадь и радиус переводятся друг в друга', () => {
    expect(areaFromR0(r0FromArea(44000))).toBeCloseTo(44000, 6);
  });

  it('нулевые размеры не дают радиуса', () => {
    expect(r0FromArea(0)).toBeNaN();
    expect(r0FromRect(400, 0)).toBeNaN();
    expect(r0Forchheimer(0, 110)).toBeNaN();
  });
});

describe('радиус влияния', () => {
  it('от стенки котлована: r₀ + √(π a t)', () => {
    expect(R_fromWall(1000, 100, 118.34540545)).toBeCloseTo(678.8445271, 6);
  });

  it('по Веригину: √(π a t)', () => {
    expect(R_verigin(1000, 100)).toBeCloseTo(560.4991216, 6);
  });

  it('по Кусакину для безнапорного: 2 S √(k H)', () => {
    expect(R_kusakin(10, 5, 20)).toBeCloseTo(200, 6);
  });

  it('по Зихардту переводит k в м/с', () => {
    expect(R_sichardt(10, 5)).toBeCloseTo(3000 * 10 * Math.sqrt(5 / 86400), 6);
  });

  it('по Веберу: 3 √(k H t / μ)', () => {
    expect(R_weber(5, 20, 100, 0.1)).toBeCloseTo(3 * Math.sqrt((5 * 20 * 100) / 0.1), 6);
  });

  it('граница I рода даёт удвоенное расстояние до реки', () => {
    expect(R_image(2200)).toBe(4400);
  });

  it('контур внутри выработки логарифма не даёт', () => {
    expect(lnThiem(50, 118)).toBeNaN();
    expect(lnThiem(118, 118)).toBeNaN();
  });
});

describe('пьезопроводность и водоотдача', () => {
  it('переводятся друг в друга', () => {
    const a = diffusivityFromStorage(5, 20, 0.1);
    expect(a).toBeCloseTo(1000, 9);
    expect(storageFromDiffusivity(5, 20, a)).toBeCloseTo(0.1, 12);
  });
});

describe('compute — сверка с веб-движком', () => {
  const cases = [
    {
      name: 'напорный неограниченный',
      input: { ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' },
      Q: 3597.0006005077066,
      R: 678.8445270938569,
      lnTerm: 1.7467846144625978,
      T: 100,
    },
    {
      name: 'напорный у реки',
      input: { ...base, scheme: 'confined_river', geom: 'area', F: 44000, rMethod: 'fromWall' },
      Q: 1737.725589247752,
      R: 4400,
      lnTerm: 3.6157523063808537,
      T: 100,
    },
    {
      name: 'безнапорный неограниченный',
      input: { ...base, scheme: 'unconfined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' },
      Q: 2697.7504503807795,
      R: 678.8445270938569,
      lnTerm: 1.7467846144625978,
      T: 75,
    },
    {
      name: 'безнапорный у реки',
      input: { ...base, scheme: 'unconfined_river', geom: 'area', F: 44000, rMethod: 'fromWall' },
      Q: 1303.2941919358138,
      R: 4400,
      lnTerm: 3.6157523063808537,
      T: 75,
    },
    {
      name: 'прямоугольник по Форхгеймеру',
      input: {
        ...base,
        scheme: 'unconfined_unlimited',
        geom: 'rect',
        length: 400,
        width: 110,
        r0mode: 'forchheimer',
        rMethod: 'fromWall',
      },
      Q: 3155.258850231136,
      R: 722.8371635935262,
      lnTerm: 1.4935031336777607,
      T: 75,
    },
    {
      name: 'радиус задан напрямую',
      input: { ...base, scheme: 'confined_unlimited', geom: 'radius', r0: 118.345405, rMethod: 'fromWall' },
      Q: 3597.000593984346,
      R: 678.8445266397929,
      lnTerm: 1.7467846176304889,
      T: 100,
    },
    {
      name: 'радиус влияния задан вручную',
      input: { ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'manual', Rmanual: 500 },
      Q: 4360.293377417357,
      R: 500,
      lnTerm: 1.4410005848966927,
      T: 100,
    },
  ];

  cases.forEach(({ name, input, Q, R, lnTerm, T }) => {
    it(name, () => {
      const result = compute(input);
      expect(result.ok).toBe(true);
      expect(result.Q).toBeCloseTo(Q, 6);
      expect(result.R).toBeCloseTo(R, 6);
      expect(result.lnTerm).toBeCloseTo(lnTerm, 9);
      expect(result.T).toBeCloseTo(T, 9);
    });
  });

  it('прямоугольник равной площади совпадает с заданием через площадь', () => {
    const byArea = compute({ ...base, scheme: 'unconfined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' });
    const byRect = compute({
      ...base,
      scheme: 'unconfined_unlimited',
      geom: 'rect',
      length: 400,
      width: 110,
      r0mode: 'area',
      rMethod: 'fromWall',
    });
    expect(byRect.Q).toBeCloseTo(byArea.Q, 9);
  });

  it('пьезопроводность восстанавливается из водоотдачи', () => {
    const result = compute({
      ...base,
      a: undefined,
      scheme: 'unconfined_unlimited',
      geom: 'area',
      F: 44000,
      rMethod: 'fromWall',
    });
    expect(result.ok).toBe(true);
    expect(result.a).toBeCloseTo(1000, 9);
    expect(result.Q).toBeCloseTo(2697.7504503807795, 6);
  });

  it('коэффициент запаса умножает только проектный приток', () => {
    const result = compute({
      ...base,
      scheme: 'confined_unlimited',
      geom: 'area',
      F: 44000,
      rMethod: 'fromWall',
      factor: 1.3,
    });
    expect(result.Q).toBeCloseTo(3597.0006005077066, 6);
    expect(result.Qdesign).toBeCloseTo(4676.100780660019, 6);
  });

  it('расход пересчитывается в м³/ч и л/с', () => {
    const result = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' });
    expect(result.Q_m3h).toBeCloseTo(result.Q / 24, 9);
    expect(result.Q_ls).toBeCloseTo(result.Q / 86.4, 9);
  });
});

describe('compute — отказы и предупреждения', () => {
  const failing = [
    ['понижение глубже пласта', { ...base, scheme: 'unconfined_unlimited', geom: 'area', F: 44000, S: 30, rMethod: 'fromWall' }, 'S_gt_h0'],
    ['не задана проницаемость', { ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, k: 0, rMethod: 'fromWall' }, 'k'],
    ['река ближе стенки котлована', { ...base, scheme: 'confined_river', geom: 'area', F: 44000, L: 50, rMethod: 'fromWall' }, 'L_le_r0'],
    ['ручной радиус внутри выработки', { ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'manual', Rmanual: 50 }, 'R_le_r0'],
    ['не задана площадь', { ...base, scheme: 'confined_unlimited', geom: 'area', F: 0, rMethod: 'fromWall' }, 'F'],
    ['не задано время работы дренажа', { ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, t: 0, rMethod: 'fromWall' }, 't'],
  ];

  failing.forEach(([name, input, code]) => {
    it(name, () => {
      const result = compute(input);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(code);
    });
  });

  it('вытянутый котлован помечается предупреждением', () => {
    const result = compute({
      ...base,
      scheme: 'unconfined_unlimited',
      geom: 'rect',
      length: 800,
      width: 55,
      r0mode: 'area',
      rMethod: 'fromWall',
    });
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('elongated');
    expect(result.aspect).toBeCloseTo(800 / 55, 9);
  });

  it('короткий срок работы дренажа помечается предупреждением', () => {
    const result = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, t: 5, rMethod: 'fromWall' });
    expect(result.warnings).toContain('t_small');
  });

  it('проницаемость вне рабочего диапазона помечается', () => {
    const high = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, k: 150, rMethod: 'fromWall' });
    const low = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, k: 0.005, rMethod: 'fromWall' });
    expect(high.warnings).toContain('k_high');
    expect(low.warnings).toContain('k_low');
  });
});

describe('seriesQ', () => {
  const input = { ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' };

  it('приток убывает со временем', () => {
    const points = seriesQ(input, 365, 16);
    expect(points.length).toBeGreaterThan(10);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].Q).toBeLessThan(points[i - 1].Q);
      expect(points[i].R).toBeGreaterThan(points[i - 1].R);
    }
  });

  it('у реки приток стационарен, ряда нет', () => {
    expect(seriesQ({ ...input, scheme: 'confined_river' })).toEqual([]);
  });
});

describe('compareR', () => {
  const input = { ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000 };

  /**
   * В веб-версии таблица сравнения не работает: `resolveR` разбирает только
   * fromWall и manual, а остальные способы проваливаются в default и дают
   * тот же радиус. Здесь каждый способ считает свой — иначе таблица
   * сравнения показывала бы пять одинаковых строк.
   */
  it('способы дают разные радиусы', () => {
    const rows = compareR(input);
    expect(rows.length).toBe(5);
    const unique = new Set(rows.map((row) => row.R.toFixed(6)));
    expect(unique.size).toBe(rows.length);
  });

  it('строка fromWall совпадает с основным расчётом', () => {
    const rows = compareR(input);
    const main = compute({ ...input, rMethod: 'fromWall' });
    const row = rows.find((entry) => entry.method === 'fromWall');
    expect(row.R).toBeCloseTo(main.R, 9);
    expect(row.Q).toBeCloseTo(main.Q, 9);
  });

  it('речная схема сравнивается как неограниченная', () => {
    const rows = compareR({ ...input, scheme: 'confined_river' });
    expect(rows.length).toBe(5);
    expect(rows.every((row) => row.R !== 4400)).toBe(true);
  });
});

describe('готовые примеры', () => {
  it('все четыре схемы считаются без ошибок', () => {
    Object.values(PIT_EXAMPLES).forEach((example) => {
      expect(compute(example).ok).toBe(true);
    });
  });

  it('схемы без границы питания совпадают с заявленными значениями', () => {
    expect(compute(PIT_EXAMPLES.confined_unlimited).Q).toBeCloseTo(3597, 2);
    expect(compute(PIT_EXAMPLES.unconfined_unlimited).Q).toBeCloseTo(2697.75, 2);
    expect(compute(PIT_EXAMPLES.confined_unlimited).R).toBeCloseTo(678.8445, 4);
  });
});
