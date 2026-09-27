/**
 * Экран карт гидроизогипс
 *
 * Экран — полноэкранный инструмент со своими шагами. Плавающее меню
 * приложения закрывало на нём панель шага и кнопки, поэтому на картах его
 * нет, а при уходе оно обязано вернуться: залипшее скрытие убрало бы меню
 * по всему приложению.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { lightTheme, spacing } from '../../theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../components/AnsSurf', () => 'AnsSurf');
jest.mock('../../components/ui/ConfirmDialog', () => 'ConfirmDialog');

const mockSetMenuHidden = jest.fn();
jest.mock('../../components/chromeVisibility', () => ({
  setMenuHidden: (hidden) => mockSetMenuHidden(hidden),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));

const { LanguageContext } = require('../../LanguageContext');
const MapsScreen = require('../MapsScreen').default;

/**
 * Отрисовывает экран с заданным системным отступом снизу
 *
 * @param {number} bottom - высота системной полосы, px
 * @param {Object} [navigation] - навигация стека
 * @returns {Object} дерево отрисовки
 */
function mount(bottom, navigation) {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom }}>
          <LanguageContext.Provider value={{ locale: 'ru' }}>
            <MapsScreen navigation={navigation} />
          </LanguageContext.Provider>
        </SafeAreaInsetsContext.Provider>
      </PaperProvider>
    );
  });
  return tree;
}

beforeEach(() => {
  mockSetMenuHidden.mockClear();
});

test('на картах плавающее меню спрятано, а при уходе возвращается', () => {
  const tree = mount(34);
  expect(mockSetMenuHidden).toHaveBeenLastCalledWith(true);

  act(() => tree.unmount());

  expect(mockSetMenuHidden).toHaveBeenLastCalledWith(false);
});

test('снизу страница отводит место только под системную полосу', () => {
  const tree = mount(34);

  expect(tree.root.findByType('AnsSurf').props.menuInset).toBe(34);
});

test('без системной полосы остаётся небольшое поле', () => {
  const tree = mount(0);

  expect(tree.root.findByType('AnsSurf').props.menuInset).toBe(spacing.md);
});

/**
 * Навигация стека: помнит подписчиков и отправленные действия
 *
 * @returns {Object} навигация для экрана
 */
function fakeNavigation() {
  const listeners = {};
  return {
    listeners,
    addListener: jest.fn((name, listener) => {
      listeners[name] = listener;
      return () => delete listeners[name];
    }),
    dispatch: jest.fn(),
  };
}

/** Попытка уйти с экрана — стрелкой в шапке или системной кнопкой */
function leave(navigation) {
  const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
  act(() => navigation.listeners.beforeRemove(event));
  return event;
}

const dialog = (tree) => tree.root.findByType('ConfirmDialog');

test('с пустой карты уходят без вопросов', () => {
  const navigation = fakeNavigation();
  const tree = mount(0, navigation);

  const event = leave(navigation);

  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(dialog(tree).props.visible).toBe(false);
});

test('уход с карты, на которой есть работа, переспрашивается', () => {
  // Построитель ничего не хранит: «Назад» стирал скважины и карту молча
  const navigation = fakeNavigation();
  const tree = mount(0, navigation);
  act(() => tree.root.findByType('AnsSurf').props.onWorkChange(true));

  const event = leave(navigation);

  expect(event.preventDefault).toHaveBeenCalled();
  expect(dialog(tree).props.visible).toBe(true);

  act(() => dialog(tree).props.onConfirm());

  expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  expect(dialog(tree).props.visible).toBe(false);
});

test('«Отмена» оставляет на карте', () => {
  const navigation = fakeNavigation();
  const tree = mount(0, navigation);
  act(() => tree.root.findByType('AnsSurf').props.onWorkChange(true));
  leave(navigation);

  act(() => dialog(tree).props.onCancel());

  expect(navigation.dispatch).not.toHaveBeenCalled();
  expect(dialog(tree).props.visible).toBe(false);
});

test('работу убрали — уходят без вопросов', () => {
  const navigation = fakeNavigation();
  const tree = mount(0, navigation);
  act(() => tree.root.findByType('AnsSurf').props.onWorkChange(true));
  act(() => tree.root.findByType('AnsSurf').props.onWorkChange(false));

  expect(leave(navigation).preventDefault).not.toHaveBeenCalled();
});
