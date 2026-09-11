/**
 * Построитель карт гидроизогипс AnsSurf (веб)
 *
 * Та же страница, что на устройстве, только вместо WebView — iframe. Metro
 * выбирает этот файл по расширению `.web.js`, поэтому нативный WebView
 * в веб-сборку не попадает.
 *
 * Скрипт-мост здесь не нужен. Страница приезжает с того же адреса, что и само
 * приложение, а значит её окно доступно напрямую: тема ставится записью
 * в общее хранилище до загрузки, переключается вызовом её же функции.
 *
 * Выгрузка не перехватывается. В WebView ссылка `<a download>` не работает,
 * и файлы приходится забирать приложению; в браузере она работает как обычно,
 * и страница отдаёт готовое сама — со всеми файлами-спутниками растра.
 *
 * @param {'ru'|'en'} locale - язык страницы
 * @param {boolean} dark - тёмная тема
 * @param {Function} [onError] - что-то не получилось: (текст)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { anssurfPageUri } from './anssurfAsset';

/** Ключ, которым страница хранит выбранную тему */
const THEME_KEY = 'hydro-theme';

/**
 * Записывает тему в хранилище страницы
 *
 * До загрузки, а не после: самый первый встроенный скрипт страницы читает этот
 * ключ и вешает класс на корень. Поставленная позже тёмная тема успевает
 * моргнуть белым.
 *
 * @param {boolean} dark - тёмная тема
 */
function rememberTheme(dark) {
  try {
    window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    // Приватный режим или запрет на хранилище — страница откроется светлой
  }
}

export default function AnsSurf({ locale, dark, onError }) {
  const theme = useTheme();
  const frameRef = useRef(null);

  // Язык фиксируется на всё время жизни экрана: перезагрузка другой страницы
  // стёрла бы построенную карту
  const [page] = useState(locale === 'en' ? 'en' : 'ru');
  const [uri, setUri] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    rememberTheme(dark);
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
    // dark намеренно вне зависимостей: здесь он нужен ровно один раз, до
    // загрузки. Смену темы на ходу подхватывает эффект ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, onError]);

  // Тема приезжает из настроек и меняется, пока карта открыта
  useEffect(() => {
    if (loading) return;
    rememberTheme(dark);
    const frame = frameRef.current?.contentWindow;
    if (!frame) return;
    try {
      const on = frame.document?.documentElement?.classList?.contains('dark');
      if (!!on !== !!dark) frame.__hydroToggleTheme?.();
    } catch {
      // Окно ещё не готово — тема встанет при следующем открытии
    }
  }, [dark, loading]);

  const onLoad = useCallback(() => setLoading(false), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {uri ? (
        <iframe
          ref={frameRef}
          src={uri}
          onLoad={onLoad}
          title="AnsSurf"
          style={styles.frame}
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
  frame: {
    flex: 1,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
