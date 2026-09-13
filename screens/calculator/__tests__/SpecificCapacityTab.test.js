/**
 * Вкладка «Оценка по Q/s»
 *
 * Расчёт покрыт в `calc/__tests__/specificCapacity.test.js`; здесь важно, что
 * вкладка упрощена, как просили: по умолчанию два поля, фильтр появляется
 * тумблером, безнапорный пласт спрашивает мощность, а выбранная единица
 * расхода читает набранное число, а не пересчитывает его.
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
        <SpecificCapacityTab />
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

/** Поле ввода ячейки по её подписи */
const input = (tree, label) =>
  tree.root
    .findAll((node) => node.props?.accessibilityLabel === label && typeof node.type !== 'string')[0]
    .findByType(TextInput);

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

test('по умолчанию — напорный пласт, совершенная скважина: два поля и T', () => {
  const tree = mount();
  const screen = text(tree);

  expect(screen).toContain('Расход');
  expect(screen).toContain('Понижение в скважине');
  expect(screen).not.toContain('Длина фильтра');
  expect(screen).toContain('Водопроводимость');
  // Пример из справки настольной версии: 1.22·100/15
  expect(screen).toContain('8.133');
});

test('тумблер несовершенной скважины показывает фильтр и пересчитывает T', () => {
  const tree = mount();
  toggleImperfect(tree);
  const screen = text(tree);

  expect(screen).toContain('Длина фильтра');
  expect(screen).toContain('Середина фильтра');
  expect(screen).toContain('Анизотропия');
  expect(screen).toContain('Мощность пласта');
  expect(screen).toContain('31.445');
  expect(screen).toContain('k = T/m');
});

test('безнапорный пласт спрашивает мощность и считает k', () => {
  const tree = mount();
  pick(tree, 'Безнапорный');
  const screen = text(tree);

  expect(screen).toContain('Обводнённая мощность');
  expect(screen).toContain('0.6480');
  expect(screen).toContain('T = k·m');
});

test('смена единицы расхода оставляет число и меняет результат', () => {
  const tree = mount();
  pick(tree, 'л/сек');

  // 100 л/с = 8640 м³/сут: T = 1.22·8640/15
  expect(input(tree, 'Расход').props.value).toBe('100');
  expect(text(tree)).toContain('702.720');
});

test('фильтр за пределами пласта показывает ошибку вместо результата', () => {
  const tree = mount();
  toggleImperfect(tree);
  act(() => input(tree, 'Середина фильтра').props.onChangeText('0.5'));

  expect(text(tree)).toContain(I18n.t('filterOutsideAquiferNote'));
  expect(text(tree)).not.toContain('31.445');
});
