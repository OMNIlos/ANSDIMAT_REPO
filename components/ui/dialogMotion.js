/**
 * Появление модального окна
 *
 * Modal сам проявляет затемнение фона, а окно поверх него возникало целиком,
 * одним кадром. Здесь оно чуть подрастает на место, пока проявляется фон, —
 * видно, откуда оно взялось и что всё остальное сейчас за ним. Общий приём
 * для всех окон приложения, чтобы подтверждение удаления и импорт журнала
 * открывались одинаково.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable } from 'react-native';
import useReduceMotion from '../../hooks/useReduceMotion';

/** Окно, которому можно передать анимированный стиль */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Длительность появления окна, мс */
const ENTER_MS = 240;

/**
 * Стиль появления окна
 *
 * @param {boolean} visible - показано ли окно
 * @returns {Object} анимированный стиль для карточки окна
 */
export function useDialogEntrance(visible) {
  const reduceMotion = useReduceMotion();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      appear.setValue(0);
      return undefined;
    }
    if (reduceMotion) {
      appear.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(appear, {
      toValue: 1,
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [visible, reduceMotion, appear]);

  return {
    transform: [
      { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };
}
