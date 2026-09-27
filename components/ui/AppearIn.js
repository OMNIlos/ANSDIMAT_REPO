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
 * Анимация — на Animated из самого React Native, а не на Reanimated. Экран,
 * собранный из блоков Reanimated, ломал на Android (новая архитектура,
 * Reanimated 3.17 из Expo SDK 53) прозрачные окна Modal: диалог «Удалить
 * журнал?» открывался пустым и невидимым и перехватывал касания, пока его
 * не закрывали кнопкой «Назад». Без Reanimated в этих блоках окно
 * рисуется как положено. Диалоги с тех пор обходятся без окна Modal (см.
 * DialogLayer), но шторка точки в полевом дневнике — по-прежнему окно Modal.
 *
 * @param {number} [index] - порядковый номер блока: задаёт задержку
 * @param {number} [delay] - собственная задержка, мс (перекрывает index)
 * @param {Object|Array} [style] - стиль контейнера
 * @param {React.ReactNode} children - содержимое
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import useReduceMotion from '../../hooks/useReduceMotion';

/** Шаг задержки между соседними блоками, мс */
const STEP_MS = 55;
/** Дальше этого номера задержку не наращиваем: низ списка ждать не должен */
const MAX_STEPS = 6;
/** Длительность самого появления, мс */
const DURATION_MS = 320;

const EASE_OUT = Easing.out(Easing.cubic);

export default function AppearIn({ index = 0, delay, style, children, ...rest }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return undefined;
    }
    // Задержка — начальный участок кривой, а не параметр delay: тот ждёт на
    // таймере JS, и пока JS занят сборкой экрана, ступенька между блоками
    // плыла бы. Кадры с нативным драйвером считаются заранее и идут в потоке
    // интерфейса, как шли у withDelay в Reanimated. Висящий таймер к тому же
    // срабатывал после конца теста, если дерево не размонтировали
    const wait = delay ?? Math.min(index, MAX_STEPS) * STEP_MS;
    const total = wait + DURATION_MS;
    const hold = wait / total;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: total,
      easing: hold > 0 ? (t) => (t <= hold ? 0 : EASE_OUT((t - hold) / (1 - hold))) : EASE_OUT,
      // На вебе нативного драйвера нет — там анимирует сам браузерный слой
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [index, delay, progress, reduceMotion]);

  const animatedStyle = {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
}
