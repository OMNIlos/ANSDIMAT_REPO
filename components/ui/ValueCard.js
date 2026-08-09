/**
 * Карточка рассчитанного значения
 *
 * При каждом пересчёте по краю карточки коротко пробегает подсветка. Это не
 * украшение: параметры пересчитываются на лету, и без отклика непонятно,
 * учлась ли только что введённая цифра.
 *
 * @param {string} label - подпись значения (например «T, м²/сут»)
 * @param {string} value - готовая к показу строка значения
 * @param {boolean} [accent] - выделенная карточка (главный результат)
 * @param {Object|Array} [style] - дополнительный стиль
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import useReduceMotion from '../../hooks/useReduceMotion';
import { spacing, radius, elevation, fontFamily } from '../../theme';

export default function ValueCard({ label, value, accent = false, style }) {
  const { colors } = useTheme();
  const flash = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  const previous = useRef(value);

  useEffect(() => {
    // Первый показ подсвечивать не нужно: пересчёта ещё не было
    if (previous.current === value) return;
    previous.current = value;
    if (reduceMotion) return;
    flash.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 420 })
    );
  }, [value, flash, reduceMotion]);

  const baseBorder = accent ? 'rgba(255,255,255,0.18)' : colors.border;

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      flash.value,
      [0, 1],
      [baseBorder, accent ? '#FFFFFF' : colors.primaryAccent]
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        accent ? elevation.dataButton : null,
        {
          backgroundColor: accent ? colors.secondary : colors.surfaceSunken,
          borderWidth: accent ? 1 : StyleSheet.hairlineWidth,
        },
        animatedStyle,
        style,
      ]}
    >
      <Text
        style={[styles.label, { color: accent ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[styles.value, { color: accent ? '#FFFFFF' : colors.text }]}>{value}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
