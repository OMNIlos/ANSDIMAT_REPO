/**
 * Проверка отрисовки графика
 *
 * Жесты отсюда не проверить — RNGH под react-test-renderer событий не
 * порождает. Зато проверяется всё остальное: что нарисовано, сколько кривых
 * на полотне и не прячет ли пустое состояние управление.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import DrawdownChart, { FIT_MODES } from '../DrawdownChart';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

// Локаль в тестах определяется системой и приезжает английской: пробный
// прогон показал, что I18n.t('reset') отдаёт «Reset», а не «Сброс».
// Проверять подписи, не закрепив локаль, значит проверять окружение
beforeAll(() => {
  I18n.locale = 'ru';
});

const render = (props) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <DrawdownChart width={340} {...props} />
      </PaperProvider>
    );
  });
  return JSON.stringify(tree.toJSON());
};

const pumping = [
  { t: 1, s: 1 },
  { t: 10, s: 2 },
  { t: 100, s: 3 },
];

const count = (json, node) => (json.match(new RegExp(`"${node}"`, 'g')) ?? []).length;

test('замеры превращаются в точки на полотне', () => {
  const json = render({ measurements: pumping });
  expect(count(json, 'RNSVGCircle')).toBe(3);
});

test('пустое полотно не прячет управление масштабом', () => {
  // Ровно этим одиночная откачка выглядела полностью неуправляемой: при
  // пустом ряде не отрисовывалось ни одной кнопки
  const json = render({ measurements: [] });
  expect(json).toContain('Сброс');
  // Подписи берутся из ru-локали, а не из defaultValue: ключи уже переведены
  expect(json).toContain('Уменьшить');
  expect(json).toContain('Увеличить');
});

test('пустое полотно не прячет выбор способа прямой', () => {
  const json = render({ measurements: [] });
  expect(json).toContain('Свободная прямая');
});

test('пустое полотно объясняет, чего не хватает', () => {
  const json = render({
    measurements: [],
    emptyTitle: 'Нужны расстояния',
    emptyHint: 'Введите расстояния до скважин',
  });
  expect(json).toContain('Нужны расстояния');
});

test('соседняя скважина рисуется своей кривой', () => {
  const json = render({
    measurements: pumping,
    extraSeries: [
      { id: 'w2', name: '2p', measurements: [{ t: 1, s: 5 }, { t: 10, s: 6 }] },
    ],
  });
  // Три замера основной кривой плюс два соседней
  expect(count(json, 'RNSVGCircle')).toBe(5);
});

test('свободный режим рисует свободные точки', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [
      { x: 0.5, y: 1 },
      { x: 2, y: 3 },
    ],
  });
  // Три замера плюс по два кружка на свободную точку
  expect(count(json, 'RNSVGCircle')).toBe(7);
});

test('в свободном режиме есть чем вернуть прямую', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [
      { x: 0.5, y: 1 },
      { x: 2, y: 3 },
    ],
  });
  expect(json).toContain('Прямую заново');
});

test('вырожденная свободная прямая не рисуется, но объясняется', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [
      { x: 1, y: 1 },
      { x: 1, y: 3 },
    ],
  });
  expect(json).toContain('вертикал');
});

test('отмеченный замер выделяется на полотне', () => {
  const plain = render({ measurements: pumping });
  const marked = render({ measurements: pumping, selected: [1] });
  // Отмеченная точка крупнее: радиус в дереве отличается
  expect(marked).not.toBe(plain);
  expect(marked).toContain('"r":5.5');
});

test('серии восстановления рисуются вместе с откачкой', () => {
  const json = render({
    series: [
      { id: 'pumping', name: 'Откачка', role: 'fit', measurements: pumping },
      {
        id: 'recovery',
        name: 'Восстановление',
        role: 'reference',
        measurements: [
          { t: 1, s: 3 },
          { t: 10, s: 1.5 },
          { t: 100, s: 0.2 },
        ],
      },
    ],
  });
  expect(count(json, 'RNSVGCircle')).toBe(6);
});
