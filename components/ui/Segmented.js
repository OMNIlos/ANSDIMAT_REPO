/**
 * Сегментированный переключатель (по дизайн-прототипу)
 *
 * Ряд опций на утопленном фоне; активная опция — приподнятая «таблетка».
 * Плавный сдвиг активного сегмента при выборе.
 *
 * @param {Array<{key: string, label: string}>} options - опции
 * @param {string} value - ключ активной опции
 * @param {Function} onChange - вызывается с ключом выбранной опции
 * @param {string} [activeColor] - цвет текста активной опции
 * @param {boolean} [mono] - моноширинный шрифт подписей
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { fontFamily } from '../../theme';

export default function Segmented({ options, value, onChange, activeColor, mono = false }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceSunken }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.segment,
              active && [styles.segmentActive, { backgroundColor: colors.surface }],
            ]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.label,
                mono && { fontFamily: fontFamily.mono },
                {
                  color: active ? activeColor || colors.primaryAccent : colors.textSecondary,
                  fontWeight: active ? '700' : '600',
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 13,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentActive: {
    shadowColor: '#14070E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
});
