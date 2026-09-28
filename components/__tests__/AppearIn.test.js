/**
 * Появление блока не застревает на полпути
 *
 * На телефоне заказчика первый блок вкладки «Расчёт понижения» через раз
 * оставался полупрозрачным — серым. Механизм: «уменьшить движение» приходит
 * асинхронно, уже после старта появления; анимация останавливалась, значение
 * ставилось в 1, а нативная сторона следом присылала значение, на котором её
 * остановили, — и следующая отрисовка закрепляла его на виде. Здесь нативная
 * остановка воспроизведена заглушкой: она сообщает «остановлено на 0.35»
 * позже, чем компонент выставил своё значение.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Animated, StyleSheet, Text, View } from 'react-native';

let mockReduceMotion = false;
jest.mock('../../hooks/useReduceMotion', () => () => mockReduceMotion);

const AppearIn = require('../ui/AppearIn').default;

/** Последняя запущенная анимация: её значение и колбэк завершения */
let last;

/**
 * Обновляет свойства видов, привязанных к значению, — как колбэк завершения
 * нативной анимации в Animation.js (__findAnimatedPropsNodes → update)
 *
 * @param {Object} node - узел Animated
 */
const updateBoundProps = (node) => {
  for (const child of node.__getChildren?.() ?? []) {
    if (typeof child.update === 'function') child.update();
    else updateBoundProps(child);
  }
};

beforeEach(() => {
  mockReduceMotion = false;
  last = null;
  jest.spyOn(Animated, 'timing').mockImplementation((value) => {
    const animation = {
      start: (onEnd) => {
        last = { value, onEnd };
      },
      // Как нативный драйвер: значение, на котором остановили, приходит позже
      stop: () => {
        Promise.resolve().then(() => {
          value.__onAnimatedValueUpdateReceived(0.35);
          updateBoundProps(value);
        });
      },
    };
    return animation;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Каждый раз новый элемент: тот же самый объект React перерисовывать не стал
// бы, и хук «уменьшить движение» не перечитался бы
const block = () => (
  <AppearIn index={0}>
    <Text>Расчётная схема</Text>
  </AppearIn>
);

/** Итоговый стиль вида-обёртки */
const wrapperStyle = (tree) => {
  const text = tree.root.findByType(Text);
  let node = text.parent;
  while (node && node.type !== View && typeof node.type !== 'string') node = node.parent;
  return StyleSheet.flatten(node.props.style) || {};
};

test('отыгравшее появление оставляет блок непрозрачным и на месте', () => {
  let tree;
  act(() => {
    tree = renderer.create(block());
  });
  act(() => {
    last.onEnd({ finished: true });
  });

  const style = wrapperStyle(tree);
  expect(style.opacity ?? 1).toBe(1);
  expect(style.transform).toBeUndefined();
  act(() => tree.unmount());
});

test('«уменьшить движение» посреди появления не оставляет блок серым', async () => {
  let tree;
  act(() => {
    tree = renderer.create(block());
  });
  expect(last).not.toBeNull();

  // Ответ системы пришёл, когда появление уже шло
  mockReduceMotion = true;
  act(() => {
    tree.update(block());
  });
  // Нативная сторона сообщает, где остановилась
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(wrapperStyle(tree).opacity ?? 1).toBe(1);
  act(() => tree.unmount());
});
