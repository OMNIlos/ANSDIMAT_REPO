/**
 * Справка: имя релиза и адрес сайта по языку
 *
 * Сайт у АНСДИМАТ двуязычный, и ссылка «ansdimat.com» обязана вести на ту
 * версию, на каком языке открыто приложение. Видеоуроков в справке больше
 * нет: они живут на сайте.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';
import { LanguageContext } from '../../LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));

const AboutScreen = require('../AboutScreen').default;

let openURL;

beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

/**
 * Монтирует справку на заданном языке
 *
 * @param {'ru'|'en'} locale - язык интерфейса
 * @returns {Object} дерево отрисовки
 */
const mount = (locale) => {
  I18n.locale = locale;
  let tree;
  act(() => {
    tree = renderer.create(
      <LanguageContext.Provider value={{ locale, toggleLanguage: () => {} }}>
        <PaperProvider theme={lightTheme}>
          <AboutScreen navigation={{ navigate: jest.fn() }} />
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
    .join(' ');

/** Нажатие строки справки по её подписи */
const pressRow = (tree, label) =>
  act(() => {
    tree.root
      .find((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')
      .props.onPress();
  });

test('в справке указано имя релиза', () => {
  const tree = mount('ru');

  expect(screenText(tree)).toContain('Moonflower');
});

test('видеоуроков в справке нет', () => {
  const tree = mount('ru');

  expect(screenText(tree)).not.toContain('Видеоуроки');
});

test('ansdimat.com на русском ведёт на русский сайт', () => {
  const tree = mount('ru');

  pressRow(tree, 'ansdimat.com');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/Ru/');
});

test('ansdimat.com на английском ведёт на английский сайт', () => {
  const tree = mount('en');

  pressRow(tree, 'ansdimat.com');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/');
});
