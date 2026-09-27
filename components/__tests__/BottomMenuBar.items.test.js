/**
 * Пункты нижнего меню
 *
 * «Выход» в меню читался как выход из программы, хотя завершал сессию
 * аккаунта синхронизации. Заказчик попросил убрать его из меню — выход есть в
 * «Настройки → Аккаунт». Проверяется с активной сессией: раньше пункт
 * появлялся именно у вошедших.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import I18n from '../../Localization';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, user: { id: 'u1' }, signOut: jest.fn() }),
}));

const BottomMenuBar = require('../BottomMenuBar').default;

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 760 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

test('в меню три раздела и нет «Выхода» даже у вошедшего', () => {
  I18n.locale = 'ru';
  let tree;
  act(() => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <BottomMenuBar active="home" />
      </SafeAreaProvider>
    );
  });

  // Pressable и его внутренний узел несут одни и те же свойства — считаем
  // каждую подпись один раз
  const labels = [
    ...new Set(
      tree.root
        .findAll((node) => node.props?.accessibilityRole === 'button' && typeof node.props?.onPress === 'function')
        .map((node) => node.props.accessibilityLabel)
    ),
  ];

  expect(labels).toEqual(['Главная', 'Настройки', 'Справка']);
  act(() => tree.unmount());
});
