/**
 * Сегментированный переключатель (по дизайн-прототипу)
 *
 * Ряд опций на утопленной дорожке; выбранная — приподнятая «таблетка».
 *
 * Таблетка своя у каждого сегмента и при выборе перетекает прозрачностью,
 * а не едет общей меткой: общей метке нужны измеренные размеры соседей, а
 * onLayout на вебе приходит не всегда — тот же приём, что у вкладок
 * калькулятора. Раньше выбор переключался скачком.
 *
 * Один компонент на все такие переключатели приложения — тема в настройках,
 * вход и регистрация, подбор прямой и диагностика, способ провести прямую.
 * До этого у каждого была своя копия, и в тёмной теме все они показывали
 * выбранный вариант темнее дорожки — провалом, а не выпуклостью.
 *
 * @param {Array<{key: string, label: string}>} options - опции
 * @param {string} value - ключ активной опции
 * @param {Function} onChange - вызывается с ключом выбранной опции
 * @param {string} [activeColor] - цвет текста активной опции
 * @param {boolean} [mono] - моноширинный шрифт подписей
 * @param {'md'|'sm'} [size] - высота: обычная или компактная для панелей графика
 * @param {Object|Array} [style] - стиль дорожки
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import useReduceMotion from '../../hooks/useReduceMotion';
import { fontFamily } from '../../theme';

/** Длительность перетекания выбора, мс */
const SWITCH_MS = 220;

/**
 * Один сегмент дорожки
 *
 * @param {Object} props
 * @returns {React.ReactElement} сегмент
 */
function Segment({ label, active, onPress, activeColor, mono, size }) {
  const { colors, dark } = useTheme();
  const reduceMotion = useReduceMotion();
  // Обычный Animated, а не Reanimated: анимация одна и короткая, а снимки
  // дерева в тестах с ним остаются простыми объектами
  const on = useRef(new Animated.Value(active ? 1 : 0)).current;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const target = active ? 1 : 0;
    if (reduceMotion) {
      on.setValue(target);
      return undefined;
    }
    const animation = Animated.timing(on, {
      toValue: target,
      duration: SWITCH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, on]);

  const fill = {
    opacity: on,
    transform: [{ scale: on.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
  };

  const textColor = active
    ? activeColor || colors.primaryAccent
    : hovered
      ? colors.text
      : colors.textSecondary;

  return (
    <Pressable
      style={[styles.segment, size === 'sm' && styles.segmentSmall]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          size === 'sm' && styles.fillSmall,
          // Тень только в светлой теме: на тёмной её не видно, выпуклость
          // там держат светлая заливка и тонкая кромка
          !dark && styles.fillShadow,
          { backgroundColor: colors.segment, borderColor: colors.segmentBorder },
          fill,
        ]}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          size === 'sm' && styles.labelSmall,
          {
            color: textColor,
            fontFamily: mono
              ? fontFamily.monoSemibold
              : active
                ? fontFamily.bold
                : fontFamily.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function Segmented({
  options,
  value,
  onChange,
  activeColor,
  mono = false,
  size = 'md',
  style,
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.track,
        size === 'sm' && styles.trackSmall,
        { backgroundColor: colors.surfaceSunken },
        style,
      ]}
    >
      {options.map((opt) => (
        <Segment
          key={opt.key}
          label={opt.label}
          active={opt.key === value}
          onPress={() => onChange(opt.key)}
          activeColor={activeColor}
          mono={mono}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 14,
    padding: 4,
  },
  trackSmall: {
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  segmentSmall: {
    paddingVertical: 7,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fillSmall: {
    borderRadius: 9,
  },
  fillShadow: {
    shadowColor: '#14070E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
  labelSmall: {
    fontSize: 12.5,
    lineHeight: 17,
  },
});
