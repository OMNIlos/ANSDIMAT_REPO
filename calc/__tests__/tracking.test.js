/**
 * Проверка площадного и комбинированного прослеживания
 *
 * Оба вида проверяются на «идеальном» кусте: замеры считаются по формуле
 * Купера — Джейкоба для заранее заданных T и S, подаются в обработку, и
 * результат сверяется с исходными параметрами. Так видно не качество
 * приближения — оно здесь точное, — а правильность самих формул табл. 4.1.
 *
 * Отдельно проверяется размерность. Формулы таблицы написаны для времени в
 * сутках, журнал ведётся в минутах, и промах на lg 1440 даёт пьезопроводность
 * ровно в 1440 раз меньше. На глаз такое значение выглядит правдоподобно:
 * a меняется на порядки от пласта к пласту.
 */

import {
  TRACKING_KINDS,
  processAreaTracking,
  processCombinedTracking,
} from '../tracking';
import { COOPER_JACOB_FACTOR } from '../cooperJacob';

/** Параметры «истинного» пласта */
const Q = 1000;
const T_TRUE = 500;
const S_TRUE = 1e-4;
/** Пьезопроводность по определению: a = T/S */
const A_TRUE = T_TRUE / S_TRUE;

/**
 * Понижение по формуле Купера — Джейкоба
 *
 * s = 0.183·Q/T · lg(2.25·a·t/r²), время внутри формулы в сутках.
 *
 * @param {number} tMinutes - время от начала откачки, мин
 * @param {number} r - расстояние до скважины, м
 * @returns {number} понижение, м
 */
function drawdown(tMinutes, r) {
  return (
    ((COOPER_JACOB_FACTOR * Q) / T_TRUE) *
    Math.log10((2.25 * A_TRUE * (tMinutes / 1440)) / (r * r))
  );
}

/** Расстояния до наблюдательных скважин куста, м */
const DISTANCES = [10, 25, 50, 100];

describe('TRACKING_KINDS', () => {
  test('три вида прослеживания', () => {
    expect(Object.values(TRACKING_KINDS)).toEqual(['time', 'area', 'combined']);
  });
});

describe('processAreaTracking', () => {
  /** Момент, на который снят срез по кусту: 600 мин */
  const TIME = 600;
  const points = DISTANCES.map((r) => ({ x: r, s: drawdown(TIME, r) }));

  test('восстанавливает водопроводимость по срезу на общий момент', () => {
    const result = processAreaTracking({ points, Q, time: TIME });
    expect(result.T).toBeCloseTo(T_TRUE, 6);
    expect(result.r2).toBeCloseTo(1, 10);
  });

  test('множитель 0.366, а не 0.183', () => {
    const result = processAreaTracking({ points, Q, time: TIME });
    // Понижение убывает с расстоянием, поэтому наклон отрицательный,
    // а угловой коэффициент прямой C = −tg α
    expect(result.slope).toBeLessThan(0);
    const C = -result.slope;
    expect(result.T).toBeCloseTo((2 * COOPER_JACOB_FACTOR * Q) / C, 9);
    // Тот же наклон по временнóму множителю дал бы вдвое меньше
    expect(result.T / ((COOPER_JACOB_FACTOR * Q) / C)).toBeCloseTo(2, 9);
  });

  test('восстанавливает пьезопроводность и водоотдачу', () => {
    const result = processAreaTracking({ points, Q, time: TIME });
    expect(result.a / A_TRUE).toBeCloseTo(1, 9);
    expect(result.S).toBeCloseTo(S_TRUE, 12);
  });

  test('момент времени берётся в минутах, как в журнале', () => {
    // Тот же срез, записанный в другой единице времени, описывает другой
    // момент опыта: t входит в формулу пьезопроводности явно
    const inMinutes = processAreaTracking({ points, Q, time: TIME });
    const asIfDays = processAreaTracking({ points, Q, time: TIME / 1440 });
    expect(inMinutes.a / asIfDays.a).toBeCloseTo(1 / 1440, 9);
  });

  test('водоотдача сходится с отрезком на оси абсцисс из табл. 4.2', () => {
    const result = processAreaTracking({ points, Q, time: TIME });
    // S = 2.25·T·t/r_x², где r_x — отрезок на оси абсцисс: при s = 0
    // lg r_x = A/C
    const C = -result.slope;
    const rx = Math.pow(10, result.intercept / C);
    const fromIntercept = (2.25 * result.T * (TIME / 1440)) / (rx * rx);
    expect(result.S / fromIntercept).toBeCloseTo(1, 9);
  });

  test('без момента времени пьезопроводность не считается, а T считается', () => {
    const result = processAreaTracking({ points, Q });
    expect(result.T).toBeCloseTo(T_TRUE, 6);
    expect(result.a).toBeNaN();
    expect(result.S).toBeNaN();
  });

  test('меньше двух скважин — прямую не провести', () => {
    const result = processAreaTracking({ points: points.slice(0, 1), Q, time: TIME });
    expect(result.note).toBe('needMoreMeasurements');
    expect(result.T).toBeNaN();
  });

  test('скважины без расстояния отбрасываются', () => {
    const withZero = [{ x: 0, s: 1.2 }, ...points];
    expect(processAreaTracking({ points: withZero, Q, time: TIME }).count).toBe(
      points.length
    );
  });

  test('заданная прямая заменяет регрессию', () => {
    const line = { slope: -0.5, intercept: 2 };
    const result = processAreaTracking({ points, Q, time: TIME, line });
    expect(result.slope).toBeCloseTo(-0.5, 12);
    expect(result.T).toBeCloseTo((2 * COOPER_JACOB_FACTOR * Q) / 0.5, 9);
    expect(result.r2).toBeNaN();
  });
});

