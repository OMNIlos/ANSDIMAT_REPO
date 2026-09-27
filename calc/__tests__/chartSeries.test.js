/**
 * Проверка модели серий графика
 *
 * До этого на полотне жили три несовместимых представления: ряд с признаком
 * скважины, отдельный список соседних кривых и ничего для восстановления.
 * Здесь проверяется, что все три сводятся к одному списку серий.
 */

import {
  buildSeries,
  residualDrawdown,
  SERIES_ROLES,
  SERIES_COLORS,
} from '../chartSeries';
import { X_MODES } from '../cooperJacob';

const raw = (measurements, extra = {}) => ({
  id: 'main',
  name: 'Откачка',
  role: SERIES_ROLES.FIT,
  measurements,
  ...extra,
});

describe('buildSeries', () => {
  test('переводит время по выбранной оси', () => {
    const [series] = buildSeries({
      raw: [raw([{ t: 10, s: 1 }, { t: 100, s: 2 }])],
      mode: X_MODES.LOG,
    });
    expect(series.points[0].x).toBeCloseTo(1, 10);
    expect(series.points[1].x).toBeCloseTo(2, 10);
  });

  test('точки помнят своё место в журнале, а не в отфильтрованном ряду', () => {
    // На логарифмической оси замер с t = 0 выпадает, и нумерация разошлась бы
    // с журналом — отметка точки в таблице встала бы не на ту строку
    const [series] = buildSeries({
      raw: [raw([{ t: 0, s: 1 }, { t: 10, s: 2 }, { t: 100, s: 3 }])],
      mode: X_MODES.LOG,
    });
    expect(series.points.map((p) => p.index)).toEqual([1, 2]);
  });

  test('непригодные замеры отбрасываются', () => {
    const [series] = buildSeries({
      raw: [raw([{ t: 10, s: NaN }, { t: 10, s: 1 }])],
      mode: X_MODES.LINEAR,
    });
    expect(series.points).toHaveLength(1);
  });

  test('ряд с признаком скважины разбивается на серии по скважинам', () => {
    const series = buildSeries({
      raw: [
        raw([
          { t: 10, s: 1, group: 'w1', groupName: '1p' },
          { t: 10, s: 2, group: 'w2', groupName: '2p' },
          { t: 20, s: 3, group: 'w1', groupName: '1p' },
        ]),
      ],
      mode: X_MODES.LOG,
    });
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.name)).toEqual(['1p', '2p']);
    expect(series[0].points).toHaveLength(2);
  });

  test('разбитые по скважинам серии остаются серией подбора', () => {
    // Прямая на комбинированном прослеживании ведётся по всем точкам сразу,
    // а цвет только показывает, чья точка
    const series = buildSeries({
      raw: [raw([{ t: 10, s: 1, group: 'w1', groupName: '1p' }])],
      mode: X_MODES.LOG,
    });
    expect(series[0].role).toBe(SERIES_ROLES.FIT);
  });

  test('номера строк переживают разбивку по скважинам', () => {
    const series = buildSeries({
      raw: [
        raw([
          { t: 10, s: 1, group: 'w1', groupName: '1p' },
          { t: 10, s: 2, group: 'w2', groupName: '2p' },
          { t: 20, s: 3, group: 'w1', groupName: '1p' },
        ]),
      ],
      mode: X_MODES.LOG,
    });
    expect(series[0].points.map((p) => p.index)).toEqual([0, 2]);
    expect(series[1].points.map((p) => p.index)).toEqual([1]);
  });

  test('цвета серий не повторяются, пока хватает палитры', () => {
    const series = buildSeries({
      raw: [
        raw([{ t: 10, s: 1 }]),
        {
          id: 'b',
          name: 'B',
          role: SERIES_ROLES.REFERENCE,
          measurements: [{ t: 10, s: 2 }],
        },
        {
          id: 'c',
          name: 'C',
          role: SERIES_ROLES.REFERENCE,
          measurements: [{ t: 10, s: 3 }],
        },
      ],
      mode: X_MODES.LOG,
    });
    const colors = series.map((s) => s.color);
    expect(new Set(colors).size).toBe(3);
  });

  test('заданный цвет серии не подменяется палитрой', () => {
    const [series] = buildSeries({
      raw: [raw([{ t: 10, s: 1 }], { color: '#123456' })],
      mode: X_MODES.LOG,
    });
    expect(series.color).toBe('#123456');
  });

  test('пустая серия в список не попадает', () => {
    const series = buildSeries({
      raw: [
        raw([]),
        {
          id: 'b',
          name: 'B',
          role: SERIES_ROLES.REFERENCE,
          measurements: [{ t: 10, s: 1 }],
        },
      ],
      mode: X_MODES.LOG,
    });
    expect(series.map((s) => s.id)).toEqual(['b']);
  });

  test('пустой вход не роняет сборку', () => {
    expect(buildSeries({ raw: [], mode: X_MODES.LOG })).toEqual([]);
    expect(buildSeries({ raw: undefined, mode: X_MODES.LOG })).toEqual([]);
  });

  test('палитра объявлена и непустая', () => {
    expect(SERIES_COLORS.length).toBeGreaterThan(2);
  });
});

