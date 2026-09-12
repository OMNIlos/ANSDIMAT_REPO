/**
 * Построитель карт гидроизогипс AnsSurf (устройство)
 *
 * Готовое веб-приложение в WebView: четыре шага — данные, скважины,
 * изогипсы, печать, — интерполяция, изолинии поверх подложки OpenStreetMap
 * и выгрузка в форматы, которые понимает настольный АНСДИМАТ.
 *
 * Переписывать его на React Native незачем и нечем: это два мегабайта
 * собранного кода с триангуляцией, кригингом и геодезией на два десятка
 * систем координат. Зато в нём с самого начала есть хост-обмен — он
 * рассчитан на то, что его во что-то встраивают.
 *
 * Язык берётся один раз при открытии и дальше не меняется: смена языка на
 * ходу означала бы перезагрузку другой страницы, а с ней потерю построенной
 * карты. Переключат язык в настройках — новая карта откроется на новом.
 *
 * @param {'ru'|'en'} locale - язык страницы
 * @param {boolean} dark - тёмная тема
 * @param {number} [menuInset] - высота плавающего меню приложения, px
 * @param {Function} [onSaved] - выгрузка удалась: ({saved, names})
 * @param {Function} [onError] - что-то не получилось: (текст)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { anssurfPageUri } from './anssurfAsset';
import {
  beforeContentScript,
  menuInsetScript,
  parseMessage,
  replyScript,
  themeScript,
} from './anssurfBridge';
import { saveAnsSurfExport } from '../share/anssurfExport';

export default function AnsSurf({ locale, dark, menuInset = 0, onSaved, onError }) {
  const theme = useTheme();
  const webRef = useRef(null);

  // Язык фиксируется на всё время жизни экрана, см. заголовок модуля
  const [page] = useState(locale === 'en' ? 'en' : 'ru');
  const [uri, setUri] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    anssurfPageUri(page)
      .then((address) => {
        if (!cancelled) setUri(address);
      })
      .catch((error) => {
        if (!cancelled) onError?.(error?.message || String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [page, onError]);

  // Тема приезжает из настроек и меняется, пока карта открыта
  useEffect(() => {
    if (loading) return;
    webRef.current?.injectJavaScript(themeScript(dark));
  }, [dark, loading]);

  // Высота меню зависит от системного отступа снизу и приезжает не сразу:
  // на первом рендере safe-area ещё не измерена
  useEffect(() => {
    if (loading) return;
    webRef.current?.injectJavaScript(menuInsetScript(menuInset));
  }, [menuInset, loading]);

  const handleMessage = useCallback(
    async (event) => {
      const data = parseMessage(event?.nativeEvent?.data);
      if (!data) return;

      if (data.type === 'ready') {
        setLoading(false);
        return;
      }

      if (data.type === 'save') {
        try {
          const result = await saveAnsSurfExport(data.name, data.files);
          webRef.current?.injectJavaScript(replyScript(data.id, null));
          onSaved?.(result);
        } catch (error) {
          const text = error?.message || String(error);
          // Ответ странице обязателен и при отказе: без него её кнопка
          // экспорта осталась бы ждать вечно
          webRef.current?.injectJavaScript(replyScript(data.id, text));
          onError?.(text);
        }
      }
    },
    [onSaved, onError]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {uri ? (
        <WebView
          ref={webRef}
          source={{ uri }}
          originWhitelist={['*']}
          // Страница лежит в ассетах и открывается по file://: без доступа
          // к файлам WebView не откроет её вовсе
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          // Тема и выбранная подложка карты живут в localStorage страницы
          domStorageEnabled
          javaScriptEnabled
          // Прогресс интерполяции рисуется анимацией: без этого на Android
          // она замирает, и длинный расчёт выглядит зависшим
          androidLayerType="hardware"
          onMessage={handleMessage}
          injectedJavaScriptBeforeContentLoaded={beforeContentScript({
            dark,
            native: true,
            menuInset,
          })}
          onError={(event) =>
            onError?.(event?.nativeEvent?.description || 'WebView error')
          }
          style={styles.web}
        />
      ) : null}

      {loading ? (
        <View style={[styles.veil, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
