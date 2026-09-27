/**
 * Выход из аккаунта — на экране «Аккаунт», с подтверждением
 *
 * Пункт «Выход» в нижнем меню читался как выход из программы, хотя это выход
 * из аккаунта синхронизации; заказчик попросил оставить его только в
 * «Настройки → Аккаунт». Подтверждение переехало вместе с ним: случайное
 * нажатие не должно останавливать синхронизацию.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockSignOut = jest.fn(async () => {});
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'field@example.com' },
    signOut: mockSignOut,
    changePassword: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));
jest.mock('../../sync/SyncContext', () => ({
  useSync: () => ({
    status: 'done',
    lastSyncedAt: null,
    pending: 0,
    conflicts: [],
    error: null,
    syncNow: jest.fn(),
    resolve: jest.fn(),
  }),
}));
jest.mock('../../billing/EntitlementsContext', () => ({
  useEntitlements: () => ({ entitlements: {}, redeemPromo: jest.fn() }),
}));
// Появление и нажатие — анимации, на проверку переходов они не влияют
jest.mock('../../components/ui/AppearIn', () => ({ children }) => children);
jest.mock('../../components/ui/PressableScale', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return (props) => React.createElement(Pressable, props);
});

const AccountScreen = require('../AccountScreen').default;
const ConfirmDialog = require('../../components/ui/ConfirmDialog').default;

beforeAll(() => {
  I18n.locale = 'ru';
});

let tree;

afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
  mockSignOut.mockClear();
});

// Монтирование — в асинхронном act: значки догружают шрифт и обновляются
// после первой отрисовки
const mount = async () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <AccountScreen navigation={navigation} />
      </PaperProvider>
    );
  });
  return navigation;
};

/** Кнопка «Выход» на экране аккаунта */
const exitButton = () =>
  tree.root.find(
    (node) =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function' &&
      node.findAll((child) => child.props.children === 'Выход').length > 0 &&
      !node.findAll((child) => child.type === ConfirmDialog).length
  );

const signOutDialog = () =>
  tree.root.findAllByType(ConfirmDialog).find((dialog) => dialog.props.title === 'Выйти из аккаунта?');

test('«Выход» сначала спрашивает, а не выходит сразу', async () => {
  await mount();

  act(() => {
    exitButton().props.onPress();
  });

  expect(mockSignOut).not.toHaveBeenCalled();
  expect(signOutDialog().props.visible).toBe(true);
});

test('«Отмена» оставляет в аккаунте', async () => {
  const navigation = await mount();

  act(() => {
    exitButton().props.onPress();
  });
  act(() => {
    signOutDialog().props.onCancel();
  });

  expect(signOutDialog().props.visible).toBe(false);
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(navigation.goBack).not.toHaveBeenCalled();
});

test('после подтверждения — выход и возврат в настройки', async () => {
  const navigation = await mount();

  act(() => {
    exitButton().props.onPress();
  });
  await act(async () => {
    await signOutDialog().props.onConfirm();
  });

  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});
