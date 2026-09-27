/**
 * Столбики волны голосовой заметки
 *
 * Один компонент на два случая — живая запись и воспроизведение, — потому что
 * рисуют они одно и то же. Отличается только источник массива уровней и то,
 * какая часть закрашена.
 *
 * Столбики, а не сглаженная кривая: на ширине в палец кривая по сорока точкам
 * превращается в мятую линию, а столбики читаются и на 120 пикселях.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Ниже этой высоты столбик неразличим, и в строке появляется разрыв */
const MIN_BAR_HEIGHT = 2;

/**
 * @param {Object} props
 * @param {number[]} props.levels - уровни 0..1
 * @param {number} [props.progress] - доля пройденного, 0..1
 * @param {string} props.color - цвет пройденной части
 * @param {string} props.mutedColor - цвет непройденной части
 * @param {number} [props.height] - высота самого громкого столбика
 * @param {Object} [props.style] - стиль контейнера
 */
export default function AudioWave({
  levels,
  progress = 1,
  color,
  mutedColor,
  height = 28,
  style,
}) {
  const played = Math.round(levels.length * progress);

  return (
    <View style={[styles.row, { height }, style]}>
      {levels.map((level, index) => (
        <View
          key={index}
          testID="audio-wave-bar"
          style={[
            styles.bar,
            {
              height: Math.max(MIN_BAR_HEIGHT, Math.round(level * height)),
              backgroundColor: index < played ? color : mutedColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 1,
  },
});
