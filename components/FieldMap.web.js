/**
 * Карта полевого дневника (веб)
 *
 * Тот же документ Leaflet + OpenStreetMap, что и на устройстве, только
 * вместо WebView — iframe. Metro выбирает этот файл по расширению `.web.js`,
 * поэтому нативный WebView в веб-бандл не попадает.
 *
 * @param {Array} points - точки наблюдения
 * @param {Function} onPressMap - вызывается с (lat, lon) при клике по карте
 * @param {{lat: number, lon: number}} [center] - куда центрировать карту
 * @param {number} [height] - высота карты; без неё карта занимает всё место
 * @param {boolean} [flush] - убрать скругления и рамку (полноэкранный режим)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { buildMapHtml } from './leafletMapHtml';
import { pointTypeColors, radius } from '../theme';

export default function FieldMap({ points = [], onPressMap, center, height, flush = false }) {
  const theme = useTheme();
  const frameRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [html] = useState(() => buildMapHtml());

  /** Отправляет сообщение внутрь iframe */
  const post = useCallback((payload) => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
  }, []);

  // Приём сообщений из карты
  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!data || !data.type) return;
      if (data.type === 'ready') setReady(true);
      if (data.type === 'press') onPressMap?.(data.lat, data.lon);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPressMap]);

  useEffect(() => {
    if (!ready) return;
    post({
      type: 'points',
      points: points.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        title: p.title,
        color: pointTypeColors[p.type] ?? pointTypeColors.observation,
      })),
    });
  }, [points, ready, post]);

  useEffect(() => {
    if (!ready || !center) return;
    post({ type: 'center', lat: center.lat, lon: center.lon, zoom: 15 });
  }, [center, ready, post]);

  // Карту развернули или свернули: контейнер сменил размер, и Leaflet надо
  // об этом сообщить — сам он следит только за размером окна
  useEffect(() => {
    if (!ready) return undefined;
    // Кадр задержки: к моменту отправки новая раскладка уже применена
    const timer = setTimeout(() => post({ type: 'resize' }), 50);
    return () => clearTimeout(timer);
  }, [height, flush, ready, post]);

  return (
    <View
      style={[
        styles.wrapper,
        // Без заданной высоты карта растягивается на весь доступный блок —
        // так работает полноэкранный режим
        height ? { height } : styles.fill,
        flush ? styles.flush : { borderColor: theme.colors.border },
      ]}
    >
      {/* На вебе react-native-web рендерит обычный React DOM,
          поэтому iframe можно создать напрямую */}
      {React.createElement('iframe', {
        ref: frameRef,
        srcDoc: html,
        title: 'map',
        style: {
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  // Во весь экран рамка и скругления только мешают
  flush: {
    borderRadius: 0,
    borderWidth: 0,
  },
});
