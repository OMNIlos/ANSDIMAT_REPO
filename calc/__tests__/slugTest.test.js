/**
 * Проверка обработки экспресс-опробования (решение Бауэра — Райса)
 *
 * Готового контрольного примера с числами у этого решения нет, поэтому
 * эталон строится двумя способами.
 *
 * 1. Замеры генерируются точно по уравнению (3.3.4) для заданного k, и
 *    обработка обязана вернуть исходное k. Такая проверка ловит и ошибку в
 *    множителе 2.3, и путаницу минут с сутками.
 * 2. Полиномы A₁, A₂, A₃ сверяются на стыке диапазонов β = 200: это два
 *    независимых приближения одной и той же кривой рис. 3.7, и они обязаны
 *    там сходиться. Опечатка в любом коэффициенте разводит ветви.
 */

import {
  bouwerRiceCoefficients,
  influenceRadiusLog,
  slugPoints,
  conductivityFromSlope,
  processSlugTest,
  BETA_MIN,
  BETA_MAX,
  LOG_THICKNESS_CAP,
  STRAIGHT_LINE_FACTOR,
} from '../slugTest';
import { MINUTES_PER_DAY } from '../units';

/** Скважина контрольного расчёта: несовершенная по степени вскрытия */
const WELL = { rw: 0.1, rc: 0.05, lw: 5, z: 12, m: 20 };

/**
 * Строит журнал замеров, точно ложащихся на прямую заданного k
 *
 * Прямая табл. 3.1: lg(s⁰/s_w) = C·t, где k = 2.3·r_c²/(2·l_w)·C·ln(R/r_w),
 * время в сутках. Наклон берётся из той же зависимости, которую обработка
 * потом обращает, — с округлённым множителем 2.3, а не с ln 10: иначе
 * проверка ловила бы не ошибку в расчёте, а известное расхождение в 0.11 %,
 * заложенное в книге (см. STRAIGHT_LINE_FACTOR).
 *
 * В журнал пишется восстановление уровня s⁰ − s_w, а не сам остаток s_w:
 * именно так ведут журнал экспресс-опробования (табл. 19.3 АНСДИМАТ), и
 * обработка обязана возвращать k по такому журналу.
 *
 * @param {Object} params
 * @param {number} params.k - коэффициент фильтрации, м/сут
 * @param {number} params.s0 - скачок понижения, м
 * @param {Array<number>} params.times - времена замеров, мин
 * @param {Object} params.well - геометрия скважины
 * @returns {Array<{t: number, s: number}>} журнал: время и восстановление
 */
function syntheticJournal({ k, s0, times, well }) {
  const { value: influenceLog } = influenceRadiusLog(well);
  // C — наклон в сутках⁻¹
  const slopePerDay =
    (2 * well.lw * k) /
    (STRAIGHT_LINE_FACTOR * well.rc * well.rc * influenceLog);
  return times.map((t) => {
    const days = t / MINUTES_PER_DAY;
    const residual = s0 / Math.pow(10, slopePerDay * days);
    return { t, s: s0 - residual };
  });
}

describe('bouwerRiceCoefficients', () => {
  test('ветви диапазонов сходятся на стыке β = 200', () => {
    const low = bouwerRiceCoefficients(200);
    const high = bouwerRiceCoefficients(200.0001);
    // Два независимых приближения одной кривой: расхождение единицы
    // процентов, но не разы
    expect(high.A1 / low.A1).toBeCloseTo(1, 1);
    expect(high.A2 / low.A2).toBeCloseTo(1, 1);
    expect(high.A3 / low.A3).toBeCloseTo(1, 1);
  });

  test('снятые с графика значения при β = 200', () => {
    // Рис. 3.7: A₁ ≈ 6, A₂ ≈ 1.1, A₃ ≈ 7
    const { A1, A2, A3 } = bouwerRiceCoefficients(200);
    expect(A1).toBeCloseTo(6.01, 1);
    expect(A2).toBeCloseTo(1.1, 1);
    expect(A3).toBeCloseTo(6.89, 1);
  });

  test('коэффициенты растут вместе с длиной фильтра', () => {
    const short = bouwerRiceCoefficients(10);
    const long = bouwerRiceCoefficients(1000);
    expect(long.A1).toBeGreaterThan(short.A1);
    expect(long.A2).toBeGreaterThan(short.A2);
    expect(long.A3).toBeGreaterThan(short.A3);
  });

  test('за границами графика β зажимается, а не экстраполируется', () => {
    expect(bouwerRiceCoefficients(0.2).beta).toBe(BETA_MIN);
    expect(bouwerRiceCoefficients(5000).beta).toBe(BETA_MAX);
    // Полином шестой степени за границей улетает в бессмыслицу — зажатое
    // значение обязано остаться конечным и положительным
    expect(bouwerRiceCoefficients(5000).A1).toBeGreaterThan(0);
  });

  test('нечисловое β не даёт коэффициентов', () => {
    expect(bouwerRiceCoefficients(NaN).A1).toBeNaN();
    expect(bouwerRiceCoefficients(0).A1).toBeNaN();
  });
});

