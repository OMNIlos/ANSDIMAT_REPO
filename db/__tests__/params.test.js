/**
 * Проверка исходных данных видов ОФР со своей схемой
 *
 * Разбор не доверяет содержимому: в колонку `params` попадает чужой файл,
 * запись из будущей версии и повреждённый JSON. Форма результата обязана
 * зависеть только от вида ОФР — иначе экран получит набор без половины полей
 * и посчитает по пустоте, ничего об этом не сказав.
 */

import {
  defaultParams,
  parseParams,
  serializeParams,
  rebaseParams,
  emptyStage,
  PARAM_QUANTITIES,
  LUGEON_STAGE_COUNT,
  LUGEON_READING_COUNT,
} from '../params';
import { OFR_TYPES, LEGACY_OFR_TYPES } from '../schema';
import { QUANTITIES } from '../../calc/units';

describe('defaultParams', () => {
  test('у откачек своих исходных данных нет', () => {
    expect(defaultParams(OFR_TYPES.SINGLE)).toBeNull();
    expect(defaultParams(OFR_TYPES.CLUSTER)).toBeNull();
    expect(defaultParams(LEGACY_OFR_TYPES.RECOVERY)).toBeNull();
  });

  test('экспресс-опробование заводится с типовой геометрией', () => {
    const params = defaultParams(OFR_TYPES.SLUG);
    expect(params.rw).toBeGreaterThan(0);
    expect(params.lw).toBeGreaterThan(0);
    // Замеряемое остаётся пустым: подставлять за геолога результат опыта нельзя
    expect(params.s0).toBe(0);
  });

  test('нагнетание заводится пятью пустыми ступенями', () => {
    const params = defaultParams(OFR_TYPES.LUGEON);
    expect(params.stages).toHaveLength(LUGEON_STAGE_COUNT);
    expect(params.stages[0].readings).toHaveLength(LUGEON_READING_COUNT);
    expect(params.stages[0].readings.every((value) => value === null)).toBe(true);
  });

  test('отдаёт копию, а не сам образец', () => {
    const first = defaultParams(OFR_TYPES.VADOSE);
    first.area = 999;
    expect(defaultParams(OFR_TYPES.VADOSE).area).not.toBe(999);
  });
});

