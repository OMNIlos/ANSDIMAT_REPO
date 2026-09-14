/**
 * Вкладка «Оценка по Q/s»
 *
 * Расчёт покрыт в `calc/__tests__/specificCapacity.test.js`, разрез — в
 * `components/schemes/__tests__`. Здесь проверяется то, что просили в
 * документе: по умолчанию напорный пласт и два окошка, тумблер добавляет на
 * схему окошки фильтра, безнапорный пласт спрашивает мощность, а выбранная
 * единица расхода читает набранное число, а не пересчитывает его.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import I18n from '../../../Localization';

const SpecificCapacityTab = require('../SpecificCapacityTab').default;

beforeAll(() => {
  I18n.locale = 'ru';
});

// React 19: renderer.create() надо оборачивать в act()
const mount = () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <SpecificCapacityTab contentWidth={343} />
      </PaperProvider>
    );
  });
  return tree;
};

/**
 * Строки поддерева
 *
 * @param {*} node - узел или дети узла
 * @returns {string[]} найденные строки
 */
function collect(node) {
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collect);
  if (node && node.props) return collect(node.props.children);
  return [];
}

const text = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && node.type.includes('Text'))
    .flatMap((node) => collect(node.props.children))
    .join(' ');

/** Окошки схемы по ключу поля */
const inputs = (tree) =>
  Object.fromEntries(tree.root.findAllByType(TextInput).map((node) => [node.props.testID, node]));

/** Нажимает вариант переключателя по подписи */
const pick = (tree, label) => {
  const option = tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'radio' &&
      typeof node.props.onPress === 'function' &&
      collect(node.props.children).includes(label)
  );
  act(() => option.props.onPress());
};

/** Переключает тумблер несовершенной скважины */
const toggleImperfect = (tree) => {
  const toggle = tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'switch' && typeof node.props.onPress === 'function'
  );
  act(() => toggle.props.onPress());
};

test('по умолчанию — напорный пласт, совершенная скважина: два окошка и T', () => {
  const tree = mount();

  expect(Object.keys(inputs(tree)).sort()).toEqual(['qs-Q', 'qs-s']);
  expect(text(tree)).toContain('T, м²/сут');
  // Пример из справки настольной версии: 1.22·100/15
  expect(text(tree)).toContain('8.133');
});

test('тумблер несовершенной скважины добавляет окошки фильтра и пересчитывает T', () => {
  const tree = mount();
  toggleImperfect(tree);

  expect(Object.keys(inputs(tree)).sort()).toEqual(
    ['qs-Q', 'qs-s', 'qs-zw', 'qs-rw', 'qs-m', 'qs-anisotropy', 'qs-lw'].sort()
  );
  expect(text(tree)).toContain('31.445');
  // Результат — только проводимость, как в документе: без пересчёта в k
  expect(text(tree)).not.toContain('k = T/m');
});

test('безнапорный пласт спрашивает мощность и считает k', () => {
  const tree = mount();
  pick(tree, 'Безнапорный');

  expect(Object.keys(inputs(tree)).sort()).toEqual(['qs-Q', 'qs-m', 'qs-s']);
  expect(text(tree)).toContain('k, м/сут');
  expect(text(tree)).toContain('0.6480');
});

test('смена единицы расхода оставляет число и меняет результат', () => {
  const tree = mount();

  const opener = tree.root.find(
    (node) =>
      node.props?.accessibilityLabel === I18n.t('qsFlowUnits') && typeof node.props.onPress === 'function'
  );
  act(() => opener.props.onPress());
  const option = tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'menuitem' &&
      typeof node.props.onPress === 'function' &&
      collect(node.props.children).includes('л/сек')
  );
  act(() => option.props.onPress());

  // 100 л/с = 8640 м³/сут: T = 1.22·8640/15
  expect(inputs(tree)['qs-Q'].props.value).toBe('100');
  expect(text(tree)).toContain('Q, л/сек');
  expect(text(tree)).toContain('702.720');
});

test('фильтр за пределами пласта показывает ошибку вместо результата', () => {
  const tree = mount();
  toggleImperfect(tree);
  act(() => inputs(tree)['qs-zw'].props.onChangeText('0.5'));

  expect(text(tree)).toContain(I18n.t('filterOutsideAquiferNote'));
  expect(text(tree)).not.toContain('31.445');
});
