/**
 * Эталоны сняты с веб-калькулятора АНСДИМАТ
 * (https://ansdimat.com/download/calc/well_drawdown_calc/) и лежат в
 * fixtures/wellDrawdown.json. Два набора отличаются проницаемостью, мощностью
 * и водоотдачей так, что индекс запаздывания меняется в 12.5 раза — это и
 * подтверждает восстановленную формулу α = 3k/(Sy·h₀): подойди сюда константа,
 * второй набор бы не сошёлся.
 */

import { boultonDrawdown, boultonDelayIndex, stehfestWeights } from '../boulton';
import { wellFunction } from '../wellFunction';
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

/**
 * Понижение по Тейсу — для проверки предельных переходов
 *
 * @param {number} Q - дебит, м³/сут
 * @param {number} T - водопроводимость, м²/сут
 * @param {number} storage - водоотдача, безразмерная
 * @param {number} r - расстояние, м
 * @param {number} t - время, сут
 * @returns {number} понижение, м
 */
function theis(Q, T, storage, r, t) {
  return (Q / (4 * Math.PI * T)) * wellFunction((r * r * storage) / (4 * T * t));
}

const cases = fixtures.cases.filter((entry) => entry.scheme === 'boulton');

describe('stehfestWeights', () => {
  it('веса конечны и знакопеременны', () => {
    const weights = stehfestWeights(12);
    expect(weights.length).toBe(13);
    for (let i = 1; i <= 12; i++) expect(Number.isFinite(weights[i])).toBe(true);
    expect(weights[12]).toBeGreaterThan(0);
    expect(weights[11]).toBeLessThan(0);
  });

  it('веса не пересчитываются заново', () => {
    expect(stehfestWeights(12)).toBe(stehfestWeights(12));
  });
});

describe('boultonDelayIndex', () => {
  it('α = 3k/(Sy·h₀)', () => {
    expect(boultonDelayIndex(2, 0.2, 25)).toBeCloseTo(1.2, 12);
    expect(boultonDelayIndex(5, 0.1, 10)).toBeCloseTo(15, 12);
  });

  it('без полного набора параметров не определён', () => {
    expect(boultonDelayIndex(0, 0.2, 25)).toBeNaN();
    expect(boultonDelayIndex(2, 0, 25)).toBeNaN();
  });
});

describe('предельные переходы', () => {
  const Q = 100;
  const k = 2;
  const h0 = 25;
  const T = k * h0;

  it('на поздних временах совпадает с Тейсом по гравитационной водоотдаче', () => {
    const Sy = 0.2;
    const got = boultonDrawdown({ Q, k, h0, Sy, S: 1e-3, r: 5, t: 9125 });
    expect(got).toBeCloseTo(theis(Q, T, Sy, 5, 9125), 4);
  });

  it('без запаздывания вырождается в Тейса по упругой водоотдаче', () => {
    // Sy = S означает, что гравитационному дренажу нечего добавить:
    // σ(p) обращается в постоянную S при любом p
    const S = 0.05;
    const got = boultonDrawdown({ Q, k, h0, Sy: S, S, r: 5, t: 1 });
    expect(got).toBeCloseTo(theis(Q, T, S, 5, 1), 4);
  });

  it('понижение растёт со временем и убывает с расстоянием', () => {
    const at = (r, t) => boultonDrawdown({ Q, k, h0, Sy: 0.2, S: 1e-3, r, t });
    expect(at(5, 10)).toBeGreaterThan(at(5, 1));
    expect(at(50, 10)).toBeLessThan(at(5, 10));
  });

  it('неполные данные дают NaN', () => {
    expect(boultonDrawdown({ Q: 0, k: 2, h0: 25, Sy: 0.2, S: 1e-3, r: 5, t: 1 })).toBeNaN();
    expect(boultonDrawdown({ Q: 100, k: 2, h0: 25, Sy: 0.2, S: 1e-3, r: 5, t: 0 })).toBeNaN();
  });
});

describe('сверка с веб-калькулятором', () => {
  cases.forEach((testCase) => {
    const { input } = testCase;
    const times = fixtureTimes(input);

    // Допуск задан по абсолютной величине: понижение проектировщик читает в
    // метрах, и «полмиллиметра» здесь понятнее, чем «полпроцента». Наибольшее
    // расхождение приходится на полку запаздывания и не превышает 1.1 мм.
    it(`${testCase.name}: понижение в опытной скважине`, () => {
      let worst = 0;
      times.forEach((t, i) => {
        const got = boultonDrawdown({ ...input, r: input.r0, t });
        worst = Math.max(worst, Math.abs(got - testCase.sWell[i]));
      });
      expect(worst).toBeLessThan(2e-3);
    });

    it(`${testCase.name}: понижение в наблюдательной скважине`, () => {
      let worst = 0;
      times.forEach((t, i) => {
        const got = boultonDrawdown({ ...input, r: input.r, t });
        worst = Math.max(worst, Math.abs(got - testCase.sObs[i]));
      });
      expect(worst).toBeLessThan(2e-3);
    });
  });

  it('полка запаздывания стоит там же, где в вебе', () => {
    // Минимум приращения понижения — середина полки. У набора A она позже,
    // чем у набора B, ровно потому, что α у него в 12.5 раза меньше
    const plateauIndex = (values) => {
      let best = 1;
      for (let i = 2; i < values.length; i++) {
        if (values[i] - values[i - 1] < values[best] - values[best - 1]) best = i;
      }
      return best;
    };
    const a = cases.find((entry) => entry.name === 'boulton-A');
    const b = cases.find((entry) => entry.name === 'boulton-B');
    const calc = (entry) =>
      fixtureTimes(entry.input).map((t) =>
        boultonDrawdown({ ...entry.input, r: entry.input.r0, t })
      );
    expect(plateauIndex(calc(a))).toBe(plateauIndex(a.sWell));
    expect(plateauIndex(calc(b))).toBe(plateauIndex(b.sWell));
    expect(plateauIndex(a.sWell)).toBeGreaterThan(plateauIndex(b.sWell));
  });
});
