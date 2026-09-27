/**
 * Проверка текстовой сводки по видам ОФР со своей схемой
 *
 * «Поделиться текстом» уходит человеку в письмо, и проверять здесь надо не
 * вёрстку, а то, что в тексте есть числа опыта и нет пустого бланка: до
 * правки нагнетание и налив уезжали шапкой «t, мин / s, м» без единой строки.
 */

import {
  hasDrawdownJournal,
  hasFlowRate,
  ofrSummaryLines,
} from '../ofrTextSummary';
import { OFR_TYPES, LEGACY_OFR_TYPES } from '../../db/schema';
import { defaultParams } from '../../db/params';
import { QUANTITIES, BASE_UNITS, fromBase } from '../../calc/units';
import I18n from '../../Localization';

beforeAll(() => {
  I18n.locale = 'ru';
});

/** Размерности получателя — базовые: перевод здесь не проверяется */
const units = {
  fromBase: (value, quantity) => fromBase(value, quantity, BASE_UNITS[quantity]),
  unitLabel: (quantity) => quantity,
};

describe('hasDrawdownJournal', () => {
  test('откачки и экспресс-опробование ведут журнал', () => {
    expect(hasDrawdownJournal(OFR_TYPES.SINGLE)).toBe(true);
    expect(hasDrawdownJournal(OFR_TYPES.CLUSTER)).toBe(true);
    expect(hasDrawdownJournal(OFR_TYPES.SLUG)).toBe(true);
    // Журналы прежних версий тоже: они и были откачками
    expect(hasDrawdownJournal(LEGACY_OFR_TYPES.RECOVERY)).toBe(true);
  });

  test('нагнетание и налив журнала не ведут', () => {
    expect(hasDrawdownJournal(OFR_TYPES.LUGEON)).toBe(false);
    expect(hasDrawdownJournal(OFR_TYPES.VADOSE)).toBe(false);
  });
});

describe('hasFlowRate', () => {
  test('постоянный дебит только у откачек', () => {
    expect(hasFlowRate(OFR_TYPES.SINGLE)).toBe(true);
    expect(hasFlowRate(OFR_TYPES.SLUG)).toBe(false);
    expect(hasFlowRate(OFR_TYPES.LUGEON)).toBe(false);
    expect(hasFlowRate(OFR_TYPES.VADOSE)).toBe(false);
  });
});

describe('ofrSummaryLines', () => {
  test('у откачек своей сводки нет', () => {
    expect(
      ofrSummaryLines({ ofrType: OFR_TYPES.SINGLE, params: null }, units)
    ).toEqual([]);
  });

  test('налив в шурф отдаёт исходные данные и результат', () => {
    const text = ofrSummaryLines(
      {
        ofrType: OFR_TYPES.VADOSE,
        params: {
          ...defaultParams(OFR_TYPES.VADOSE),
          volume: 0.003,
          interval: 10,
          area: 2.5,
          head: 0.1,
          depth: 10,
          capillary: 0.3,
          // Эталон отчёта посчитан по Биндеману, а умолчание — Болдырев
          useCapillary: true,
        },
      },
      units
    ).join('\n');

    expect(text).toContain(I18n.t('ofrInputs'));
    expect(text).toContain(I18n.t('ofrResult'));
    // Контрольный пример: k = 0.1661538 м/сут
    expect(text).toContain('0.166154');
  });

  test('у Болдырева в сводке нет полей, которых нет в его формуле', () => {
    const text = ofrSummaryLines(
      {
        ofrType: OFR_TYPES.VADOSE,
        params: {
          ...defaultParams(OFR_TYPES.VADOSE),
          volume: 0.003,
          interval: 10,
          area: 2.5,
          head: 0.1,
          depth: 10,
          capillary: 0.3,
        },
      },
      units
    ).join('\n');

    expect(text).not.toContain(I18n.t('vadoseHead'));
    expect(text).not.toContain(I18n.t('vadoseDepth'));
    expect(text).not.toContain(I18n.t('vadoseCapillary'));
    // k = Q/F = 0.432/2.5
    expect(text).toContain('0.1728');
  });

  test('нагнетание отдаёт таблицу ступеней и средние', () => {
    const params = defaultParams(OFR_TYPES.LUGEON);
    params.stages = [
      {
        pressure: 286132.4,
        readings: [8.836, 8.852, 8.867, 8.883, 8.899, 8.915, 8.931, 8.947, 8.962, 8.979],
      },
    ];
    const lines = ofrSummaryLines({ ofrType: OFR_TYPES.LUGEON, params }, units);
    const text = lines.join('\n');

    expect(text).toContain(I18n.t('lugeonStagesTitle'));
    // Средний расход первой ступени — 15.8889 л/мин
    expect(text).toContain('15.8889');
    // Параметр Люжона — 5.552985
    expect(text).toContain('5.55298');
    // Столбцы разделены табуляцией: строка вставляется в Excel как таблица
    expect(lines.some((line) => line.split('\t').length === 4)).toBe(true);
  });

  test('экспресс-опробование отдаёт геометрию скважины', () => {
    const text = ofrSummaryLines(
      {
        ofrType: OFR_TYPES.SLUG,
        params: { ...defaultParams(OFR_TYPES.SLUG), rw: 0.075, s0: 1.2 },
      },
      units
    ).join('\n');

    expect(text).toContain(I18n.t('slugFilterRadius'));
    expect(text).toContain('0.075');
    expect(text).toContain('1.2');
  });

  test('незаполненная величина уходит прочерком, а не нулём', () => {
    const text = ofrSummaryLines(
      {
        ofrType: OFR_TYPES.SLUG,
        params: { ...defaultParams(OFR_TYPES.SLUG), rw: NaN },
      },
      units
    ).join('\n');
    expect(text).toContain(`${I18n.t('slugFilterRadius')}: —`);
  });

  test('журнал без исходных данных сводки не даёт', () => {
    expect(ofrSummaryLines({ ofrType: OFR_TYPES.VADOSE }, units)).toEqual([]);
  });
});
