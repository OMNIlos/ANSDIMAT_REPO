/**
 * Карты гидроизогипс (AnsSurf)
 *
 * Экран — только рама: язык, тема, отступ снизу и строка о том, чем кончилась
 * выгрузка. Сам построитель живёт в
 * [`components/AnsSurf`](../components/AnsSurf.js) и на устройстве открывается
 * в WebView, а в вебе — в iframe.
 *
 * Карта занимает экран целиком и прокручивается внутри себя, поэтому внешней
 * прокрутки здесь нет: вложенная прокрутка отбирала бы у карты жесты.
 *
 * Плавающего меню на этом экране нет. Построитель — полноэкранный инструмент
 * со своими шагами, а меню висело поверх панели шага, закрывало её кнопки и
 * отнимало девяносто пикселей высоты у и без того тесного телефона. Назад на
 * главную — стрелкой в шапке.
 */

import React, { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import AnsSurf from '../components/AnsSurf';
import { setMenuHidden } from '../components/chromeVisibility';
import { spacing, type } from '../theme';

export default function MapsScreen() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  // Через контекст, а не через хук: без провайдера хук падает, и экран
  // нельзя было бы отрисовать в тесте отдельно от приложения
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };

  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);

  // Меню прячется на время показа экрана и возвращается при уходе — иначе
  // скрытие залипло бы на всё приложение
  useFocusEffect(
    useCallback(() => {
      setMenuHidden(true);
      return () => setMenuHidden(false);
    }, [])
  );

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

      {/* Приложение рисуется от края до края: снизу под страницей лежит
          системная полоса навигации. Место под неё отводит сама страница,
          а не подложка снаружи — подложка обрезала бы карту полосой фона */}
      <AnsSurf
        locale={locale}
        dark={!!theme.dark}
        menuInset={Platform.OS === 'web' ? spacing.md : Math.max(insets.bottom, spacing.md)}
        onSaved={handleSaved}
        onError={handleError}
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
