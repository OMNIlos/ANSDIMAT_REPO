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
 *
 * Уход с экрана переспрашивается, если на карте есть работа. Построитель
 * ничего не хранит: «Назад» — стрелкой или системной кнопкой, которую на
 * Android задевают случайно, — стирал скважины и построенную карту молча.
 * Пустую карту закрывают без вопросов.
 *
 * @param {Object} props
 * @param {Object} [props.navigation] - навигация стека
 */

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import AnsSurf from '../components/AnsSurf';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { setMenuHidden } from '../components/chromeVisibility';
import { spacing, type } from '../theme';

export default function MapsScreen({ navigation }) {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  // Через контекст, а не через хук: без провайдера хук падает, и экран
  // нельзя было бы отрисовать в тесте отдельно от приложения
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };

  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  // Есть ли на карте что терять — приходит от страницы, см. AnsSurf
  const hasWork = useRef(false);
  // Отложенный уход с экрана, пока диалог ждёт ответа
  const [leaveAction, setLeaveAction] = useState(null);

  useEffect(
    () =>
      navigation?.addListener('beforeRemove', (event) => {
        if (!hasWork.current) return;
        event.preventDefault();
        setLeaveAction(event.data.action);
      }),
    [navigation]
  );

  const handleWorkChange = useCallback((has) => {
    hasWork.current = has;
  }, []);

  const confirmLeave = useCallback(() => {
    const action = leaveAction;
    setLeaveAction(null);
    // Спрошено — второй раз тот же уход не останавливаем
    hasWork.current = false;
    if (action) navigation?.dispatch(action);
  }, [leaveAction, navigation]);

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
        onWorkChange={handleWorkChange}
      />

      <ConfirmDialog
        visible={!!leaveAction}
        title={I18n.t('mapsLeaveTitle')}
        message={I18n.t('mapsLeaveMessage')}
        confirmLabel={I18n.t('mapsLeaveConfirm')}
        destructive
        onConfirm={confirmLeave}
        onCancel={() => setLeaveAction(null)}
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
