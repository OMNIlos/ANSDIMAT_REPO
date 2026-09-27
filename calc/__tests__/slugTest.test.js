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
  filterBottom,
  splitSegments,
  regressionThroughOrigin,
  SEGMENT_MIN_POINTS,
  SEGMENT_GAIN,
  BETA_MIN,
  BETA_MAX,
  LOG_THICKNESS_CAP,
  STRAIGHT_LINE_FACTOR,
} from '../slugTest';
import { linearRegression } from '../cooperJacob';
import { MINUTES_PER_DAY } from '../units';

/**
 * Скважина контрольного расчёта: несовершенная по степени вскрытия
 *
 * Фильтр задан серединой, как его задаёт настольный АНСДИМАТ: LT_w = 9.5 при
 * длине 5 м даёт низ фильтра на z = 12 м.
 */
const WELL = { rw: 0.1, rc: 0.05, lw: 5, lt: 9.5, m: 20 };

/** Та же скважина для зависимостей, записанных через низ фильтра */
const WELL_Z = { rw: 0.1, rc: 0.05, lw: 5, z: 12, m: 20 };

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
  const { value: influenceLog } = influenceRadiusLog({
    ...well,
    z: filterBottom(well),
  });
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

/**
 * Коэффициенты полиномов, выписанные из книги второй раз
 *
 * Не ссылка на A_COEFFICIENTS, а независимая копия из АНСДИМАТ (изд. 2014,
 * с. 270—271; они же (10.94)—(10.99) «Справочника аналитических решений»,
 * 2006). Смысл теста в том, чтобы срезанный или переставленный знак в
 * `calc/slugTest.js` разошёлся с этой копией: у полиномов шестой степени
 * старшие слагаемые взаимно вычитаются, и потерянная цифра сдвигает A на
 * сотые, а k — на доли процента, то есть даёт «близко, но не то».
 */
const BOOK = {
  low: {
    A1: [
      1.4773306, 0.02741954, 8.0340006e-5, -2.5045234e-7, -1.2204508e-8,
      9.7196356e-11, -2.1463808e-13,
    ],
    A2: [
      0.166753, 0.004970107, 5.4654427e-5, -1.278645e-6, 1.1887909e-8,
      -5.1785833e-11, 8.6501211e-14,
    ],
    A3: [
      0.3905696, 0.08310949, -0.001515863, 2.1736242e-5, -1.653479e-7,
      6.3107187e-10, -9.4937404e-13,
    ],
  },
  high: {
    A1: [
      2.510366, 0.0260556, -5.08597807e-5, 5.8230884e-8, -3.7929349e-11,
      1.2935074e-14, -1.7859607e-18,
    ],
    A2: [
      -0.0651429, 0.006547392, -4.1237584e-6, -2.1340524e-9, 4.5603083e-12,
      -2.3529733e-15, 4.0923695e-19,
    ],
    A3: [
      0.2593157, 0.04869992, -9.4552972e-5, 1.05714921e-7, -6.7058679e-11,
      2.2286538e-14, -3.004312102e-18,
    ],
  },
};

/**
 * Значение полинома по схеме Горнера — та же, что в `calc/slugTest.js`
 *
 * @param {Array<number>} coefficients - коэффициенты по возрастанию степени
 * @param {number} x - аргумент
 * @returns {number} значение полинома
 */
function bookPolynomial(coefficients, x) {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1) {
    result = result * x + coefficients[i];
  }
  return result;
}

