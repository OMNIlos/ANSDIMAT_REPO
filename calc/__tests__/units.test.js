/**
 * Пересчёт единиц расхода
 *
 * Контрольные значения сняты с вкладки «Расход» диалога «Пересчёт единиц
 * измерения» настольного АНСДИМАТ при 1 м³/сут и плотности 1000 кг/м³.
 * Сверка идёт по всем 29 единицам: ошибка в одном факторе не ловится ничем,
 * кроме этой таблицы, — число просто выходит не тем.
 */

import {
  DEFAULT_DENSITY,
  FLOW_GROUPS,
  FLOW_UNITS,
  convertFlowToAllUnits,
  flowFromBase,
  flowToBase,
  getFlowUnit,
} from '../units';

/** Значения одного кубометра в сутки во всех единицах при ρ = 1000 кг/м³ */
const DESKTOP = {
  m3_day: 1,
  m3_hour: 4.166667e-2,
  m3_min: 6.944445e-4,
  m3_sec: 1.157407e-5,
  l_day: 1000,
  l_hour: 41.66667,
  l_min: 0.6944444,
  l_sec: 1.157407e-2,
  kg_day: 1000,
  kg_hour: 41.66667,
  kg_min: 0.6944444,
  kg_sec: 1.157407e-2,
  bbl_day: 8.386415,
  bbl_hour: 0.3494339,
  bbl_min: 5.823899e-3,
  bbl_sec: 9.706498e-5,
  ft3_day: 35.31467,
  ft3_hour: 1.471444,
  ft3_min: 2.452407e-2,
  ft3_sec: 4.087346e-4,
  gal_day: 264.1721,
  gal_hour: 11.00717,
  gal_min: 0.1834528,
  gal_sec: 3.057547e-3,
  oil_bbl_day: 6.289811,
  oil_bbl_hour: 0.2620755,
  oil_bbl_min: 4.367924e-3,
  oil_bbl_sec: 7.279874e-5,
  acre_ft_day: 8.107132e-4,
};

test('единиц ровно 29 и группы их не теряют', () => {
  expect(FLOW_UNITS).toHaveLength(29);
  expect(FLOW_GROUPS.flatMap((group) => group.units)).toEqual(FLOW_UNITS);
  expect(FLOW_UNITS.map((unit) => unit.key)).toEqual(Object.keys(DESKTOP));
});

test('кубометр в сутки раскладывается по всем единицам как в настольной версии', () => {
  // Сверка относительная, а не абсолютная: настольная версия печатает семь
  // значащих цифр, и её «41.66667» отличается от точного 1000/24 на 3.3e-6.
  // toBeCloseTo меряет абсолютную разницу и на больших числах требовал бы
  // точности, которой в исходных значениях просто нет
  const converted = convertFlowToAllUnits(1, 'm3_day', DEFAULT_DENSITY);
  for (const row of converted) {
    const expected = DESKTOP[row.key];
    expect(Math.abs(row.value - expected) / expected).toBeLessThan(1e-6);
  }
});

test('пересчёт обратим по каждой единице', () => {
  for (const unit of FLOW_UNITS) {
    const there = flowFromBase(1, unit.key, DEFAULT_DENSITY);
    expect(flowToBase(there, unit.key, DEFAULT_DENSITY)).toBeCloseTo(1, 9);
  }
});

test('ввод в чужой единице приводится к базовой', () => {
  // 264.1721 галлона в сутки — это ровно кубометр в сутки
  expect(flowToBase(264.1720523581, 'gal_day')).toBeCloseTo(1, 9);
  expect(flowToBase(41.66667, 'kg_hour')).toBeCloseTo(1, 5);
});

test('плотность двигает только массовые единицы', () => {
  const dense = convertFlowToAllUnits(1, 'm3_day', 1200);
  const byKey = Object.fromEntries(dense.map((row) => [row.key, row.value]));

  expect(byKey.kg_day).toBeCloseTo(1200, 6);
  expect(byKey.kg_hour).toBeCloseTo(50, 6);
  // Объёмные единицы плотности не знают
  expect(byKey.l_day).toBeCloseTo(1000, 6);
  expect(byKey.gal_day).toBeCloseTo(264.1721, 4);
});

test('массовый расход пересчитывается в объёмный через плотность', () => {
  // 1200 кг/сут при ρ = 1200 — это кубометр в сутки
  expect(flowToBase(1200, 'kg_day', 1200)).toBeCloseTo(1, 9);
});

test('непригодная плотность не роняет пересчёт, а гасит массовые единицы', () => {
  const rows = convertFlowToAllUnits(1, 'm3_day', 0);
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  expect(Number.isNaN(byKey.kg_day)).toBe(true);
  // Объёмные считаются как ни в чём не бывало: плотность им не нужна
  expect(byKey.l_day).toBeCloseTo(1000, 6);
});

test('неизвестная единица и нечисло дают NaN, а не исключение', () => {
  expect(getFlowUnit('parrot')).toBeUndefined();
  expect(Number.isNaN(flowToBase(1, 'parrot'))).toBe(true);
  expect(Number.isNaN(flowFromBase(1, 'parrot'))).toBe(true);
  expect(
    convertFlowToAllUnits(Number.NaN, 'm3_day').every((row) => Number.isNaN(row.value))
  ).toBe(true);
});

test('у каждой единицы есть ключ локализации', () => {
  for (const unit of FLOW_UNITS) {
    expect(typeof unit.labelKey).toBe('string');
    expect(unit.labelKey.length).toBeGreaterThan(0);
  }
});
