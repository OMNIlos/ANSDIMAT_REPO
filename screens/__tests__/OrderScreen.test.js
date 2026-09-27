/**
 * Заявка на лицензию: тарифы Pro, Lite, Net, Edu
 *
 * Лицензии АНСДИМАТ продаются четырьмя тарифами, а в форме стояли
 * «однопользовательская» и «многопользовательская» — таких позиций на
 * сайте нет. Подробности о тарифах — ссылкой на страницу заказа.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Linking, TextInput } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';
import { LanguageContext } from '../../LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));

const OrderScreen = require('../OrderScreen').default;

let openURL;
let canOpenURL;

beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
  canOpenURL.mockRestore();
});

const mount = (locale) => {
  I18n.locale = locale;
  let tree;
  act(() => {
    tree = renderer.create(
      <LanguageContext.Provider value={{ locale, toggleLanguage: () => {} }}>
        <PaperProvider theme={lightTheme}>
          <OrderScreen />
        </PaperProvider>
      </LanguageContext.Provider>
    );
  });
  return tree;
};

const screenText = (tree) =>
  tree.root
    .findAll((node) => typeof node.props?.children === 'string', { deep: true })
    .map((node) => node.props.children)
    .join(' | ');

const pressByLabel = async (tree, label) =>
  act(async () => {
    await tree.root
      .find((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')
      .props.onPress();
  });

test('в форме четыре тарифа: Pro, Lite, Net, Edu', () => {
  const text = screenText(mount('ru'));

  ['Pro', 'Lite', 'Net', 'Edu'].forEach((plan) => expect(text).toContain(plan));
  expect(text).not.toContain('Однопользовательская');
  expect(text).not.toContain('Многопользовательская');
});

test('выбранный тариф уходит в письмо заявки', async () => {
  const tree = mount('ru');
  const inputs = tree.root.findAllByType(TextInput);

  act(() => {
    inputs[0].props.onChangeText('Иван Петров'); // ФИО
    inputs[2].props.onChangeText('ivan@example.com'); // почта
  });
  await pressByLabel(tree, 'Net — Сетевая');
  await pressByLabel(tree, 'Отправить');

  const mailto = openURL.mock.calls.map(([url]) => url).find((url) => url.startsWith('mailto:'));
  expect(decodeURIComponent(mailto)).toContain('Net');
});

test('тарифы подробнее — на русской странице заказа', async () => {
  const tree = mount('ru');

  await pressByLabel(tree, 'Подробнее о тарифах на сайте');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/Ru/order/');
});

test('на английском — на английской странице заказа', async () => {
  const tree = mount('en');

  await pressByLabel(tree, 'Plans and pricing on the website');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/order.shtml');
});
