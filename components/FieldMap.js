/**
 * Карта полевого дневника (устройство)
 *
 * Leaflet + OpenStreetMap внутри WebView — тот же движок, что в дизайн-прототипе.
 * В отличие от нативных карт не требует ключей API и работает в Expo Go,
 * без отдельной сборки dev-client.
 *
 * @param {Array} points - точки: { lat, lon, title, color, id, draggable, label }
 * @param {Function} [onMovePoint] - вызывается с (id, lat, lon) после
 *   перетаскивания маркера
 * @param {{color: string, fromId: string}} [connect] - пунктир между точками
 * @param {Array} [polygons] - залитые контуры: { id, points: [[lat, lon]], color,
 *   fill, fillOpacity, title }
 * @param {boolean} [fitPolygons] - подогнать обзор под контуры
 * @param {Function} onPressMap - вызывается с (lat, lon) при тапе по карте
 * @param {{lat: number, lon: number}} [center] - куда центрировать карту
 * @param {number} [height] - высота карты; без неё карта занимает всё место
 * @param {boolean} [flush] - убрать скругления и рамку (полноэкранный режим)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { buildMapHtml } from './leafletMapHtml';
import { pointTypeColors, radius } from '../theme';

export default function FieldMap({
  points = [],
  onPressMap,
  onMovePoint,
  connect,
  polygons,
  fitPolygons = false,
  center,
  height,
  flush = false,
}) {
  const theme = useTheme();
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [html] = useState(() => buildMapHtml());

  /** Отправляет сообщение в карту */
  const post = useCallback((payload) => {
    webRef.current?.postMessage(JSON.stringify(payload));
  }, []);

  // Маркеры перерисовываются при любом изменении набора точек
  useEffect(() => {
    if (!ready) return;
    post({
      type: 'points',
      connect,
      points: points.map((p) => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        title: p.title,
        // Цвет приходит готовым, если он не про тип точки дневника:
        // у скважин куста своя раскраска по роли
        color: p.color ?? pointTypeColors[p.type] ?? pointTypeColors.observation,
        draggable: p.draggable,
        label: p.label,
      })),
    });
  }, [points, connect, ready, post]);

  // Центрирование — например, после определения своего местоположения
  // Контуры приходят отдельным сообщением: маркеры при их смене трогать
  // нельзя, иначе маркер под пальцем пересоздастся и потеряет захват
  useEffect(() => {
    if (!ready || !polygons) return;
    post({ type: 'polygons', polygons, fit: fitPolygons });
  }, [polygons, fitPolygons, ready, post]);

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

  const handleMessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data.type === 'ready') setReady(true);
    if (data.type === 'press') onPressMap?.(data.lat, data.lon);
    if (data.type === 'move') onMovePoint?.(data.id, data.lat, data.lon);
  };

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
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
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
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