describe('parseParams', () => {
  test('повреждённый JSON не роняет разбор', () => {
    const params = parseParams(OFR_TYPES.VADOSE, '{не json');
    expect(params).toEqual(defaultParams(OFR_TYPES.VADOSE));
  });

  test('недостающие поля берутся из набора по умолчанию', () => {
    const params = parseParams(OFR_TYPES.SLUG, JSON.stringify({ rw: 0.1 }));
    expect(params.rw).toBe(0.1);
    expect(params.rc).toBe(defaultParams(OFR_TYPES.SLUG).rc);
  });

  test('лишние ключи отбрасываются', () => {
    const params = parseParams(
      OFR_TYPES.SLUG,
      JSON.stringify({ rw: 0.1, somethingElse: 42 })
    );
    expect(params.somethingElse).toBeUndefined();
  });

  test('нечисловое становится числом набора по умолчанию', () => {
    const params = parseParams(
      OFR_TYPES.SLUG,
      JSON.stringify({ rw: 'не число', lw: null })
    );
    expect(params.rw).toBe(defaultParams(OFR_TYPES.SLUG).rw);
    expect(params.lw).toBe(defaultParams(OFR_TYPES.SLUG).lw);
  });

  test('число строкой разбирается — так его пишет поле ввода', () => {
    expect(parseParams(OFR_TYPES.SLUG, JSON.stringify({ rw: '0.075' })).rw).toBe(
      0.075
    );
  });

  test('ступень дополняется до десяти отсчётов, лишние отбрасываются', () => {
    const params = parseParams(
      OFR_TYPES.LUGEON,
      JSON.stringify({ stages: [{ pressure: 1e5, readings: [1, 2, 3] }] })
    );
    expect(params.stages).toHaveLength(1);
    expect(params.stages[0].readings).toHaveLength(LUGEON_READING_COUNT);
    expect(params.stages[0].readings.slice(0, 3)).toEqual([1, 2, 3]);
    expect(params.stages[0].readings[3]).toBeNull();

    const long = parseParams(
      OFR_TYPES.LUGEON,
      JSON.stringify({
        stages: [{ pressure: 1e5, readings: new Array(30).fill(1) }],
      })
    );
    expect(long.stages[0].readings).toHaveLength(LUGEON_READING_COUNT);
  });

  test('пропуск отсчёта остаётся пропуском, а не нулём', () => {
    const params = parseParams(
      OFR_TYPES.LUGEON,
      JSON.stringify({ stages: [{ pressure: 1e5, readings: [1, '', null, 4] }] })
    );
    expect(params.stages[0].readings[1]).toBeNull();
    expect(params.stages[0].readings[2]).toBeNull();
    expect(params.stages[0].readings[3]).toBe(4);
  });

  test('способ расчёта k сохраняется, неизвестный заменяется на Мойе', () => {
    const { LUGEON_FORMULAS } = require('../../calc/lugeon');
    expect(
      parseParams(OFR_TYPES.LUGEON, JSON.stringify({ formula: 'thiem' })).formula
    ).toBe(LUGEON_FORMULAS.THIEM);
    expect(
      parseParams(OFR_TYPES.LUGEON, JSON.stringify({ formula: 'выдумка' }))
        .formula
    ).toBe(LUGEON_FORMULAS.MOYE);
    expect(parseParams(OFR_TYPES.LUGEON, '{}').formula).toBe(
      LUGEON_FORMULAS.MOYE
    );
  });

  test('учёт капиллярных сил включается только явным true', () => {
    // Умолчание — Болдырев: набор без этого поля пришёл из журнала старее
    // самого выбора метода, и достраивать по нему Биндемана значит подставить
    // в расчёт незаполненные слой воды и глубину просачивания
    expect(parseParams(OFR_TYPES.VADOSE, '{}').useCapillary).toBe(false);
    expect(
      parseParams(OFR_TYPES.VADOSE, JSON.stringify({ useCapillary: true }))
        .useCapillary
    ).toBe(true);
    expect(
      parseParams(OFR_TYPES.VADOSE, JSON.stringify({ useCapillary: false }))
        .useCapillary
    ).toBe(false);
  });

  test('принимает уже разобранный объект', () => {
    expect(parseParams(OFR_TYPES.SLUG, { rw: 0.2 }).rw).toBe(0.2);
  });
});

describe('serializeParams', () => {
  test('у откачек в колонку идёт null', () => {
    expect(serializeParams(OFR_TYPES.SINGLE, { rw: 1 })).toBeNull();
  });

  test('запись и чтение возвращают тот же набор', () => {
    const original = defaultParams(OFR_TYPES.LUGEON);
    original.stages[0].pressure = 286132.4;
    original.stages[0].readings[0] = 8.836;
    const restored = parseParams(
      OFR_TYPES.LUGEON,
      serializeParams(OFR_TYPES.LUGEON, original)
    );
    expect(restored).toEqual(original);
  });

  test('пустой набор записывается значениями по умолчанию', () => {
    const restored = parseParams(
      OFR_TYPES.VADOSE,
      serializeParams(OFR_TYPES.VADOSE, null)
    );
    expect(restored).toEqual(defaultParams(OFR_TYPES.VADOSE));
  });
});

describe('экспресс-опробование: положение фильтра', () => {
  test('запись с низом фильтра пересчитывается в середину', () => {
    // Журнал, сохранённый до того, как поле стало «Верх/Низ»: z = 12 при
    // фильтре 5 м — это середина на 9.5 м
    const params = parseParams(OFR_TYPES.SLUG, {
      rw: 0.1,
      rc: 0.05,
      lw: 5,
      z: 12,
      m: 20,
      s0: 1,
    });
    expect(params.lt).toBeCloseTo(9.5, 12);
    expect(params.z).toBeUndefined();
  });

  test('пересчёт берёт длину фильтра из той же записи', () => {
    // Не из набора по умолчанию: иначе середина вышла бы не про эту скважину
    const params = parseParams(OFR_TYPES.SLUG, { lw: 8, z: 12 });
    expect(params.lt).toBeCloseTo(8, 12);
  });

  test('новая запись читается как есть', () => {
    const params = parseParams(OFR_TYPES.SLUG, { lw: 5, lt: 9.5 });
    expect(params.lt).toBeCloseTo(9.5, 12);
  });

  test('без положения фильтра берётся умолчание', () => {
    const params = parseParams(OFR_TYPES.SLUG, { lw: 5 });
    expect(params.lt).toBe(defaultParams(OFR_TYPES.SLUG).lt);
  });
});