describe('bouwerRiceCoefficients', () => {
  test('совпадают с книгой во всех знаках, а не в первых четырёх', () => {
    // Точность 12 знаков: округление любого коэффициента до семи значащих
    // цифр уже разводит числа в шестом
    for (const beta of [1, 5, 20, 50, 100, 150, 200]) {
      const { A1, A2, A3 } = bouwerRiceCoefficients(beta);
      expect(A1).toBeCloseTo(bookPolynomial(BOOK.low.A1, beta), 12);
      expect(A2).toBeCloseTo(bookPolynomial(BOOK.low.A2, beta), 12);
      expect(A3).toBeCloseTo(bookPolynomial(BOOK.low.A3, beta), 12);
    }
    for (const beta of [201, 300, 500, 1000, 1500, 2000]) {
      const { A1, A2, A3 } = bouwerRiceCoefficients(beta);
      expect(A1).toBeCloseTo(bookPolynomial(BOOK.high.A1, beta), 12);
      expect(A2).toBeCloseTo(bookPolynomial(BOOK.high.A2, beta), 12);
      expect(A3).toBeCloseTo(bookPolynomial(BOOK.high.A3, beta), 12);
    }
  });

  test('граница β = 200 принадлежит нижнему диапазону', () => {
    // В книге диапазоны записаны как 1 ≤ β ≤ 200 и 200 < β < 2000: ровно на
    // 200 работает первый набор, и разница с верхним видна в первом знаке
    const edge = bouwerRiceCoefficients(200);
    expect(edge.A1).toBeCloseTo(bookPolynomial(BOOK.low.A1, 200), 12);
    expect(edge.A1).not.toBeCloseTo(bookPolynomial(BOOK.high.A1, 200), 1);
    const beyond = bouwerRiceCoefficients(200.5);
    expect(beyond.A1).toBeCloseTo(bookPolynomial(BOOK.high.A1, 200.5), 12);
  });

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
    const result = influenceRadiusLog(WELL_Z);
    expect(result.partial).toBe(true);
    const { A1, A2 } = bouwerRiceCoefficients(WELL_Z.lw / WELL_Z.rw);
    const expected =
      1 /
      (1.1 / Math.log(WELL_Z.z / WELL_Z.rw) +
        (A1 + A2 * Math.log((WELL_Z.m - WELL_Z.z) / WELL_Z.rw)) /
          (WELL_Z.lw / WELL_Z.rw));
    expect(result.value).toBeCloseTo(expected, 12);
  });

  test('фильтр у подошвы пласта переводит расчёт на A₃', () => {
    const result = influenceRadiusLog({ ...WELL_Z, m: WELL_Z.z });
    expect(result.partial).toBe(false);
    const { A3 } = bouwerRiceCoefficients(WELL_Z.lw / WELL_Z.rw);
    const expected =
      1 / (1.1 / Math.log(WELL_Z.z / WELL_Z.rw) + (WELL_Z.rw * A3) / WELL_Z.lw);
    expect(result.value).toBeCloseTo(expected, 12);
  });

  test('пласт большой мощности упирается в предел ln[(m−z)/r_w] = 6', () => {
    // (m − z)/r_w = e⁶ ≈ 403 → при r_w = 0.1 это m − z ≈ 40.3 м
    const thick = influenceRadiusLog({ ...WELL_Z, m: WELL_Z.z + 1000 });
    expect(thick.capped).toBe(true);

    const { A1, A2 } = bouwerRiceCoefficients(WELL_Z.lw / WELL_Z.rw);
    const expected =
      1 /
      (1.1 / Math.log(WELL_Z.z / WELL_Z.rw) +
        (A1 + A2 * LOG_THICKNESS_CAP) / (WELL_Z.lw / WELL_Z.rw));
    expect(thick.value).toBeCloseTo(expected, 12);
  });

  test('фильтр во всю мощность идёт по A₃, даже если z занижен', () => {
    // Совершенная скважина: l_w = m. Формально z < m — низ фильтра как будто
    // не достал до подошвы, — но фильтр длиной в пласт несовершенным быть не
    // может, и радиус влияния обязан считаться по A₃
    const full = { ...WELL_Z, lw: 20, m: 20, z: 19.5 };
    const result = influenceRadiusLog(full);
    expect(result.partial).toBe(false);
    const { A3 } = bouwerRiceCoefficients(full.lw / full.rw);
    const expected =
      1 / (1.1 / Math.log(full.z / full.rw) + (full.rw * A3) / full.lw);
    expect(result.value).toBeCloseTo(expected, 12);
  });

  test('фильтр длиннее мощности — тоже совершенная скважина', () => {
    const result = influenceRadiusLog({ ...WELL_Z, lw: 25, m: 20, z: 19 });
    expect(result.partial).toBe(false);
  });

  test('фильтр короче мощности остаётся несовершенным', () => {
    // Граница разбора: та же скважина, но фильтр на метр короче пласта
    const result = influenceRadiusLog({ ...WELL_Z, lw: 19, m: 20, z: 19 });
    expect(result.partial).toBe(true);
  });

  test('мощность ниже низа фильтра обрабатывается как совершенная скважина', () => {
    // m < z означало бы фильтр ниже подошвы — такой схемы нет
    const result = influenceRadiusLog({ ...WELL_Z, m: 5 });
    expect(result.partial).toBe(false);
    expect(result.value).toBeCloseTo(influenceRadiusLog({ ...WELL_Z, m: WELL_Z.z }).value, 12);
  });

  test('уровень у самого низа фильтра результата не даёт', () => {
    // ln(z/r_w) ≤ 0: радиус влияния теряет смысл
    expect(influenceRadiusLog({ ...WELL_Z, z: WELL_Z.rw }).value).toBeNaN();
    expect(influenceRadiusLog({ ...WELL_Z, z: 0 }).value).toBeNaN();
  });

  test('без радиуса или длины фильтра результата нет', () => {
    expect(influenceRadiusLog({ ...WELL_Z, rw: 0 }).value).toBeNaN();
    expect(influenceRadiusLog({ ...WELL_Z, lw: 0 }).value).toBeNaN();
  });
});

