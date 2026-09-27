/**
 * Схема «Оценки по Q/s» с окошками ввода
 *
 * Схема не считает: она показывает разрез, окошки по его местам, результат и
 * формулу — и сообщает наружу, что набрано. Проверяется, что окошки ровно
 * те, что нужны пласту и скважине, и что ввод и единицы расхода уходят наружу.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import I18n from '../../../Localization';

const SpecificCapacityScheme = require('../SpecificCapacityScheme').default;

beforeAll(() => {
  I18n.locale = 'ru';
});

const UNITS = [
  { key: 'm3_day', label: 'м³/сут' },
  { key: 'm3_hour', label: 'м³/час' },
  { key: 'l_min', label: 'л/мин' },
  { key: 'l_sec', label: 'л/сек' },
];

const VALUES = { Q: '100', s: '15', m: '20', lw: '2', zw: '10', rw: '0.1', anisotropy: '1' };

/**
 * Рисует схему
 *
 * @param {Object} props - изменённые свойства
 * @returns {Object} дерево отрисовки
 */
function mount(props = {}) {
  let tree;
  act(() => {
    tree = renderer.create(
      <SpecificCapacityScheme
        width={343}
        aquifer="confined"
        imperfect={false}
        values={VALUES}
        onChange={() => {}}
        invalid={[]}
        flowUnit="m3_day"
        flowUnits={UNITS}
        onFlowUnitChange={() => {}}
        result={{ symbol: 'T', value: '8.133', unit: 'м²/сут' }}
        formula={{ variant: 'confined', f: null }}
        {...props}
      />
    );
  });
  return tree;
}

/** Окошки ввода по ключу поля */
const inputs = (tree) =>
  Object.fromEntries(tree.root.findAllByType(TextInput).map((node) => [node.props.testID, node]));

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

test('совершенная скважина в напорном пласте: окошки Q и sw, результат на схеме', () => {
  const tree = mount();

  expect(Object.keys(inputs(tree)).sort()).toEqual(['qs-Q', 'qs-s']);
  expect(inputs(tree)['qs-Q'].props.value).toBe('100');
  expect(text(tree)).toContain('8.133');
  expect(text(tree)).toContain('T, м²/сут');
});

test('несовершенная скважина добавляет окошки zw, rw, kz/kr, m и lw', () => {
  const tree = mount({ imperfect: true });

  expect(Object.keys(inputs(tree)).sort()).toEqual(
    ['qs-Q', 'qs-s', 'qs-zw', 'qs-rw', 'qs-m', 'qs-anisotropy', 'qs-lw'].sort()
  );
});

test('безнапорный пласт спрашивает мощность и без тумблера', () => {
  const tree = mount({ aquifer: 'unconfined', result: { symbol: 'k', value: '0.6480', unit: 'м/сут' } });

  expect(Object.keys(inputs(tree)).sort()).toEqual(['qs-Q', 'qs-m', 'qs-s']);
  expect(text(tree)).toContain('k, м/сут');
});

test('набранное уходит наружу с ключом поля', () => {
  const onChange = jest.fn();
  const tree = mount({ imperfect: true, onChange });

  act(() => inputs(tree)['qs-zw'].props.onChangeText('12'));

  expect(onChange).toHaveBeenCalledWith('zw', '12');
});

test('неверное поле подсвечено', () => {
  const tree = mount({ invalid: ['s'] });
  const border = (key) => {
    const style = [inputs(tree)[key].props.style].flat(Infinity).filter(Boolean);
    return Object.assign({}, ...style).borderColor;
  };

  expect(border('qs-s')).not.toBe(border('qs-Q'));
});

test('единица расхода выбирается в меню у подписи Q', () => {
  const onFlowUnitChange = jest.fn();
  const tree = mount({ onFlowUnitChange });

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

  expect(onFlowUnitChange).toHaveBeenCalledWith('l_sec');
});

test('меню единиц закрывается, когда разрез перестраивается', () => {
  const tree = mount();
  const opener = tree.root.find(
    (node) =>
      node.props?.accessibilityLabel === I18n.t('qsFlowUnits') && typeof node.props.onPress === 'function'
  );
  act(() => opener.props.onPress());
  const menuItems = () =>
    tree.root.findAll(
      (node) => node.props?.accessibilityRole === 'menuitem' && typeof node.props.onPress === 'function'
    );
  expect(menuItems().length).toBeGreaterThan(0);

  act(() => {
    tree.update(
      <SpecificCapacityScheme
        width={343}
        aquifer="unconfined"
        imperfect={false}
        values={VALUES}
        onChange={() => {}}
        invalid={[]}
        flowUnit="m3_day"
        flowUnits={UNITS}
        onFlowUnitChange={() => {}}
        result={{ symbol: 'k', value: '0.6480', unit: 'м/сут' }}
        formula={{ f: null }}
      />
    );
  });

  expect(menuItems()).toHaveLength(0);
});

test('формула стоит на схеме, у несовершенной — вместе с f', () => {
  expect(text(mount())).toContain('1.22');

  const imperfect = mount({ imperfect: true, formula: { variant: 'confined', f: '43.94' } });
  expect(text(imperfect)).toContain('f = 43.94');
});