describe('residualDrawdown', () => {
  test('остаточное понижение убывает от понижения на остановке к нулю', () => {
    // Журнал восстановления хранит величину подъёма уровня; на общей оси с
    // откачкой её надо читать как остаток понижения, иначе кривые смотрят
    // в разные стороны и вместе не читаются
    const points = residualDrawdown({
      measurements: [
        { t: 1, s: 0 },
        { t: 10, s: 2 },
        { t: 100, s: 4.9 },
      ],
      finalDrawdown: 5,
    });
    expect(points.map((p) => p.s)).toEqual([5, 3, expect.closeTo(0.1, 10)]);
  });

  test('без понижения на остановке кривой нет', () => {
    expect(
      residualDrawdown({ measurements: [{ t: 1, s: 0 }], finalDrawdown: 0 })
    ).toEqual([]);
    expect(
      residualDrawdown({ measurements: [{ t: 1, s: 0 }], finalDrawdown: NaN })
    ).toEqual([]);
  });

  test('подъём больше понижения на остановке не даёт отрицательного остатка', () => {
    // Замер мог быть введён с опечаткой; отрицательное понижение на графике
    // означало бы уровень выше исходного, чего при восстановлении не бывает.
    // Соседняя строка сходится, поэтому кривая остаётся — гасится точка,
    // а не весь ряд
    const points = residualDrawdown({
      measurements: [
        { t: 1, s: 1 },
        { t: 10, s: 7 },
      ],
      finalDrawdown: 5,
    });
    expect(points).toHaveLength(2);
    expect(points[1].s).toBe(0);
  });

  test('журнал, не сходящийся с понижением на остановке, кривой не даёт', () => {
    // Весь журнал выше понижения на остановке — это не шум в одной строке:
    // либо в журнал внесена не та величина, либо понижение взято у чужой
    // скважины. Раньше все точки обрезались в ноль, и на полотне лежала
    // ровная горизонталь — график без единой настоящей точки, но с виду
    // посчитанный. Пустой ряд уводит экран на объяснение причины
    const points = residualDrawdown({
      measurements: [
        { t: 1, s: 6 },
        { t: 10, s: 8 },
        { t: 100, s: 9 },
      ],
      finalDrawdown: 5,
    });
    expect(points).toEqual([]);
  });

  test('непригодные замеры отбрасываются', () => {
    const points = residualDrawdown({
      measurements: [
        { t: NaN, s: 1 },
        { t: 10, s: NaN },
        { t: 10, s: 1 },
      ],
      finalDrawdown: 5,
    });
    expect(points).toHaveLength(1);
  });

  test('время замера сохраняется как есть', () => {
    const points = residualDrawdown({
      measurements: [{ t: 42, s: 1 }],
      finalDrawdown: 5,
    });
    expect(points[0].t).toBe(42);
  });
});
