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
 * @returns {Object} дерево отрисовки
 */
function mount(bottom) {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom }}>
          <LanguageContext.Provider value={{ locale: 'ru' }}>
            <MapsScreen />
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
