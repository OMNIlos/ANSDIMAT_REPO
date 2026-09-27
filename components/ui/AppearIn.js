/**
 * Появление содержимого при открытии экрана
 *
 * Блоки выходят снизу вверх с небольшой задержкой друг за другом: экран
 * собирается на глазах, а не возникает целиком. Задержка задаётся индексом,
 * поэтому список карточек выстраивается сам.
 *
 * Сдвиг маленький (10 px) и быстрый — приём должен читаться как качество
 * сборки, а не как заставка.
 *
 * @param {number} [index] - порядковый номер блока: задаёт задержку
 * @param {number} [delay] - собственная задержка, мс (перекрывает index)
 * @param {Object|Array} [style] - стиль контейнера
 * @param {React.ReactNode} children - содержимое
 */

import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import useReduceMotion from '../../hooks/useReduceMotion';

/** Шаг задержки между соседними блоками, мс */
const STEP_MS = 55;
/** Дальше этого номера задержку не наращиваем: низ списка ждать не должен */
const MAX_STEPS = 6;

export default function AppearIn({ index = 0, delay, style, children, ...rest }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    const wait = delay ?? Math.min(index, MAX_STEPS) * STEP_MS;
    progress.value = withDelay(
      wait,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })
    );
  }, [index, delay, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 10 * (1 - progress.value) }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
}
