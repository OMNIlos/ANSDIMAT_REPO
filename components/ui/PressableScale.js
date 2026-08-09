/**
 * Нажимаемый блок с откликом на касание
 *
 * Вместо мгновенного изменения прозрачности карточка слегка проседает под
 * пальцем и возвращается пружиной. Отклик короткий: это подтверждение
 * нажатия, а не эффект.
 *
 * @param {Function} onPress - обработчик нажатия
 * @param {Object|Array} style - стиль контейнера
 * @param {number} [scale] - до какого масштаба сжимать (по умолчанию 0.97)
 * @param {React.ReactNode} children - содержимое
 */

import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import useReduceMotion from '../../hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Пружина без раскачки: карточка возвращается собранно, а не подпрыгивает */
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

export default function PressableScale({
  onPress,
  onLongPress,
  style,
  scale = 0.97,
  disabled,
  children,
  ...rest
}) {
  const pressed = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scale) }],
    opacity: 1 - pressed.value * 0.12,
  }));

  const setPressed = (value) => {
    if (reduceMotion) {
      pressed.value = 0;
      return;
    }
    pressed.value = value
      ? withTiming(1, { duration: 90 })
      : withSpring(0, SPRING);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
