/**
 * Заставка и язык приложения
 *
 * Заставка — единственный экран, который отрисовывается до того, как язык
 * прочитан из хранилища. Все остальные экраны монтируются позже и берут уже
 * готовую локаль, поэтому ошибка подписки видна только здесь.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import I18n from '../../Localization';
import { LanguageProvider } from '../../LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
// Кривая понижения тянет react-native-svg: на проверку подписей она не влияет
jest.mock('../DrawdownCurve', () => 'DrawdownCurve');

const AsyncStorage = require('@react-native-async-storage/async-storage');
const SplashScreen = require('../SplashScreen').default;

beforeEach(() => {
  AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Весь текст заставки одной строкой
 *
 * @param {Object} tree - дерево отрисовки
 * @returns {string} склеенный текст
 */
const screenText = (tree) =>
  tree.root
    .findAll((node) => typeof node.props?.children === 'string', { deep: true })
    .map((node) => node.props.children)
    .join(' ');

/**
 * Монтирует заставку внутри провайдера языка и даёт хранилищу ответить
 *
 * @returns {Promise<Object>} дерево отрисовки
 */
const mount = async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <LanguageProvider>
        <SplashScreen onFinish={() => {}} />
      </LanguageProvider>
    );
  });
  return tree;
};

test('сохранённый английский доезжает до заставки', async () => {
  // Язык телефона русский, а в приложении выбран английский: сохранённый
  // выбор читается из AsyncStorage уже после первого рендера заставки
  await AsyncStorage.setItem('appLocale', 'en');
  I18n.locale = 'ru';

  const tree = await mount();

  expect(screenText(tree)).toContain("hydrogeologist's field calculator");
  expect(screenText(tree)).not.toContain('полевой калькулятор гидрогеолога');
});

test('сохранённый русский доезжает до заставки', async () => {
  await AsyncStorage.setItem('appLocale', 'ru');
  I18n.locale = 'en';

  const tree = await mount();

  expect(screenText(tree)).toContain('полевой калькулятор гидрогеолога');
  expect(screenText(tree)).not.toContain("hydrogeologist's field calculator");
});

test('на заставке видно имя релиза', async () => {
  // Имя релиза — как у версий Android: одно на все языки, переводить его не нужно
  await AsyncStorage.setItem('appLocale', 'en');

  const tree = await mount();

  expect(screenText(tree)).toContain('Moonflower');
});

test('без сохранённого выбора заставка идёт за языком устройства', async () => {
  // Своего выбора пользователь не делал — LanguageProvider берёт системный
  // язык; на заставке он обязан быть тем же, что и на остальных экранах
  I18n.locale = 'ru';

  const tree = await mount();

  const text = screenText(tree);
  const system = I18n.locale;
  expect(text).toContain(
    system === 'ru' ? 'полевой калькулятор гидрогеолога' : "hydrogeologist's field calculator"
  );
});
