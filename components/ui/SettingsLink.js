/**
 * Ссылка «Открыть настройки» под отказом в доступе
 *
 * Отказ в камере, микрофоне или геопозиции приложение объясняло строкой
 * «Разрешите его в настройках телефона» — и оставляло человека искать эти
 * настройки самому. После второго отказа Android больше не спрашивает
 * разрешения вовсе: вернуть доступ можно только оттуда. Ссылка открывает
 * страницу приложения в системных настройках, где разрешения и включаются.
 *
 * @param {Object} props
 * @param {string} props.color - цвет ссылки
 * @param {Object} [props.style] - дополнительный стиль
 */

import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity } from 'react-native';
import I18n from '../../Localization';
import { fontFamily } from '../../theme';

export default function SettingsLink({ color, style }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openSettings().catch(() => {})}
      accessibilityRole="link"
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={[styles.touch, style]}
    >
      <Text style={[styles.text, { color }]}>{I18n.t('openSettings')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  text: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
});
