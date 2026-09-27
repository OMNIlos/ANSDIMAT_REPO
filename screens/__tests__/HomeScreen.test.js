/**
 * Главная: архив откачек и ссылки на сайт
 *
 * На главной была только кнопка «Создать откачку», и где искать журнал,
 * набитый на прошлой неделе, было непонятно. Плитка «Архив откачек» ведёт на
 * тот же экран, но сразу к списку ранее созданных. Она стоит на месте
 * «Примеров и видео»: видеоуроки живут на сайте.
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
jest.mock('../../db/projects', () => ({
  countProjects: jest.fn(async () => 3),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));
// Анимации появления и нажатия идут на reanimated — на проверку подписей и
// переходов они не влияют
jest.mock('../../components/ui/AppearIn', () => ({ children }) => children);
jest.mock('../../components/ui/PressableScale', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return (props) => React.createElement(Pressable, props);
});
jest.mock('../../components/DrawdownWave', () => 'DrawdownWave');
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

const HomeScreen = require('../HomeScreen').default;

let openURL;

beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

/**
 * Монтирует главную на заданном языке и даёт счётчику журналов ответить
 *
 * @param {'ru'|'en'} locale - язык интерфейса
 * @returns {Promise<{tree: Object, navigation: Object}>}
 */
const mount = async (locale) => {
  I18n.locale = locale;
  const navigation = { navigate: jest.fn() };
  let tree;
  await act(async () => {
    tree = renderer.create(
      <LanguageContext.Provider value={{ locale, toggleLanguage: () => {} }}>
        <PaperProvider theme={lightTheme}>
          <HomeScreen navigation={navigation} />
        </PaperProvider>
      </LanguageContext.Provider>
    );
  });
  return { tree, navigation };
};

const screenText = (tree) =>
  tree.root
    .findAll((node) => typeof node.props?.children === 'string', { deep: true })
    .map((node) => node.props.children)
    .join(' ');

/** Нажимает элемент по подписи для чтения с экрана */
const press = (tree, label) =>
  act(() => {
    tree.root
      .find((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')
      .props.onPress();
  });

test('на главной есть «Архив откачек» и нет «Примеров и видео»', async () => {
  const { tree } = await mount('ru');

  const text = screenText(tree);
  expect(text).toContain('Архив откачек');
  expect(text).not.toContain('Примеры и видео');
});

test('архив ведёт к списку журналов сразу на ранее созданные', async () => {
  const { tree, navigation } = await mount('ru');

  press(tree, 'Архив откачек');

  expect(navigation.navigate).toHaveBeenCalledWith('PumpingMain', { focus: 'archive' });
});

test('в подписи архива видно, сколько журналов сохранено', async () => {
  const { tree } = await mount('ru');

  expect(screenText(tree)).toMatch(/Ранее созданные журналы · 3/);
});

test('версия для Windows на русском ведёт на русский сайт', async () => {
  const { tree } = await mount('ru');

  press(tree, 'Версия для Windows');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/Ru/');
});

test('версия для Windows на английском ведёт на английский сайт', async () => {
  const { tree } = await mount('en');

  press(tree, 'Windows version');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/');
});

test('в английском подзаголовке нет русского сокращения ОФР', async () => {
  const { tree } = await mount('en');

  const text = screenText(tree);
  expect(text).toContain('Input data and analysis');
  expect(text).not.toMatch(/OFR/);
});
