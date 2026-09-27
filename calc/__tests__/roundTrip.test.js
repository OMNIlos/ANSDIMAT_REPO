/**
 * Сквозная проверка расчётного слоя на синтетическом опыте
 *
 * Обычные модульные тесты проверяют формулы поодиночке. Здесь проверяется
 * связка целиком: по известным заранее T и S считается «идеальная» откачка
 * по Тейсу, полученный ряд подаётся в обработку, и результат сверяется с
 * исходными параметрами. Если где-то потеряется множитель или перепутаются
 * минуты с сутками, разойдётся именно этот тест — по одной формуле такую
 * ошибку не видно.
 *
 * Значения взяты из типового расчёта: напорный пласт, T = 500 м²/сут,
 * S = 1e-4, наблюдательная скважина в 50 м, дебит 1000 м³/сут.
 */

import { wellFunction } from '../wellFunction';
import { predictDrawdownTheis } from '../aquifer';
import { processDrawdown, transmissivityFromSlope, storativityFromIntercept } from '../cooperJacob';
import { processAreaTracking, processCombinedTracking } from '../tracking';
import { processRecovery } from '../recovery';
import { diagnose, transmissivityFromPlateau, REGIMES } from '../diagnostics';

/** Параметры «истинного» пласта */
const T_TRUE = 500;
const S_TRUE = 1e-4;
const Q = 1000;
const R = 50;

/**
 * Понижение по Тейсу на заданное время
 *
 * @param {number} tMinutes - время от начала откачки, мин
 * @returns {number} понижение, м
 */
function drawdownAt(tMinutes) {
  const { s } = predictDrawdownTheis(
    { Q, T: T_TRUE, S: S_TRUE, r: R, t: tMinutes / 1440 },
    wellFunction
  );
  return s;
}

/**
 * Значение u для момента времени
 *
 * @param {number} tMinutes - время от начала откачки, мин
 * @returns {number} безразмерный параметр u = r²S/(4Tt)
 */
function uAt(tMinutes) {
  return (R * R * S_TRUE) / (4 * T_TRUE * (tMinutes / 1440));
}

/** Ряд замеров, типичный для полевого журнала: сгущение в начале */
const TIMES = [1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120, 200, 300, 500, 800, 1200];

/**
 * Замеры на участке применимости Купера — Джейкоба
 *
 * Приближение логарифмом верно при u < 0.01; на наблюдательной скважине
 * в 50 м это наступает примерно через 18 минут после пуска насоса.
 */
const VALID_TIMES = TIMES.filter((t) => uAt(t) < 0.01);

describe('сквозной расчёт по синтетической откачке', () => {
  const measurements = VALID_TIMES.map((t) => ({ t, s: drawdownAt(t) }));

  test('отбор по u < 0.01 оставляет поздний участок записи', () => {
    expect(VALID_TIMES[0]).toBeGreaterThanOrEqual(20);
    expect(measurements.length).toBeGreaterThanOrEqual(6);
  });

  test('обработка возвращает исходную водопроводимость', () => {
    const { T, r2 } = processDrawdown({ measurements, Q });
    expect(r2).toBeGreaterThan(0.999);
    // Погрешность самого приближения Купера — Джейкоба на этом ряду — доли процента
    expect(Math.abs(T - T_TRUE) / T_TRUE).toBeLessThan(0.01);
  });

  test('обработка возвращает исходную водоотдачу', () => {
    const { slope, intercept, T } = processDrawdown({ measurements, Q, r: R });
    const S = storativityFromIntercept(T, slope, intercept, R);
    expect(Math.abs(S - S_TRUE) / S_TRUE).toBeLessThan(0.05);
  });

  test('ранние замеры при u > 0.01 смещают оценку — их нельзя брать в прямую', () => {
    // Документируем цену нарушения условия применимости: на этом же опыте
    // прямая по всем точкам, включая ранние, завышает T и портит S.
    // Отсюда и требование методики отбрасывать начало записи
    const all = TIMES.map((t) => ({ t, s: drawdownAt(t) }));
    const { T, slope, intercept } = processDrawdown({ measurements: all, Q, r: R });
    const S = storativityFromIntercept(T, slope, intercept, R);

    expect(Math.abs(T - T_TRUE) / T_TRUE).toBeGreaterThan(0.01);
    expect(Math.abs(S - S_TRUE) / S_TRUE).toBeGreaterThan(0.05);
  });

  test('водопроводимость не зависит от единиц времени', () => {
    // Наклон в м на логарифмический цикл одинаков и в минутах, и в часах:
    // смена единиц сдвигает lg t на постоянную, наклон не трогая
    const inHours = measurements.map((m) => ({ t: m.t / 60, s: m.s }));
    const a = processDrawdown({ measurements, Q }).T;
    const b = processDrawdown({ measurements: inHours, Q }).T;
    expect(Math.abs(a - b) / a).toBeLessThan(1e-9);
  });

  test('диагностика опознаёт радиальный поток', () => {
    // Диагностике отдаём весь ряд: она для того и нужна, чтобы сама
    // отделить непригодное начало записи от установившегося участка
    const result = diagnose(TIMES.map((t) => ({ t, s: drawdownAt(t) })));
    expect(result.regime).toBe(REGIMES.RADIAL);
  });

  test('оценка T по полке производной сходится с прямой', () => {
    const { plateau } = diagnose(TIMES.map((t) => ({ t, s: drawdownAt(t) })));
    const T = transmissivityFromPlateau(Q, plateau);
    expect(Math.abs(T - T_TRUE) / T_TRUE).toBeLessThan(0.05);
  });
});

