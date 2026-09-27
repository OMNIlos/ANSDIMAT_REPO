/**
 * Нижнее меню следует за языком
 *
 * Подписи пунктов читаются из I18n при отрисовке, но само меню при смене языка
 * не перерисовывалось: на экране настроек, где язык и переключают, оно
 * оставалось русским до первого перехода.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import I18n from '../../Localization';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({ session: null, signOut: jest.fn() }),
}));

const { LanguageContext } = require('../../LanguageContext');
const BottomMenuBar = require('../BottomMenuBar').default;

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 760 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

afterEach(() => {
  I18n.locale = 'ru';
});

test('смена языка сразу переводит пункты меню', () => {
  let setLocale;
  // Провайдер со своим состоянием, а меню — один и тот же элемент: при смене
  // языка React перерисует меню только по подписке на язык, а не потому, что
  // перерисовался родитель
  function Harness({ children }) {
    const [locale, set] = React.useState('ru');
    setLocale = set;
    return <LanguageContext.Provider value={{ locale }}>{children}</LanguageContext.Provider>;
  }
  const menu = <BottomMenuBar active="settings" />;
  I18n.locale = 'ru';
  let tree;
  act(() => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Harness>{menu}</Harness>
      </SafeAreaProvider>
    );
  });
  const labels = () =>
    tree.root
      .findAll((node) => node.props?.accessibilityRole === 'button' && node.props?.accessibilityLabel)
      .map((node) => node.props.accessibilityLabel);
  expect(labels()).toContain('Настройки');

  act(() => {
    I18n.locale = 'en';
    setLocale('en');
  });

  expect(labels()).toContain('Settings');
  expect(labels()).not.toContain('Настройки');
  act(() => tree.unmount());
});
