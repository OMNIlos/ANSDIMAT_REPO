/**
 * Слой диалога на Android
 *
 * На Android диалог рисуется в окне приложения через Portal, а не отдельным
 * окном Modal: прозрачное окно Modal открывалось пустым и невидимым, пока на
 * экране был анимированный вид Reanimated, и перехватывало касания. Здесь
 * проверяется, что окна Modal нет, содержимое на месте, «Назад» закрывает
 * слой, а строка состояния темнеет вместе с экраном.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BackHandler, Modal, Platform, StatusBar, Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { lightTheme, scrimOverHeader } from '../../theme';

// Платформа читается при загрузке слоя — задаётся до того, как он загружен
const originalOS = Platform.OS;
Platform.OS = 'android';
const DialogLayer = require('../ui/DialogLayer').default;

afterAll(() => {
  Platform.OS = originalOS;
});

let tree;
let backHandlers;
let removed;

beforeEach(() => {
  backHandlers = [];
  removed = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
    backHandlers.push(handler);
    return { remove: () => (removed += 1) };
  });
});

afterEach(() => {
  // Слой проявляется анимацией: дерево снимается, чтобы она не пережила тест
  act(() => tree?.unmount());
  tree = null;
  jest.restoreAllMocks();
});

const layer = (visible, onRequestClose) => (
  <PaperProvider theme={lightTheme}>
    <DialogLayer visible={visible} onRequestClose={onRequestClose}>
      <Text>Удалить журнал?</Text>
    </DialogLayer>
  </PaperProvider>
);

const mount = (visible, onRequestClose = jest.fn()) => {
  act(() => {
    tree = renderer.create(layer(visible, onRequestClose));
  });
  return onRequestClose;
};

const shown = () =>
  tree.root.findAll((node) => node.type === Text && node.props.children === 'Удалить журнал?')
    .length > 0;

describe('DialogLayer на Android', () => {
  it('показывает содержимое без окна Modal', () => {
    mount(true);

    expect(shown()).toBe(true);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  });

  it('скрытый слой ничего не рисует и «Назад» не перехватывает', () => {
    mount(false);

    expect(shown()).toBe(false);
    expect(backHandlers).toHaveLength(0);
  });

  it('«Назад» закрывает слой и не уводит с экрана', () => {
    const onRequestClose = mount(true);

    expect(backHandlers).toHaveLength(1);
    expect(backHandlers[0]()).toBe(true);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('после закрытия отпускает «Назад»', () => {
    const onRequestClose = mount(true);
    act(() => tree.update(layer(false, onRequestClose)));

    expect(shown()).toBe(false);
    expect(removed).toBe(1);
  });

  it('красит строку состояния в затемнённый бордовый, пока открыт', () => {
    mount(true);

    const bars = tree.root.findAllByType(StatusBar);
    expect(bars).toHaveLength(1);
    expect(bars[0].props.backgroundColor).toBe(scrimOverHeader);
    // Бордовый шапки #72002F под затемнением rgba(20, 7, 14, 0.45)
    expect(scrimOverHeader).toBe('rgb(72, 3, 32)');
  });
});
