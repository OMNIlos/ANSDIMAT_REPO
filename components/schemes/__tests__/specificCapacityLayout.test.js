/**
 * Разметка схемы «Оценки по Q/s»
 *
 * Окошки ввода стоят прямо на разрезе, как в настольном окне «Оценка
 * параметров». На телефоне места мало, и главный риск здесь — наложение:
 * окошко на окошке, окошко на стволе скважины, окошко за краем экрана.
 */

import { specificCapacityLayout, QS_BOX_HEIGHT } from '../specificCapacityLayout';

const STATES = [
  { aquifer: 'confined', imperfect: false },
  { aquifer: 'confined', imperfect: true },
  { aquifer: 'unconfined', imperfect: false },
  { aquifer: 'unconfined', imperfect: true },
];

/**
 * Прямоугольник окошка вместе с подписью над ним
 *
 * @param {Object} slot - место окошка
 * @returns {{left: number, right: number, top: number, bottom: number}}
 */
const rect = (slot) => ({
  left: slot.x,
  right: slot.x + slot.w,
  top: slot.y,
  bottom: slot.boxY + QS_BOX_HEIGHT,
});

const overlaps = (a, b) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('напорный пласт, совершенная скважина: только Q, sw, результат и формула', () => {
  const layout = specificCapacityLayout({ width: 343, aquifer: 'confined', imperfect: false });

  expect(Object.keys(layout.slots).sort()).toEqual(['Q', 'formula', 'result', 's'].sort());
  expect(layout.roof).not.toBeNull();
  expect(layout.ground).toBeNull();
  // Фильтр на всю мощность пласта
  expect(layout.well.screenTop).toBe(layout.aquifer.top);
  expect(layout.well.bottom).toBe(layout.aquifer.bottom);
  // Формула — справа от ствола, в строке результата
  expect(layout.slots.formula.x).toBeGreaterThan(layout.well.x + layout.well.w);
  expect(layout.slots.formula.y).toBe(layout.slots.result.y);
});

test('несовершенная скважина в напорном пласте добавляет zw, rw, kz/kr, m и lw', () => {
  const layout = specificCapacityLayout({ width: 343, aquifer: 'confined', imperfect: true });

  expect(Object.keys(layout.slots).sort()).toEqual(
    ['Q', 'anisotropy', 'formula', 'lw', 'm', 'result', 'rw', 's', 'zw'].sort()
  );
  // Ствол кончается фильтром, как на схеме настольной версии
  expect(layout.well.bottom).toBe(layout.well.screenBottom);
  expect(layout.well.screenBottom).toBeLessThan(layout.aquifer.bottom);
  // zw отмеряется до середины фильтра
  expect(layout.dims.zw.y2).toBe((layout.well.screenTop + layout.well.screenBottom) / 2);
  // lw — размер фильтра
  expect(layout.dims.lw).toMatchObject({ y1: layout.well.screenTop, y2: layout.well.screenBottom });
  // Формула на всю ширину под фильтром
  expect(layout.slots.formula.y).toBeGreaterThan(layout.well.bottom);
});

test('безнапорный пласт: вместо кровли земля и уровень воды, мощность m видна сразу', () => {
  const layout = specificCapacityLayout({ width: 343, aquifer: 'unconfined', imperfect: false });

  expect(layout.roof).toBeNull();
  expect(layout.ground).not.toBeNull();
  expect(layout.slots.m).toBeDefined();
  expect(layout.slots.zw).toBeUndefined();
  // Мощность отмеряется от статического уровня до подошвы
  expect(layout.dims.m).toMatchObject({ y1: layout.levels.staticY, y2: layout.aquifer.bottom });
});

test('воронка опускается от статического уровня к стволу', () => {
  for (const state of STATES) {
    const { levels } = specificCapacityLayout({ width: 343, ...state });
    expect(levels.dynamicY).toBeGreaterThan(levels.staticY);
  }
});

// 288 — калькулятор на самом узком телефоне (320 точек минус поля), 688 —
// планшет: содержимое калькулятора ограничено 720 точками
describe.each([288, 343, 390, 688])('ширина %i', (width) => {
  test.each(STATES)('$aquifer, несовершенная $imperfect: окошки не налезают', (state) => {
    const layout = specificCapacityLayout({ width, ...state });
    const slots = Object.entries(layout.slots);
    const casing = {
      left: layout.well.x - 4,
      right: layout.well.x + layout.well.w + 4,
      top: layout.well.casingTop,
      bottom: layout.well.bottom,
    };

    for (const [name, slot] of slots) {
      const own = rect(slot);
      // В пределах полотна
      expect({ name, left: own.left >= 0, right: own.right <= width }).toEqual({
        name,
        left: true,
        right: true,
      });
      // Окошко не лежит на стволе. Формула на всю ширину стоит под ним
      expect({ name, onWell: overlaps(own, casing) }).toEqual({ name, onWell: false });

      for (const [other, otherSlot] of slots) {
        if (other <= name) continue;
        expect({ pair: `${name}/${other}`, overlap: overlaps(own, rect(otherSlot)) }).toEqual({
          pair: `${name}/${other}`,
          overlap: false,
        });
      }
    }

    expect(layout.height).toBeGreaterThan(layout.aquifer.bottom);
  });
});

test('окошки на планшете не растягиваются на полэкрана', () => {
  const layout = specificCapacityLayout({ width: 688, aquifer: 'confined', imperfect: true });

  expect(layout.slots.Q.w).toBeLessThanOrEqual(200);
});

test('чем больше окошек, тем выше схема', () => {
  const height = (state) => specificCapacityLayout({ width: 343, ...state }).height;

  expect(height(STATES[0])).toBeLessThan(height(STATES[2]));
  expect(height(STATES[2])).toBeLessThan(height(STATES[3]));
});