describe('rebaseParams', () => {
  test('переводит поля по их величине', () => {
    const doubled = rebaseParams(
      OFR_TYPES.SLUG,
      { rw: 0.05, rc: 0.05, lw: 2, lt: 5, m: 10, s0: 1 },
      (value) => value * 2
    );
    expect(doubled.rw).toBe(0.1);
    expect(doubled.lt).toBe(10);
    expect(doubled.s0).toBe(2);
  });

  test('давление и показания ступеней переводятся внутри массива', () => {
    const params = defaultParams(OFR_TYPES.LUGEON);
    params.stages[0].pressure = 1e5;
    params.stages[0].readings[0] = 8;
    const scaled = rebaseParams(OFR_TYPES.LUGEON, params, (value) => value * 10);
    expect(scaled.stages[0].pressure).toBe(1e6);
    expect(scaled.stages[0].readings[0]).toBe(80);
    // Пропуск остаётся пропуском: переводить нечего
    expect(scaled.stages[0].readings[1]).toBeNull();
  });

  test('поля без размерности переносятся как есть', () => {
    const scaled = rebaseParams(
      OFR_TYPES.LUGEON,
      { ...defaultParams(OFR_TYPES.LUGEON), density: 1050 },
      (value) => value * 10
    );
    expect(scaled.density).toBe(1050);
  });

  test('флаги и ссылка на породу переживают перевод', () => {
    const scaled = rebaseParams(
      OFR_TYPES.VADOSE,
      {
        ...defaultParams(OFR_TYPES.VADOSE),
        useCapillary: false,
        lithologyId: 'fineSand',
      },
      (value) => value
    );
    expect(scaled.useCapillary).toBe(false);
    expect(scaled.lithologyId).toBe('fineSand');
  });

  test('у откачек переводить нечего', () => {
    expect(rebaseParams(OFR_TYPES.SINGLE, null, (value) => value)).toBeNull();
  });
});

describe('PARAM_QUANTITIES', () => {
  test('у каждого числового поля объявлена величина', () => {
    for (const ofrType of [OFR_TYPES.SLUG, OFR_TYPES.LUGEON, OFR_TYPES.VADOSE]) {
      const map = PARAM_QUANTITIES[ofrType];
      const params = defaultParams(ofrType);
      for (const [key, value] of Object.entries(params)) {
        // Поля без размерности: плотность, выбор формулы, флаги, ссылка
        // на породу
        if (
          ['density', 'formula', 'useCapillary', 'lithologyId'].includes(key)
        ) {
          continue;
        }
        expect(map[key]).toBeDefined();
        if (key !== 'stages') expect(typeof value).toBe('number');
      }
    }
  });

  test('объявленные величины существуют', () => {
    const known = new Set(Object.values(QUANTITIES));
    for (const map of Object.values(PARAM_QUANTITIES)) {
      for (const [key, quantity] of Object.entries(map)) {
        if (key === 'stages') {
          expect(known.has(quantity.pressure)).toBe(true);
          expect(known.has(quantity.readings)).toBe(true);
          continue;
        }
        expect(known.has(quantity)).toBe(true);
      }
    }
  });
});

describe('emptyStage', () => {
  test('ступень заводится без давления и с пустыми отсчётами', () => {
    const stage = emptyStage();
    expect(stage.pressure).toBe(0);
    expect(stage.readings).toHaveLength(LUGEON_READING_COUNT);
    expect(stage.readings.every((value) => value === null)).toBe(true);
  });
});