describe('processCombinedTracking', () => {
  /** Замеры всех скважин куста на одной плоскости: у каждой свой r */
  const TIMES = [30, 60, 120, 300, 600, 1200];
  const points = DISTANCES.flatMap((r) =>
    TIMES.map((t) => ({ x: t / (r * r), s: drawdown(t, r) }))
  );

  test('замеры разных скважин ложатся на одну прямую', () => {
    const result = processCombinedTracking({ points, Q });
    expect(result.count).toBe(DISTANCES.length * TIMES.length);
    expect(result.r2).toBeCloseTo(1, 10);
    expect(result.T).toBeCloseTo(T_TRUE, 6);
  });

  test('восстанавливает пьезопроводность и водоотдачу', () => {
    const result = processCombinedTracking({ points, Q });
    expect(result.a / A_TRUE).toBeCloseTo(1, 9);
    expect(result.S).toBeCloseTo(S_TRUE, 12);
  });

  test('поправка на минуты: без lg 1440 пьезопроводность вышла бы в 1440 раз меньше', () => {
    const result = processCombinedTracking({ points, Q });
    // Промах на поправку — это множитель 1440 ровно, поэтому проверяется
    // не «примерно то же», а отличие от заведомо неверного значения
    expect(result.a / A_TRUE).toBeCloseTo(1, 9);
    expect(result.a / (A_TRUE / 1440)).toBeGreaterThan(1000);
  });

  test('водоотдача сходится с отрезком на оси абсцисс из табл. 4.2', () => {
    const result = processCombinedTracking({ points, Q });
    // S = 2.25·T·(t/r²)_x, отрезок снят в минутах и переведён в сутки
    const xAtZero = Math.pow(10, -result.intercept / result.slope);
    const fromIntercept = 2.25 * result.T * (xAtZero / 1440);
    expect(result.S / fromIntercept).toBeCloseTo(1, 9);
  });

  test('меньше двух замеров — прямую не провести', () => {
    const result = processCombinedTracking({ points: points.slice(0, 1), Q });
    expect(result.note).toBe('needMoreMeasurements');
    expect(result.T).toBeNaN();
  });

  test('заданная прямая заменяет регрессию', () => {
    const line = { slope: 0.4, intercept: 1.5 };
    const result = processCombinedTracking({ points, Q, line });
    expect(result.slope).toBeCloseTo(0.4, 12);
    expect(result.T).toBeCloseTo((COOPER_JACOB_FACTOR * Q) / 0.4, 9);
    expect(result.r2).toBeNaN();
  });
});
