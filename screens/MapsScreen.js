/**
 * Карты гидроизогипс (AnsSurf)
 *
 * Экран — только рама: язык, тема, отступ под плавающим меню и строка о том,
 * чем кончилась выгрузка. Сам построитель живёт в
 * [`components/AnsSurf`](../components/AnsSurf.js) и на устройстве открывается
 * в WebView, а в вебе — в iframe.
 *
 * Карта занимает экран целиком и прокручивается внутри себя, поэтому внешней
 * прокрутки здесь нет: вложенная прокрутка отбирала бы у карты жесты.
 */

import React, { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import AnsSurf from '../components/AnsSurf';
import { spacing, type, MENU_BAR_HEIGHT } from '../theme';

export default function MapsScreen() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  // Через контекст, а не через хук: без провайдера хук падает, и экран
  // нельзя было бы отрисовать в тесте отдельно от приложения
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };

  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);

  const handleSaved = useCallback((result) => {
    setFailed(false);
    if (!result?.saved) {
      setNotice('');
      return;
    }
    // Сколько файлов и какие: выгрузка растра идёт вместе с привязкой и
    // системой координат, и человек должен понимать, что окно «Поделиться»
    // откроется не один раз
    setNotice(
      result.shared
        ? I18n.t('mapsExportShared', { count: result.saved })
        : I18n.t('mapsExportSaved', { count: result.saved })
    );
  }, []);

  const handleError = useCallback((text) => {
    setFailed(true);
    setNotice(text || I18n.t('mapsFailed'));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {notice ? (
        <Text
          style={[
            type.caption,
            styles.notice,
            {
              color: failed ? theme.colors.error : theme.colors.textSecondary,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          {notice}
        </Text>
      ) : null}

      <AnsSurf
        locale={locale}
        dark={!!theme.dark}
        onSaved={handleSaved}
        onError={handleError}
      />

      {/* Плавающее меню перекрывает низ экрана: без этой подложки под ним
          прячется нижний край панели инструментов построителя */}
      <View
        style={{
          height:
            Platform.OS === 'web'
              ? MENU_BAR_HEIGHT + spacing.md
              : Math.max(insets.bottom, 26) + MENU_BAR_HEIGHT,
          backgroundColor: theme.colors.background,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notice: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
