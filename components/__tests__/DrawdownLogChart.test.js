/**
 * График понижения в расчёте понижения
 *
 * Заказчик читает понижение как растущую величину: ноль внизу, максимум
 * вверху. Нажатие на пункт легенды оставляет одну кривую — опытной или
 * наблюдательной — и подгоняет под неё шкалу: у наблюдательной понижение
 * вдвое меньше, и на общей шкале её форма пряталась у нуля.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { Path, Text as SvgText } from 'react-native-svg';
import DrawdownLogChart from '../charts/DrawdownLogChart';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

const SERIES = [
  { t: 0.001, sWell: 0.3, sObs: 0.02 },
  { t: 0.01, sWell: 0.4, sObs: 0.1 },
  { t: 0.1, sWell: 0.5, sObs: 0.2 },
  { t: 1, sWell: 0.6, sObs: 0.3 },
  { t: 10, sWell: 0.8, sObs: 0.4 },
];

beforeAll(() => {
  I18n.locale = 'ru';
});

const mount = () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <DrawdownLogChart series={SERIES} width={340} />
      </PaperProvider>
    );
  });
  return tree;
};

/** Деления оси понижения: подпись и высота на полотне */
const yTicks = (tree) =>
  tree.root
    .findAllByType(SvgText)
    .filter((node) => node.props.textAnchor === 'end' && /^\d+(\.\d)?$/.test(String(node.props.children)))
    .map((node) => ({ value: Number(node.props.children), y: node.props.y }));

/** Нарисованные кривые: цвет штриха каждой */
const curveColors = (tree) =>
  tree.root
    .findAllByType(Path)
    .filter((node) => node.props.fill === 'none' && node.props.d)
    .map((node) => node.props.stroke);

const pressLegend = (tree, label) =>
  act(() => {
    tree.root
      .find((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')
      .props.onPress();
  });

test('ноль понижения внизу, максимум вверху', () => {
  const ticks = yTicks(mount());
  const zero = ticks.find((tick) => tick.value === 0);
  const top = ticks.reduce((best, tick) => (tick.value > best.value ? tick : best));

  // На экране ось y растёт вниз: у нуля координата больше, чем у максимума
  expect(zero.y).toBeGreaterThan(top.y);
});

test('нажатие на «набл.» оставляет только наблюдательную и подгоняет шкалу', () => {
  const tree = mount();
  const fullTop = Math.max(...yTicks(tree).map((tick) => tick.value));

  pressLegend(tree, I18n.t('schemeObsWell'));

  expect(curveColors(tree)).toEqual([lightTheme.colors.secondary]);
  // Шкала сжалась под наблюдательную: её максимум 0.4, а не 0.8 опытной
  const isolatedTop = Math.max(...yTicks(tree).map((tick) => tick.value));
  expect(isolatedTop).toBeLessThan(fullTop);
  expect(isolatedTop).toBeLessThanOrEqual(0.5);
});

test('повторное нажатие возвращает обе кривые', () => {
  const tree = mount();

  pressLegend(tree, I18n.t('schemePumpedWell'));
  expect(curveColors(tree)).toEqual([lightTheme.colors.primary]);

  pressLegend(tree, I18n.t('schemePumpedWell'));
  expect(curveColors(tree)).toHaveLength(2);
});
