/**
 * Эталоны сняты с веб-калькулятора АНСДИМАТ
 * (https://ansdimat.com/download/calc/well_drawdown_calc/): таблица понижений
 * на 30 моментов времени для каждой схемы, fixtures/wellDrawdown.json.
 */

import {
  computeWellDrawdown,
  drawdownSeries,
  imageDistanceToObserver,
  schemeFormula,
  WELL_SCHEMES,
} from '../wellDrawdown';
import { besselK0 } from '../leakage';
import fixtures from './fixtures/wellDrawdown.json';

/**
 * Восстанавливает моменты времени эталонной таблицы
 *
 * @param {Object} input - блок input из фикстуры
 * @returns {Array<number>} моменты времени, сут
 */
function fixtureTimes({ tStart, tEnd, points }) {
  const ratio = Math.pow(tEnd / tStart, 1 / (points - 1));
  return Array.from({ length: points }, (_, i) => tStart * Math.pow(ratio, i));
}

const theisInput = { scheme: 'theis', Q: 100, t: 9125, r0: 0.045, r: 5, k: 2, m: 25, S: 1e-4 };

describe('imageDistanceToObserver', () => {
  it('√(r² + 4 L_w L_p)', () => {
    expect(imageDistanceToObserver(5, 62.05, 62.05)).toBeCloseTo(124.2006844, 6);
  });

  it('скважины на равном удалении от реки дают почти удвоенное расстояние', () => {
    // Наблюдательная стоит вдоль берега, поэтому до зеркала чуть дальше 2L
    const got = imageDistanceToObserver(5, 62.05, 62.05);
    expect(got).toBeGreaterThan(2 * 62.05);
    expect(got - 2 * 62.05).toBeLessThan(0.2);
  });

  it('неполные данные не дают расстояния', () => {
    expect(imageDistanceToObserver(5, 0, 62)).toBeNaN();
  });
});

describe('сверка с веб-калькулятором', () => {
  /**
   * Допуск свой у каждой схемы, и не потому, что где-то порт хуже.
   *
   * Тейс и граница считаются аналитически и сходятся с вебом до 1e-5.
   * Хантуш в вебе посчитан приближённо: на стационаре точное значение равно
   * 2 K₀(r/B) · Q/(4πT) = 2.2692468, а веб даёт 2.269232 — мимо на 1.5e-5.
   * Здесь квадратура сходится к тому же пределу с точностью 1.5e-9, поэтому
   * расхождение с вебом заложено его собственной точностью, а правильность
   * проверяется отдельным тестом по аналитическому пределу.
   * Болтон идёт через численное обращение, его допуск 2 мм.
   */
  const TOLERANCE = { theis: 1e-5, boundary: 1e-5, hantush: 5e-5, boulton: 2e-3 };

  fixtures.cases.forEach((testCase) => {
    const { input, scheme } = testCase;
    const tolerance = TOLERANCE[scheme];

    it(`${testCase.name}: понижение на конец откачки`, () => {
      const result = computeWellDrawdown({ ...input, scheme, t: input.tEnd });
      expect(result.ok).toBe(true);
      expect(Math.abs(result.sWell - testCase.sWell[input.points - 1])).toBeLessThan(tolerance);
      expect(Math.abs(result.sObs - testCase.sObs[input.points - 1])).toBeLessThan(tolerance);
    });

    it(`${testCase.name}: весь ряд s(t)`, () => {
      const times = fixtureTimes(input);
      let worstWell = 0;
      let worstObs = 0;
      times.forEach((t, i) => {
        const result = computeWellDrawdown({ ...input, scheme, t });
        worstWell = Math.max(worstWell, Math.abs(result.sWell - testCase.sWell[i]));
        worstObs = Math.max(worstObs, Math.abs(result.sObs - testCase.sObs[i]));
      });
      expect(worstWell).toBeLessThan(tolerance);
      expect(worstObs).toBeLessThan(tolerance);
    });
  });
});

