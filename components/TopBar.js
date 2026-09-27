/**
 * Верхняя панель (топ-бар) — как в дизайн-прототипе
 *
 * Бордовая полоса. На корневых экранах слева — логотип-кардиограмма,
 * на вложенных — стрелка «назад». Дальше — название экрана.
 * Никакого гамбургер-меню: навигация идёт через нижнее меню и стек.
 *
 * Используется как `header` в стек-навигаторе, поэтому получает
 * стандартные пропсы React Navigation.
 *
 * @param {Object} navigation - объект навигации
 * @param {Object} options - опции экрана (title/headerTitle)
 * @param {Object} [back] - присутствует, если есть куда возвращаться
 * @param {Object} route - текущий маршрут
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import CardiogramLogo from './CardiogramLogo';
import { palette, fontFamily } from '../theme';
import I18n from '../Localization';

export default function TopBar({ navigation, options, back, route }) {
  const insets = useSafeAreaInsets();
  const title = options?.headerTitle ?? options?.title ?? route?.name ?? '';
  const canGoBack = !!back;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
      <StatusBar backgroundColor={palette.wine} barStyle="light-content" />
      <View style={styles.row}>
        {canGoBack ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={I18n.t('back')}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back-ios-new" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          // key по маршруту: при переходе на другой корневой экран компонент
          // пересоздаётся и линия вычерчивается заново, как в прототипе
          <CardiogramLogo key={route?.name} width={64} height={21} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {typeof title === 'string' ? title : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: palette.wine,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 30,
  },
  backBtn: {
    marginLeft: -4,
    width: 26,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
});
