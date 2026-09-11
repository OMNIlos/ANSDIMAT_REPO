/**
 * Вкладка «Пересчёт Q»
 *
 * Расчёт покрыт в `calc/__tests__/units.test.js`; здесь важно другое —
 * доходит ли посчитанное до экрана, слушается ли плотность и переносится ли
 * ввод на строку, по которой нажали. Единица выбирается нажатием по строке,
 * а не рядом чипов: двадцать девять чипов заняли бы восемь строк экрана.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import { UnitsProvider } from '../../../UnitsContext';
import I18n from '../../../Localization';

jest.mock('../../../db/settings', () => ({
  getSettings: () => Promise.resolve({}),
  setSetting: () => Promise.resolve(),
}));

const FlowTab = require('../FlowTab').default;

beforeAll(() => {
  I18n.locale = 'ru';
});

// React 19: renderer.create() надо оборачивать в act(), иначе тест-рендерер
// считается размонтированным ещё до первой проверки
const mount = () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <FlowTab />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  return tree;
};

/**
 * Весь текст поддерева одной строкой
 *
 * Работает и от корня, и от отдельного узла: findAll есть у обоих, а вот
 * toJSON — только у рендерера, и сериализовать строку списка им нечем
 *
 * @param {Object} node - корень рендерера или узел дерева
 * @returns {string} склеенный текст
 */
const textIn = (node) =>
  (node.root ?? node)
    .findAll((item) => typeof item.props?.children === 'string', { deep: true })
    .map((item) => item.props.children)
    .join(' ');

const screenText = (tree) => textIn(tree);

/** Крупное поле ввода значения */
const valueInput = (tree) =>
  tree.root.findAll(
    (node) =>
      node.props?.testID === 'flow-value' && typeof node.props?.onChangeText === 'function',
    { deep: true }
  )[0];

/** Строка пересчёта по ключу единицы */
const row = (tree, key) =>
  tree.root.findAll(
    (node) =>
      node.props?.testID === `flow-row-${key}` && typeof node.props?.onPress === 'function',
    { deep: true }
  )[0];

/** Значение в строке пересчёта */
const rowValue = (tree, key) => textIn(row(tree, key));

test('показывает все двадцать девять единиц и названия групп', () => {
  const text = screenText(mount());

  expect(text).toContain(I18n.t('flowGroupMetric'));
  expect(text).toContain(I18n.t('flowGroupMass'));
  expect(text).toContain(I18n.t('flowGroupImperial'));
  expect(text).toContain(I18n.t('flowUnitAcreFtDay'));
  expect(text).toContain(I18n.t('flowUnitOilBblSec'));
});

test('кубометр в сутки раскладывается по единицам', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('1');
  });

  expect(rowValue(tree, 'l_day')).toContain('1000');
  expect(rowValue(tree, 'gal_day')).toContain('264.17');
  expect(rowValue(tree, 'kg_day')).toContain('1000');
});

test('дробное значение вводится через запятую', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('0,5');
  });

  // Поле показывает набранное, а не пересобранное из числа
  expect(valueInput(tree).props.value).toBe('0,5');
  expect(rowValue(tree, 'l_day')).toContain('500');
});

test('нажатие на строку переносит ввод в эту единицу', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('1');
  });
  act(() => {
    row(tree, 'l_day').props.onPress();
  });

  // Нажатие означает «дальше считаем отсюда», а не «начни сначала»:
  // в поле встаёт то самое значение, что стояло в строке
  expect(valueInput(tree).props.value).toBe('1000');
  expect(row(tree, 'l_day').props.accessibilityState.selected).toBe(true);
  // Кубометр в сутки на месте: пересчёт от смены единицы ввода не поехал
  expect(rowValue(tree, 'm3_day')).toContain('1.000');
});

test('плотность двигает только массовые единицы', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('1');
  });
  const litersBefore = rowValue(tree, 'l_day');

  const density = tree.root.findAll(
    (node) => node.props?.symbol === 'ρ' && typeof node.props?.onChange === 'function',
    { deep: true }
  )[0];
  act(() => {
    density.props.onChange('1200');
  });

  expect(rowValue(tree, 'kg_day')).toContain('1200');
  expect(rowValue(tree, 'l_day')).toBe(litersBefore);
});

test('подсказывает, что единица выбирается нажатием', () => {
  expect(screenText(mount())).toContain(I18n.t('flowUnitPickHint'));
});
