/**
 * Проверка сборки серий для экрана обработки
 *
 * Главное здесь — фаза восстановления: журнал заполнялся, сохранялся и
 * проверялся на полноту, но до графика не доходил никогда.
 */

import {
  chartRawSeries,
  recoveryAbscissa,
  finalDrawdownAtStop,
} from '../useChartSeries';
import { TRACKING_KINDS } from '../../../calc/tracking';
import { SERIES_ROLES } from '../../../calc/chartSeries';
import I18n from '../../../Localization';

// Локаль в тестах определяется системой и приезжает английской. Подписи кривых
// проверяются по смыслу, а не по окружению, поэтому закрепляем её
beforeAll(() => {
  I18n.locale = 'ru';
});

const base = {
  trackingKind: TRACKING_KINDS.TIME,
  measurements: [
    { t: 1, s: 1 },
    { t: 10, s: 3 },
    { t: 100, s: 5 },
  ],
  recoveryMeasurements: [
    { t: 1, s: 0.5 },
    { t: 10, s: 3 },
    { t: 100, s: 4.8 },
  ],
  finalDrawdown: 5,
  pumpingDuration: 100,
  wellsWithDistance: [],
  wellMeasurements: {},
  moment: NaN,
  isRecovery: false,
  activeWellName: 'Скважина',
};

test('на откачке кривая одна', () => {
  const series = chartRawSeries(base);
  expect(series).toHaveLength(1);
  expect(series[0].role).toBe(SERIES_ROLES.FIT);
});

test('на восстановлении остаётся одно восстановление', () => {
  // Фазы не смешиваются на одном полотне: по абсциссе у откачки время от её
  // начала, у восстановления отношение t/t′, и вместе они читаются как одна
  // зависимость, которой нет. Кривые соседних скважин добавляет экран
  const series = chartRawSeries({ ...base, isRecovery: true });
  expect(series.map((s) => s.id)).toEqual(['recovery']);
  expect(series[0].role).toBe(SERIES_ROLES.FIT);
});

test('кривая восстановления идёт остаточным понижением', () => {
  const series = chartRawSeries({ ...base, isRecovery: true });
  const recovery = series.find((s) => s.id === 'recovery');
  expect(recovery.measurements.map((m) => m.s)).toEqual([
    4.5,
    2,
    expect.closeTo(0.2, 10),
  ]);
});

test('имя скважины дописывается к фазе, а не заменяет её', () => {
  // Кривая звалась просто именем скважины, и на восстановлении в легенде
  // было не понять, какую фазу показывают
  const series = chartRawSeries({ ...base, isRecovery: true, activeWellName: '1p' });
  expect(series[0].name).toBe('Восстановление — 1p');
});

test('восстановление всегда в координатах Тейса', () => {
  // Остаточное понижение спрямляется только по lg(t/t′), и только там
  // T = 0.183·Q/C верна
  const series = chartRawSeries({ ...base, isRecovery: true });
  // t/t′ для замера через 1 минуту после остановки при откачке 100 минут
  expect(series[0].measurements[0].t).toBeCloseTo(101, 10);
});

test('без понижения на остановке кривой восстановления нет', () => {
  // И кривой откачки вместо неё тоже: полотно остаётся пустым, а экран
  // объясняет, какого поля не хватает
  const series = chartRawSeries({ ...base, isRecovery: true, finalDrawdown: 0 });
  expect(series).toEqual([]);
});

test('на откачке журнал восстановления игнорируется', () => {
  const series = chartRawSeries(base);
  expect(series.map((s) => s.id)).toEqual(['pumping']);
});

test('площадное прослеживание строит профиль воронки по кусту', () => {
  const series = chartRawSeries({
    ...base,
    trackingKind: TRACKING_KINDS.AREA,
    moment: 10,
    wellsWithDistance: [
      { id: 'far', name: '2p', distance: 100 },
      { id: 'near', name: '1p', distance: 10 },
    ],
    wellMeasurements: {
      near: [{ t: 10, s: 4 }],
      far: [{ t: 10, s: 1 }],
    },
  });
  // По возрастанию расстояния: ломаная по таким точкам и есть профиль
  expect(series[0].measurements.map((m) => m.t)).toEqual([10, 100]);
});

test('без общего момента площадного графика нет', () => {
  const series = chartRawSeries({
    ...base,
    trackingKind: TRACKING_KINDS.AREA,
    moment: NaN,
    wellsWithDistance: [{ id: 'near', name: '1p', distance: 10 }],
    wellMeasurements: { near: [{ t: 10, s: 4 }] },
  });
  expect(series).toEqual([]);
});