describe('поведение схем', () => {
  it('перетекание выводит понижение на стационар, Тейс — нет', () => {
    const late = { ...theisInput, t: 1e5 };
    const hantush = computeWellDrawdown({ ...late, scheme: 'hantush', B: 50 });
    const hantushLater = computeWellDrawdown({ ...late, scheme: 'hantush', B: 50, t: 1e6 });
    const theis = computeWellDrawdown(late);
    const theisLater = computeWellDrawdown({ ...late, t: 1e6 });

    expect(hantushLater.sObs - hantush.sObs).toBeLessThan(1e-4);
    expect(theisLater.sObs - theis.sObs).toBeGreaterThan(0.1);
  });

  it('граница питания уменьшает понижение по сравнению с неограниченным пластом', () => {
    const theis = computeWellDrawdown(theisInput);
    const bounded = computeWellDrawdown({
      ...theisInput,
      scheme: 'boundary',
      Lw: 62.05,
      Lp: 62.05,
    });
    expect(bounded.sObs).toBeLessThan(theis.sObs);
  });

  it('чем ближе река, тем меньше понижение', () => {
    const near = computeWellDrawdown({ ...theisInput, scheme: 'boundary', Lw: 30, Lp: 30 });
    const far = computeWellDrawdown({ ...theisInput, scheme: 'boundary', Lw: 300, Lp: 300 });
    expect(near.sObs).toBeLessThan(far.sObs);
  });

  it('пьезопроводность восстанавливается из водоотдачи и наоборот', () => {
    const byStorage = computeWellDrawdown(theisInput);
    const byDiffusivity = computeWellDrawdown({ ...theisInput, S: undefined, a: 500000 });
    expect(byStorage.a).toBeCloseTo(500000, 6);
    expect(byDiffusivity.S).toBeCloseTo(1e-4, 12);
    expect(byDiffusivity.sObs).toBeCloseTo(byStorage.sObs, 9);
  });

  it('перетекание сходится к аналитическому стационару 2 K₀(r/B)', () => {
    const B = 50;
    const factor = 100 / (4 * Math.PI * 50);
    const late = computeWellDrawdown({ ...theisInput, scheme: 'hantush', B, t: 1e6 });
    expect(late.sWell).toBeCloseTo(factor * 2 * besselK0(theisInput.r0 / B), 6);
    expect(late.sObs).toBeCloseTo(factor * 2 * besselK0(theisInput.r / B), 6);
  });

  it('у каждой схемы своя формула', () => {
    const formulas = Object.keys(WELL_SCHEMES).map(schemeFormula);
    expect(new Set(formulas).size).toBe(formulas.length);
  });
});

describe('проверки и предупреждения', () => {
  it('превышение допустимого понижения отмечается', () => {
    const result = computeWellDrawdown({ ...theisInput, allowable: 3 });
    expect(result.sWell).toBeGreaterThan(3);
    expect(result.exceedsAllowable).toBe(true);
    expect(result.warnings).toContain('exceeds_allowable');
  });

  it('запас по допустимому понижению не отмечается', () => {
    const result = computeWellDrawdown({ ...theisInput, allowable: 10 });
    expect(result.exceedsAllowable).toBe(false);
    expect(result.warnings).not.toContain('exceeds_allowable');
  });

  it('осушение безнапорного горизонта отмечается', () => {
    const result = computeWellDrawdown({
      scheme: 'boulton',
      Q: 5000,
      t: 9125,
      r0: 0.045,
      r: 5,
      k: 2,
      h0: 3,
      Sy: 0.2,
      S: 1e-3,
    });
    expect(result.dewatered).toBe(true);
    expect(result.warnings).toContain('dewatered');
  });

  it('напорная схема осушения не отмечает', () => {
    const result = computeWellDrawdown({ ...theisInput, Q: 5000 });
    expect(result.dewatered).toBe(false);
  });

  it('наблюдательная ближе стенки опытной отмечается', () => {
    const result = computeWellDrawdown({ ...theisInput, r: 0.02 });
    expect(result.warnings).toContain('r_le_r0');
  });

  const failing = [
    ['не задан дебит', { ...theisInput, Q: 0 }, 'Q'],
    ['не задана длительность', { ...theisInput, t: 0 }, 't'],
    ['не задана проницаемость', { ...theisInput, k: 0 }, 'k'],
    ['не задана мощность', { ...theisInput, m: 0 }, 'm'],
    ['не задана водоотдача', { ...theisInput, S: 0, a: 0 }, 'S'],
    ['перетекание без параметра B', { ...theisInput, scheme: 'hantush' }, 'B'],
    ['граница без расстояния до реки', { ...theisInput, scheme: 'boundary', Lp: 60 }, 'Lw'],
    ['Болтон без гравитационной водоотдачи', { ...theisInput, scheme: 'boulton', h0: 25, S: 1e-3 }, 'Sy'],
  ];

  failing.forEach(([name, input, code]) => {
    it(name, () => {
      const result = computeWellDrawdown(input);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(code);
    });
  });
});

describe('drawdownSeries', () => {
  it('ряд совпадает с эталонной таблицей веб-версии', () => {
    const series = drawdownSeries(theisInput);
    const reference = fixtures.cases.find((entry) => entry.name === 'theis');
    expect(series.length).toBe(30);
    series.forEach((point, i) => {
      expect(point.sWell).toBeCloseTo(reference.sWell[i], 5);
      expect(point.sObs).toBeCloseTo(reference.sObs[i], 5);
    });
  });

  it('время растёт, понижение не убывает', () => {
    const series = drawdownSeries(theisInput);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].t).toBeGreaterThan(series[i - 1].t);
      expect(series[i].sWell).toBeGreaterThanOrEqual(series[i - 1].sWell);
    }
  });

  it('понижение в опытной всегда глубже, чем в наблюдательной', () => {
    drawdownSeries(theisInput).forEach((point) => {
      expect(point.sWell).toBeGreaterThan(point.sObs);
    });
  });

  it('при неполном вводе ряда нет', () => {
    expect(drawdownSeries({ ...theisInput, k: 0 })).toEqual([]);
  });
});
