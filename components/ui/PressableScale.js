/**
 * Нажимаемый блок с откликом на касание
 *
 * Вместо мгновенного изменения прозрачности карточка слегка проседает под
 * пальцем и возвращается пружиной. Отклик короткий: это подтверждение
 * нажатия, а не эффект.
 *
 * Под мышью (веб-сборка в браузере) карточка приподнимается на пару пикселей:
 * без этого курсор-«рука» оставался единственным признаком того, что блок
 * нажимается, и интерфейс ощущался мёртвым. На касании наведения не бывает, и
 * там ничего не меняется.
 *
 * Анимация — на Animated из самого React Native, а не на Reanimated: с
 * блоками Reanimated на экране прозрачные окна Modal на Android (новая
 * архитектура, Reanimated 3.17 из Expo SDK 53) открывались пустыми и
 * невидимыми, см. components/ui/AppearIn.js
 *
 * @param {Function} onPress - обработчик нажатия
 * @param {Object|Array} style - стиль контейнера
 * @param {number} [scale] - до какого масштаба сжимать (по умолчанию 0.97)
 * @param {React.ReactNode} children - содержимое
 */

import React, { useRef } from 'react';
import { Animated, Easing, Platform, Pressable } from 'react-native';
import useReduceMotion from '../../hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Пружина без раскачки: карточка возвращается собранно, а не подпрыгивает */
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

/** На сколько пикселей карточка приподнимается под мышью */
const HOVER_LIFT = 2;

/** Нативный драйвер — везде, кроме веба: там его нет */
const NATIVE = Platform.OS !== 'web';

export default function PressableScale({
  onPress,
  onLongPress,
  style,
  scale = 0.97,
  disabled,
  children,
  ...rest
}) {
  const pressed = useRef(new Animated.Value(0)).current;
  const hovered = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  const animatedStyle = {
    transform: [
      { translateY: hovered.interpolate({ inputRange: [0, 1], outputRange: [0, -HOVER_LIFT] }) },
      { scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) },
    ],
    opacity: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }),
  };

  const setHovered = (value) => {
    if (reduceMotion || disabled) {
      hovered.setValue(0);
      return;
    }
    Animated.timing(hovered, {
      toValue: value ? 1 : 0,
      duration: value ? 160 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start();
  };

  const setPressed = (value) => {
    if (reduceMotion) {
      pressed.setValue(0);
      return;
    }
    const animation = value
      ? Animated.timing(pressed, { toValue: 1, duration: 90, useNativeDriver: NATIVE })
      : Animated.spring(pressed, { toValue: 0, ...SPRING, useNativeDriver: NATIVE });
    animation.start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={disabled}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