test('комбинированное прослеживание помечает точки скважиной', () => {
  const series = chartRawSeries({
    ...base,
    trackingKind: TRACKING_KINDS.COMBINED,
    wellsWithDistance: [{ id: 'near', name: '1p', distance: 10 }],
    wellMeasurements: { near: [{ t: 100, s: 4 }] },
  });
  expect(series[0].measurements[0].group).toBe('near');
  // t/r²: сто минут на сто квадратных метров
  expect(series[0].measurements[0].t).toBeCloseTo(1, 10);
});

describe('recoveryAbscissa', () => {
  test('отношение считается от начала откачки к остановке', () => {
    const points = recoveryAbscissa({
      measurements: [{ t: 10, s: 2 }],
      pumpingDuration: 90,
    });
    expect(points[0].t).toBeCloseTo(10, 10);
  });

  test('без длительности откачки точек нет', () => {
    expect(
      recoveryAbscissa({ measurements: [{ t: 10, s: 2 }], pumpingDuration: 0 })
    ).toEqual([]);
  });

  test('замер до остановки насоса отбрасывается', () => {
    // Отношение меньше единицы означало бы отрицательное время от остановки
    const points = recoveryAbscissa({
      measurements: [
        { t: 0, s: 1 },
        { t: 10, s: 2 },
      ],
      pumpingDuration: 90,
    });
    expect(points).toHaveLength(1);
  });
});

/**
 * Восстановление и виды с расстоянием в абсциссе
 *
 * Куст строит график по расстояниям — площадной s — lg r и комбинированный
 * s — lg(t/r²). Оба ветвились раньше проверки фазы, и переход на
 * восстановление оставлял на полотне точки откачки: подписи осей менялись,
 * данные — нет. Прямую по ним можно было ещё и подвинуть, получив число из
 * журнала, которого в этой фазе не открывали.
 */
describe('восстановление важнее вида прослеживания', () => {
  const cluster = {
    wellsWithDistance: [
      { id: 'far', name: '2p', distance: 100 },
      { id: 'near', name: '1p', distance: 10 },
    ],
    wellMeasurements: {
      near: [{ t: 10, s: 4 }],
      far: [{ t: 10, s: 1 }],
    },
  };

  test('комбинированный вид на восстановлении не отдаёт точки куста', () => {
    const series = chartRawSeries({
      ...base,
      ...cluster,
      trackingKind: TRACKING_KINDS.COMBINED,
      isRecovery: true,
      // Журнал восстановления пуст — строить нечего, и полотно обязано
      // остаться пустым, а не показывать откачку
      recoveryMeasurements: [],
    });
    expect(series).toEqual([]);
  });

  test('площадной вид на восстановлении не строит профиль воронки', () => {
    const series = chartRawSeries({
      ...base,
      ...cluster,
      trackingKind: TRACKING_KINDS.AREA,
      isRecovery: true,
      moment: 10,
    });
    // На восстановлении остаётся одно восстановление: ни профиля воронки по
    // расстояниям, ни кривой откачки рядом с ним
    expect(series.map((s) => s.id)).toEqual(['recovery']);
  });
});

/**
 * Понижение на момент остановки насоса
 *
 * У куста оно своё у каждой скважины: опытная садится на метры, дальняя
 * наблюдательная — на сантиметры. Общее на весь проект число давало
 * остаточное понижение чужой скважины, а Math.max(0, …) превращал разницу
 * в ровный ноль — кривая ложилась горизонталью и молчала о причине.
 */
describe('finalDrawdownAtStop', () => {
  test('берётся из последнего замера откачки этой же скважины', () => {
    expect(
      finalDrawdownAtStop({
        measurements: [
          { t: 1, s: 1 },
          { t: 100, s: 5 },
        ],
      })
    ).toBe(5);
  });

  test('заданное руками значение важнее журнала', () => {
    expect(
      finalDrawdownAtStop({ measurements: [{ t: 100, s: 5 }], stored: 4 })
    ).toBe(4);
  });

  test('пустой журнал без заданного значения даёт ноль', () => {
    expect(finalDrawdownAtStop({ measurements: [] })).toBe(0);
  });

  test('незаполненные строки в хвосте журнала пропускаются', () => {
    expect(
      finalDrawdownAtStop({
        measurements: [
          { t: 100, s: 5 },
          { t: NaN, s: NaN },
        ],
      })
    ).toBe(5);
  });
});