describe('выбор зависимости для радиуса влияния', () => {
  // Правило сверки с настольным АНСДИМАТ: фильтр во всю мощность пласта
  // считается только по A₃ (10.93), фильтр короче пласта — по A₁ и A₂
  // (10.92). Геометрия задаётся так же, как на экране: серединой фильтра
  const journal = [
    { t: 1, s: 0.07 },
    { t: 4, s: 0.2 },
    { t: 10, s: 0.34 },
  ];

  /**
   * ln(R/r_w) по (10.93) с коэффициентами из независимой копии книги
   *
   * @param {Object} well - r_w, l_w и низ фильтра z
   * @returns {number} ln(R/r_w)
   */
  const bookFull = ({ rw, lw, z }) => {
    const beta = lw / rw;
    const A3 = bookPolynomial(beta <= 200 ? BOOK.low.A3 : BOOK.high.A3, beta);
    return 1 / (1.1 / Math.log(z / rw) + (rw * A3) / lw);
  };

  /**
   * ln(R/r_w) по (10.92) с коэффициентами из независимой копии книги
   *
   * @param {Object} well - r_w, l_w, низ фильтра z и мощность m
   * @returns {number} ln(R/r_w)
   */
  const bookPartial = ({ rw, lw, z, m }) => {
    const beta = lw / rw;
    const set = beta <= 200 ? BOOK.low : BOOK.high;
    const A1 = bookPolynomial(set.A1, beta);
    const A2 = bookPolynomial(set.A2, beta);
    const logThickness = Math.min(Math.log((m - z) / rw), LOG_THICKNESS_CAP);
    return 1 / (1.1 / Math.log(z / rw) + (A1 + A2 * logThickness) / beta);
  };

  test.each([3.5, 3.9, 4])(
    'фильтр во всю мощность — только A₃, середина фильтра на %s м',
    (lt) => {
      // Опыт «Экспресс» с фильтром 8 м в пласте 8 м. Середина чуть выше
      // половины мощности опускает низ фильтра под подошву не до конца, и
      // формально z < m — но несовершенной такая скважина не бывает
      const well = { rw: 0.05, rc: 0.05, lw: 8, lt, m: 8 };
      const result = processSlugTest({
        measurements: journal,
        initialDrawdown: 3.45,
        ...well,
      });
      expect(result.partial).toBe(false);
      expect(result.influenceLog).toBeCloseTo(
        bookFull({ ...well, z: lt + well.lw / 2 }),
        12
      );
    }
  );

  test('фильтр короче пласта — A₁ и A₂', () => {
    const well = { rw: 0.05, rc: 0.05, lw: 7.9, lt: 3.5, m: 8 };
    const result = processSlugTest({
      measurements: journal,
      initialDrawdown: 3.45,
      ...well,
    });
    expect(result.partial).toBe(true);
    expect(result.influenceLog).toBeCloseTo(
      bookPartial({ ...well, z: 7.45 }),
      12
    );
  });

  test('полиномы выбираются по β = l_w/r_w, радиус обсадки на выбор не влияет', () => {
    // β = 200 — ещё нижний диапазон (10.94)—(10.96), β = 250 — уже верхний
    // (10.97)—(10.99). Обсадка вдвое шире фильтра: возьми расчёт β через
    // r_c, диапазоны перепутались бы
    const narrow = { rw: 0.04, rc: 0.08, lt: 3, m: 30 };
    const low = processSlugTest({
      measurements: journal,
      initialDrawdown: 3.45,
      ...narrow,
      lw: 8,
    });
    expect(low.beta).toBe(200);
    expect(low.A1).toBeCloseTo(bookPolynomial(BOOK.low.A1, 200), 12);
    expect(low.A2).toBeCloseTo(bookPolynomial(BOOK.low.A2, 200), 12);

    const high = processSlugTest({
      measurements: journal,
      initialDrawdown: 3.45,
      ...narrow,
      lw: 10,
    });
    expect(high.beta).toBeCloseTo(250, 12);
    expect(high.A1).toBeCloseTo(bookPolynomial(BOOK.high.A1, 250), 12);
    expect(high.A2).toBeCloseTo(bookPolynomial(BOOK.high.A2, 250), 12);
    expect(high.influenceLog).toBeCloseTo(
      bookPartial({ ...narrow, lw: 10, z: 8 }),
      12
    );
  });

  test('коэффициенты не округляются по дороге к радиусу влияния', () => {
    // В ответ идёт то же число, что даёт полином, во всех знаках double: по
    // нему экран и сокращает запись, а не по заранее урезанному
    const well = { rw: 0.05, rc: 0.05, lw: 7.9, lt: 4, m: 8 };
    const result = processSlugTest({
      measurements: journal,
      initialDrawdown: 3.45,
      ...well,
    });
    expect(result.A1).toBe(bookPolynomial(BOOK.low.A1, 158));
    expect(result.A2).toBe(bookPolynomial(BOOK.low.A2, 158));
    expect(result.A3).toBe(bookPolynomial(BOOK.low.A3, 158));
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
    const perfect = { ...WELL, m: 12 };
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

  test('автоподбор ведёт прямую через начало координат', () => {
    const s0 = 1.2;
    const measurements = syntheticJournal({ k: 0.35, s0, times: TIMES, well: WELL });
    // Замер сбит: МНК со свободным членом увёл бы прямую от нуля
    measurements[0] = { t: TIMES[0], s: measurements[0].s + 0.2 };
    const result = processSlugTest({ measurements, initialDrawdown: s0, ...WELL });
    expect(result.line.intercept).toBe(0);
  });

  test('расчёт идёт по второму прямолинейному участку', () => {
    // Опыт из проекта настольного АНСДИМАТ: на графике виден излом около
    // t = 240…540 мин, и программа подписывает там две прямые
    const s0 = 3.45;
    const measurements = [
      { t: 1, s: 0.07 },
      { t: 4, s: 0.2 },
      { t: 10, s: 0.34 },
      { t: 20, s: 0.65 },
      { t: 50, s: 1.2 },
      { t: 100, s: 1.8 },
      { t: 240, s: 2.8 },
      { t: 540, s: 3.27 },
      { t: 900, s: 3.32 },
      { t: 1920, s: 3.37 },
      { t: 3000, s: 3.4 },
      { t: 5160, s: 3.43 },
      { t: 6600, s: 3.44 },
    ];
    const well = { rw: 0.05, rc: 0.05, lw: 7.9, lt: 4, m: 8 };
    const result = processSlugTest({
      measurements,
      initialDrawdown: s0,
      ...well,
    });

    // Все тринадцать замеров остаются на графике
    expect(result.points).toHaveLength(13);
    // Излом найден там же, где его провёл геолог в настольной программе
    expect(result.split).toBe(7);
    expect(result.points[result.split].t).toBe(540);
    // Прямая второго участка через ноль не проходит: он начинается посреди
    // опыта, и книга этого не требует
    expect(result.line.intercept).toBeGreaterThan(1);
    expect(result.slope).toBeCloseTo(
      linearRegression(result.points.slice(7)).slope,
      12
    );
    // Геометрия и оба k сходятся с чертежом настольного АНСДИМАТ, где
    // подписано k = 6.420426E-03 по первому участку и 4.275847E-04 по второму
    expect(result.z).toBeCloseTo(7.95, 12);
    expect(result.influenceLog).toBeCloseTo(3.975817701, 9);
    expect(result.firstK).toBeCloseTo(6.42e-3, 5);
    expect(result.k).toBeCloseTo(4.2e-4, 5);
  });

  test('отметки геолога сильнее разбиения на участки', () => {
    const s0 = 1;
    const measurements = [
      { t: 1, s: 0.2 },
      { t: 2, s: 0.4 },
      { t: 3, s: 0.98 },
      { t: 4, s: 0.99 },
      { t: 5, s: 0.995 },
      { t: 6, s: 0.996 },
    ];
    // Отмечены крайние точки, из разных участков: индексы считаются по всему
    // журналу, и прямая идёт именно через них
    const result = processSlugTest({
      measurements,
      initialDrawdown: s0,
      ...WELL,
      selected: [0, 5],
    });
    expect(result.split).toBeNull();
    const [first, last] = [result.points[0], result.points[5]];
    expect(result.slope).toBeCloseTo(
      (last.y - first.y) / (last.x - first.x),
      12
    );
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

describe('filterBottom', () => {
  test('низ фильтра лежит на половину длины ниже середины', () => {
    expect(filterBottom({ lt: 4, lw: 7.9 })).toBeCloseTo(7.95, 12);
    expect(filterBottom({ lt: 9.5, lw: 5 })).toBeCloseTo(12, 12);
  });

  test('без длины фильтра низ не определён', () => {
    expect(filterBottom({ lt: 4, lw: 0 })).toBeNaN();
    expect(filterBottom({ lt: undefined, lw: 5 })).toBeNaN();
  });
});

describe('splitSegments', () => {
  /** Журнал с изломом: крутой участок из нуля и пологий, поднятый над осью */
  const broken = [
    ...[1, 2, 3, 4].map((x) => ({ x, y: 0.3 * x })),
    ...[10, 14, 18, 22].map((x) => ({ x, y: 1.2 + 0.02 * x })),
  ];

  test('находит излом между участками', () => {
    expect(splitSegments(broken).index).toBe(4);
  });

  test('на журнале без излома разбиения нет', () => {
    const straight = [1, 2, 3, 4, 5, 6, 7, 8].map((x) => ({
      // Прямая с обычным разбросом замеров: две прямые лягут не лучше одной
      x,
      y: 0.3 * x + ((x * 7) % 5 === 0 ? 0.004 : -0.003),
    }));
    expect(splitSegments(straight)).toBeNull();
  });

  test('короткий журнал не делится', () => {
    // Меньше двух участков по SEGMENT_MIN_POINTS замеров делить не на что
    const short = broken.slice(0, 2 * SEGMENT_MIN_POINTS - 1);
    expect(splitSegments(short)).toBeNull();
    expect(splitSegments([])).toBeNull();
  });

  test('участки покрывают журнал целиком и не пересекаются', () => {
    const { index, first, second } = splitSegments(broken);
    expect(first).toHaveLength(index);
    expect(first.length + second.length).toBe(broken.length);
    expect(second[0]).toBe(broken[index]);
  });
});

describe('regressionThroughOrigin', () => {
  test('свободный член равен нулю, а наклон — точный', () => {
    const line = regressionThroughOrigin([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]);
    expect(line.intercept).toBe(0);
    expect(line.slope).toBeCloseTo(2, 12);
    expect(line.r2).toBeCloseTo(1, 12);
  });

  test('не подбирает свободный член под смещённые точки', () => {
    // Все точки подняты на единицу: обычный МНК дал бы наклон 2 и свободный
    // член 1, а здесь смещение уходит в наклон
    const shifted = [
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ];
    const line = regressionThroughOrigin(shifted);
    expect(line.intercept).toBe(0);
    expect(line.slope).toBeGreaterThan(2);
  });

  test('одной точки мало', () => {
    expect(regressionThroughOrigin([{ x: 1, y: 2 }]).slope).toBeNaN();
    expect(regressionThroughOrigin([]).slope).toBeNaN();
  });
});

describe('пороги разбиения', () => {
  test('участок не короче трёх замеров', () => {
    expect(SEGMENT_MIN_POINTS).toBe(3);
  });

  test('разбиение принимается при десятикратном выигрыше', () => {
    expect(SEGMENT_GAIN).toBe(10);
  });
});