describe('influenceRadiusLog', () => {
  test('несовершенная скважина считается по зависимости с A₁ и A₂', () => {
    const result = influenceRadiusLog(WELL);
    expect(result.partial).toBe(true);
    const { A1, A2 } = bouwerRiceCoefficients(WELL.lw / WELL.rw);
    const expected =
      1 /
      (1.1 / Math.log(WELL.z / WELL.rw) +
        (A1 + A2 * Math.log((WELL.m - WELL.z) / WELL.rw)) /
          (WELL.lw / WELL.rw));
    expect(result.value).toBeCloseTo(expected, 12);
  });

  test('фильтр у подошвы пласта переводит расчёт на A₃', () => {
    const result = influenceRadiusLog({ ...WELL, m: WELL.z });
    expect(result.partial).toBe(false);
    const { A3 } = bouwerRiceCoefficients(WELL.lw / WELL.rw);
    const expected =
      1 / (1.1 / Math.log(WELL.z / WELL.rw) + (WELL.rw * A3) / WELL.lw);
    expect(result.value).toBeCloseTo(expected, 12);
  });

  test('пласт большой мощности упирается в предел ln[(m−z)/r_w] = 6', () => {
    // (m − z)/r_w = e⁶ ≈ 403 → при r_w = 0.1 это m − z ≈ 40.3 м
    const thick = influenceRadiusLog({ ...WELL, m: WELL.z + 1000 });
    expect(thick.capped).toBe(true);

    const { A1, A2 } = bouwerRiceCoefficients(WELL.lw / WELL.rw);
    const expected =
      1 /
      (1.1 / Math.log(WELL.z / WELL.rw) +
        (A1 + A2 * LOG_THICKNESS_CAP) / (WELL.lw / WELL.rw));
    expect(thick.value).toBeCloseTo(expected, 12);
  });

  test('мощность ниже низа фильтра обрабатывается как совершенная скважина', () => {
    // m < z означало бы фильтр ниже подошвы — такой схемы нет
    const result = influenceRadiusLog({ ...WELL, m: 5 });
    expect(result.partial).toBe(false);
    expect(result.value).toBeCloseTo(influenceRadiusLog({ ...WELL, m: WELL.z }).value, 12);
  });

  test('уровень у самого низа фильтра результата не даёт', () => {
    // ln(z/r_w) ≤ 0: радиус влияния теряет смысл
    expect(influenceRadiusLog({ ...WELL, z: WELL.rw }).value).toBeNaN();
    expect(influenceRadiusLog({ ...WELL, z: 0 }).value).toBeNaN();
  });

  test('без радиуса или длины фильтра результата нет', () => {
    expect(influenceRadiusLog({ ...WELL, rw: 0 }).value).toBeNaN();
    expect(influenceRadiusLog({ ...WELL, lw: 0 }).value).toBeNaN();
  });
});

describe('slugPoints', () => {
  test('откладывает lg(s⁰/s_w) по времени в минутах', () => {
    // Уровень вернулся на 2.25 из 2.5: остаток скачка 0.25, отношение 10
    const [point] = slugPoints([{ t: 5, s: 2.25 }], 2.5);
    expect(point.x).toBe(5);
    expect(point.y).toBeCloseTo(Math.log10(10), 12);
    expect(point.s).toBeCloseTo(0.25, 12);
  });

  test('журнал восстановления даёт прямую, растущую из начала координат', () => {
    // Главная проверка: в журнале лежит подъём уровня, а не остаток скачка.
    // Если вычитание из s⁰ потерять, кривая пойдёт вниз и k упадёт на
    // порядки — ровно так график и ломался
    const points = slugPoints(
      [
        { t: 0, s: 0 },
        { t: 10, s: 1.25 },
        { t: 20, s: 1.875 },
        { t: 30, s: 2.1875 },
      ],
      2.5
    );
    expect(points.map((p) => p.y)).toEqual([
      0,
      expect.closeTo(Math.log10(2), 12),
      expect.closeTo(Math.log10(4), 12),
      expect.closeTo(Math.log10(8), 12),
    ]);
  });

  test('полностью вернувшийся уровень отбрасывается', () => {
    // Последний замер журнала равен s⁰: остаток нулевой, логарифм не берётся
    const points = slugPoints(
      [
        { t: 1, s: 1.25 },
        { t: 2, s: 2.5 },
        { t: 3, s: 3 },
      ],
      2.5
    );
    expect(points).toHaveLength(1);
    expect(points[0].t).toBe(1);
  });

  test('отрицательное восстановление прижимается к началу координат', () => {
    // Уровень ниже того, на который его увели, — шум замера, а не точка
    // под осью абсцисс
    const [point] = slugPoints([{ t: 1, s: -0.4 }], 2.5);
    expect(point.y).toBe(0);
    expect(point.s).toBe(2.5);
  });

  test('без скачка понижения точек нет', () => {
    expect(slugPoints([{ t: 1, s: 0.5 }], 0)).toEqual([]);
  });
});