describe('сквозной расчёт по синтетическому кусту', () => {
  /**
   * Расстояния до наблюдательных скважин куста, м
   *
   * Разброс на порядок: площадному прослеживанию нужен размах по оси lg r,
   * иначе прямая проводится по пятну.
   */
  const CLUSTER = [10, 25, 50, 100];

  /**
   * Понижение в скважине куста
   *
   * @param {number} tMinutes - время от начала откачки, мин
   * @param {number} r - расстояние до опытной скважины, м
   * @returns {number} понижение, м
   */
  function drawdownAtWell(tMinutes, r) {
    return predictDrawdownTheis(
      { Q, T: T_TRUE, S: S_TRUE, r, t: tMinutes / 1440 },
      wellFunction
    ).s;
  }

  /**
   * Выполняется ли условие применимости способа прямой линии
   *
   * @param {number} tMinutes - время от начала откачки, мин
   * @param {number} r - расстояние до опытной скважины, м
   * @returns {boolean} верно ли приближение логарифмом
   */
  function applicable(tMinutes, r) {
    return (r * r * S_TRUE) / (4 * T_TRUE * (tMinutes / 1440)) < 0.01;
  }

  /** Пьезопроводность по определению */
  const A_TRUE = T_TRUE / S_TRUE;

  test('площадное прослеживание возвращает те же параметры пласта', () => {
    // Срез по кусту на 600-й минуте: к этому моменту приближение верно
    // даже в самой дальней скважине
    const MOMENT = 600;
    const points = CLUSTER.filter((r) => applicable(MOMENT, r)).map((r) => ({
      x: r,
      s: drawdownAtWell(MOMENT, r),
    }));
    expect(points.length).toBe(CLUSTER.length);

    const { T, S, a } = processAreaTracking({ points, Q, time: MOMENT });

    expect(Math.abs(T - T_TRUE) / T_TRUE).toBeLessThan(0.01);
    expect(Math.abs(S - S_TRUE) / S_TRUE).toBeLessThan(0.05);
    expect(Math.abs(a - A_TRUE) / A_TRUE).toBeLessThan(0.05);
  });

  test('комбинированное прослеживание сводит все скважины к одному пласту', () => {
    const points = CLUSTER.flatMap((r) =>
      TIMES.filter((t) => applicable(t, r)).map((t) => ({
        x: t / (r * r),
        s: drawdownAtWell(t, r),
      }))
    );

    const { T, S, a, r2 } = processCombinedTracking({ points, Q });

    expect(r2).toBeGreaterThan(0.999);
    expect(Math.abs(T - T_TRUE) / T_TRUE).toBeLessThan(0.01);
    expect(Math.abs(S - S_TRUE) / S_TRUE).toBeLessThan(0.05);
    expect(Math.abs(a - A_TRUE) / A_TRUE).toBeLessThan(0.05);
  });

  test('все три вида прослеживания дают одну пьезопроводность', () => {
    // Разные графики одного опыта обязаны сойтись: если где-то потеряна
    // поправка на минуты, разойдутся именно эти три числа
    const MOMENT = 600;
    const byTime = processDrawdown({
      measurements: VALID_TIMES.map((t) => ({ t, s: drawdownAt(t) })),
      Q,
      r: R,
    }).a;
    const byArea = processAreaTracking({
      points: CLUSTER.map((r) => ({ x: r, s: drawdownAtWell(MOMENT, r) })),
      Q,
      time: MOMENT,
    }).a;
    const byCombined = processCombinedTracking({
      points: CLUSTER.flatMap((r) =>
        TIMES.filter((t) => applicable(t, r)).map((t) => ({
          x: t / (r * r),
          s: drawdownAtWell(t, r),
        }))
      ),
      Q,
    }).a;

    expect(Math.abs(byArea - byTime) / byTime).toBeLessThan(0.1);
    expect(Math.abs(byCombined - byTime) / byTime).toBeLessThan(0.1);
  });
});

describe('сквозной расчёт по синтетическому восстановлению', () => {
  const PUMPING = 600; // насос работал 600 мин

  /**
   * Остаточное понижение после остановки: наложение реальной откачки
   * и фиктивного нагнетания, включённого в момент t = PUMPING
   *
   * @param {number} tMinutes - время от начала откачки, мин
   * @returns {number} остаточное понижение, м
   */
  function residualAt(tMinutes) {
    const real = drawdownAt(tMinutes);
    const image = predictDrawdownTheis(
      { Q, T: T_TRUE, S: S_TRUE, r: R, t: (tMinutes - PUMPING) / 1440 },
      wellFunction
    ).s;
    return real - image;
  }

  const times = [610, 620, 650, 700, 800, 1000, 1400, 2000, 3000];
  const measurements = times.map((t) => ({ t, s: residualAt(t) }));

  test('восстановление возвращает исходную водопроводимость', () => {
    const { T } = processRecovery({ measurements, Q, pumpingDuration: PUMPING });
    expect(Math.abs(T - T_TRUE) / T_TRUE).toBeLessThan(0.02);
  });

  test('прямая восстановления проходит через начало координат', () => {
    const { intercept, slope, warnings } = processRecovery({
      measurements,
      Q,
      pumpingDuration: PUMPING,
    });
    // Отсечка мала по сравнению с наклоном — признак чистого опыта
    expect(Math.abs(intercept)).toBeLessThan(0.1 * Math.abs(slope));
    expect(warnings).not.toContain('recoveryInterceptNotZero');
  });
});