describe('conductivityFromSlope', () => {
  test('k = 2.3·r_c²/(2·l_w)·C·ln(R/r_w), время в сутках', () => {
    const slopePerMinute = 0.01;
    const k = conductivityFromSlope({
      slope: slopePerMinute,
      rc: 0.05,
      lw: 5,
      influenceLog: 3,
    });
    const expected =
      (2.3 * 0.05 * 0.05 * (slopePerMinute * MINUTES_PER_DAY) * 3) / (2 * 5);
    expect(k).toBeCloseTo(expected, 12);
  });

  test('множитель округлён до 2.3, как в табл. 3.1', () => {
    expect(STRAIGHT_LINE_FACTOR).toBe(2.3);
    // Расхождение с точным ln 10 — 0.11 %: столько же теряет и 0.183 у
    // Купера — Джейкоба, и обе цифры взяты из книги намеренно
    expect(Math.LN10 / STRAIGHT_LINE_FACTOR - 1).toBeCloseTo(0.00112, 5);
  });

  test('знак наклона на результат не влияет', () => {
    const common = { rc: 0.05, lw: 5, influenceLog: 3 };
    expect(conductivityFromSlope({ ...common, slope: -0.01 })).toBeCloseTo(
      conductivityFromSlope({ ...common, slope: 0.01 }),
      12
    );
  });

  test('без наклона и радиуса обсадки результата нет', () => {
    expect(
      conductivityFromSlope({ slope: 0, rc: 0.05, lw: 5, influenceLog: 3 })
    ).toBeNaN();
    expect(
      conductivityFromSlope({ slope: 0.01, rc: 0, lw: 5, influenceLog: 3 })
    ).toBeNaN();
  });
});

describe('processSlugTest', () => {
  const TIMES = [1, 2, 3, 5, 8, 12, 18, 25, 35, 50];

  test('возвращает то k, по которому построены замеры', () => {
    const k = 0.35;
    const s0 = 1.2;
    const measurements = syntheticJournal({ k, s0, times: TIMES, well: WELL });
    const result = processSlugTest({
      measurements,
      initialDrawdown: s0,
      ...WELL,
    });
    expect(result.k).toBeCloseTo(k, 9);
    expect(result.points).toHaveLength(TIMES.length);
  });

  test('то же для совершенной скважины (ветвь A₃)', () => {
    const perfect = { ...WELL, m: WELL.z };
    const k = 1.4;
    const s0 = 0.8;
    // Своя сетка времён: при таком k уровень возвращается вчетверо быстрее, и
    // на общей сетке последние замеры пришлись бы на остаток порядка 1e−17 м.
    // Журнал хранит восстановление, остаток берётся вычитанием из s⁰ — такой
    // остаток в разряды double уже не попадает, как не попадает он и в замер
    // рулеткой. Опыт на этом и заканчивают: уровень вернулся
    const times = TIMES.map((t) => t / 4);
    const measurements = syntheticJournal({ k, s0, times, well: perfect });
    const result = processSlugTest({
      measurements,
      initialDrawdown: s0,
      ...perfect,
    });
    expect(result.partial).toBe(false);
    expect(result.k).toBeCloseTo(k, 9);
  });

  test('прямая через две отмеченные точки', () => {
    const k = 0.35;
    const s0 = 1.2;
    const measurements = syntheticJournal({ k, s0, times: TIMES, well: WELL });
    const result = processSlugTest({
      measurements,
      initialDrawdown: s0,
      ...WELL,
      selected: [0, 9],
    });
    // Точки лежат на прямой ровно, поэтому любые две дают тот же наклон
    expect(result.k).toBeCloseTo(k, 9);
  });

  test('проведённая руками прямая важнее подобранной', () => {
    const s0 = 1.2;
    const measurements = syntheticJournal({ k: 0.35, s0, times: TIMES, well: WELL });
    const result = processSlugTest({
      measurements,
      initialDrawdown: s0,
      ...WELL,
      freeLine: { slope: 0.02, intercept: 0 },
    });
    expect(result.slope).toBe(0.02);
    expect(result.k).toBeCloseTo(
      conductivityFromSlope({
        slope: 0.02,
        rc: WELL.rc,
        lw: WELL.lw,
        influenceLog: result.influenceLog,
      }),
      12
    );
  });

  test('одного замера для прямой мало', () => {
    const result = processSlugTest({
      measurements: [{ t: 1, s: 0.5 }],
      initialDrawdown: 1.2,
      ...WELL,
    });
    expect(result.line).toBeNull();
    expect(result.k).toBeNaN();
  });

  test('пустой журнал не роняет обработку', () => {
    const result = processSlugTest({
      measurements: [],
      initialDrawdown: 1.2,
      ...WELL,
    });
    expect(result.points).toEqual([]);
    expect(result.k).toBeNaN();
    // Геометрия скважины при этом посчитана: её видно на экране до замеров
    expect(result.influenceLog).toBeGreaterThan(0);
  });
});
