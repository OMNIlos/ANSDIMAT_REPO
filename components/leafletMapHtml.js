/**
 * HTML карты на Leaflet + OpenStreetMap
 *
 * Один и тот же документ используется на всех платформах: на устройстве его
 * показывает WebView, в вебе — iframe. Так карта выглядит и ведёт себя
 * одинаково везде и не требует ключей API, как в дизайн-прототипе.
 *
 * Протокол обмена с приложением:
 *   вниз (в карту):  { type: 'points', points: [...], connect: {...} }
*                    { type: 'polygons', polygons: [...], fit: true }
 *                    { type: 'center', lat, lon, zoom }
 *                    { type: 'resize' }
 *   вверх (наружу):  { type: 'press', lat, lon }
 *                    { type: 'move', id, lat, lon }
 *                    { type: 'ready' }
 *
 * Точка: { id, lat, lon, title, color, draggable, label }. `draggable`
 * разрешает таскать маркер — так расставляют скважины куста; `label`
 * показывает подпись постоянно, а не по нажатию.
 *
 * `connect` рисует пунктир между точками: { color, fromId }. С `fromId`
 * получается звезда — лучи от одной точки ко всем остальным, что и отвечает
 * расстояниям «до опытной скважины». Без него точки соединяются цепочкой.
 *
 * Leaflet встроен в документ, а не подключается с CDN: в поле без сети
 * ссылка на unpkg.com оставляла вместо карты серый прямоугольник. Теперь без
 * сети пропадает только подложка OpenStreetMap — точки, перетаскивание и
 * постановка нажатием работают. Файлы — tools/vendor-leaflet.js.
 */

import { LEAFLET_CSS, LEAFLET_JS } from './leafletAssets';

/** Центр по умолчанию — Санкт-Петербург, родина АНСДИМАТ */
export const DEFAULT_CENTER = { lat: 59.9386, lon: 30.3141, zoom: 13 };

/**
 * Собирает HTML карты
 *
 * @param {Object} [options]
 * @param {{lat: number, lon: number, zoom: number}} [options.center] - стартовый вид
 * @returns {string} HTML-документ
 */
export function buildMapHtml({ center = DEFAULT_CENTER } = {}) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${LEAFLET_CSS}</style>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #EDE9EA; }
  .ans-pin {
    width: 16px; height: 16px; border-radius: 50%;
    border: 3px solid #fff; box-sizing: border-box;
    box-shadow: 0 2px 6px rgba(20,7,14,.45);
  }
  .leaflet-control-attribution { font-size: 9px; }
  /* Leaflet 1.9 подмешивает в подпись карты флаг Украины. Подпись
     остаётся (её требует лицензия OSM), эмблема — нет: приложение
     нейтрально. Флаг убран и из разметки, и стилем — на случай, если
     встроенный Leaflet обновят до сборки с другой подписью */
  .leaflet-attribution-flag { display: none !important; }
  /* Подпись скважины: читается на карте без нажатия и не ловит касания,
     иначе она перехватывала бы перетаскивание маркера */
  .ans-label {
    background: rgba(20,7,14,.78); border: none; box-shadow: none;
    color: #fff; font: 600 11px/1.2 -apple-system, system-ui, sans-serif;
    padding: 2px 6px; border-radius: 6px; pointer-events: none;
  }
  .ans-label::before { display: none; }
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
  (function () {
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([${center.lat}, ${center.lon}], ${center.zoom});

    // Подпись без флага: ссылка на Leaflet сохраняется, картинка выкидывается
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>'
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Контуры лежат ниже всего: по ним ходят маркеры, и заливка пояса не
    // должна перехватывать нажатие на точку
    var areaLayer = L.layerGroup().addTo(map);
    var layer = L.layerGroup().addTo(map);
    // Связки лежат отдельным слоем: их приходится перерисовывать на каждом
    // кадре перетаскивания, а маркеры при этом трогать нельзя — маркер,
    // пересозданный под пальцем, теряет захват
    var lineLayer = L.layerGroup().addTo(map);
    var placed = [];
    var connectWith = null;

    /** Отправляет сообщение наружу — в WebView или в родительское окно */
    function send(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      else if (window.parent !== window) window.parent.postMessage(msg, '*');
    }

    map.on('click', function (e) {
      send({ type: 'press', lat: e.latlng.lat, lon: e.latlng.lng });
    });

    /** Есть ли у карты площадь */
    function hasSize() {
      var size = map.getSize();
      return size.x > 0 && size.y > 0;
    }

    // Подгонка под контуры, отложенная до появления площади. Окно развёрнутой
    // карты размечается позже, чем грузится страница, а fitBounds в
    // контейнере нулевого размера уводит карту на предельный масштаб — вместо
    // поясов на весь экран оказывался чей-то огород
    var pendingFit = null;
    function fitTo(bounds) {
      if (!hasSize()) {
        pendingFit = bounds;
        return;
      }
      pendingFit = null;
      map.fitBounds(bounds, { padding: [18, 18], animate: false });
    }
    map.on('resize', function () {
      if (pendingFit && hasSize()) fitTo(pendingFit);
    });

    /**
     * Перерисовывает залитые контуры — например, пояса зоны санитарной охраны
     *
     * Флаг fit подгоняет обзор под контуры: пояса тянутся на сотни метров, и
     * без подгонки карта осталась бы на прежнем масштабе, где виден только
     * один из трёх
     */
    function renderPolygons(polygons, fit) {
      areaLayer.clearLayers();
      var bounds = null;

      (polygons || []).forEach(function (poly) {
        if (!poly || !poly.points || poly.points.length < 3) return;
        var shape = L.polygon(poly.points, {
          color: poly.color || '#72002F',
          weight: poly.weight || 1.5,
          opacity: 0.95,
          fillColor: poly.fill || poly.color || '#72002F',
          fillOpacity: typeof poly.fillOpacity === 'number' ? poly.fillOpacity : 0.18,
          interactive: !!poly.title
        }).addTo(areaLayer);
        if (poly.title) shape.bindTooltip(poly.title, { sticky: true });
        bounds = bounds ? bounds.extend(shape.getBounds()) : shape.getBounds();
      });

      if (fit && bounds && bounds.isValid()) fitTo(bounds);
    }

    /** Перерисовывает пунктир между точками по текущему положению маркеров */
    function renderLines() {
      lineLayer.clearLayers();
      if (!connectWith || placed.length < 2) return;

      var style = {
        color: connectWith.color || '#8A0A3D',
        weight: 2, dashArray: '6 6', opacity: 0.9
      };

      if (connectWith.fromId) {
        var hub = null;
        placed.forEach(function (m) { if (m.id === connectWith.fromId) hub = m; });
        if (!hub) return;
        placed.forEach(function (m) {
          if (m.id === connectWith.fromId) return;
          L.polyline([hub.marker.getLatLng(), m.marker.getLatLng()], style).addTo(lineLayer);
        });
        return;
      }

      L.polyline(placed.map(function (m) { return m.marker.getLatLng(); }), style).addTo(lineLayer);
    }

    /** Перерисовывает маркеры точек наблюдения */
    function renderPoints(points, connect) {
      layer.clearLayers();
      placed = [];
      connectWith = connect || null;

      (points || []).forEach(function (p) {
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
        var icon = L.divIcon({
          className: '',
          html: '<div class="ans-pin" style="background:' + (p.color || '#72002F') + '"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        var marker = L.marker([p.lat, p.lon], {
          icon: icon,
          draggable: !!p.draggable,
          autoPan: !!p.draggable
        }).addTo(layer);

        if (p.title) {
          if (p.label) {
            marker.bindTooltip(p.title, {
              permanent: true, direction: 'top', offset: [0, -10], className: 'ans-label'
            });
          } else {
            marker.bindPopup(p.title);
          }
        }

        if (p.draggable) {
          // Пунктир тянется за маркером на каждом кадре, наружу же уходит
          // только конечное положение: слать каждый кадр в базу незачем
          marker.on('drag', renderLines);
          marker.on('dragend', function () {
            var ll = marker.getLatLng();
            renderLines();
            send({ type: 'move', id: p.id, lat: ll.lat, lon: ll.lng });
          });
        }

        placed.push({ id: p.id, marker: marker });
      });

      renderLines();
    }

    /** Разбирает входящее сообщение от приложения */
    function handle(raw) {
      var data;
      try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (err) { return; }
      if (!data || !data.type) return;
      if (data.type === 'points') renderPoints(data.points, data.connect);
      if (data.type === 'polygons') renderPolygons(data.polygons, data.fit);
      if (data.type === 'center') map.setView([data.lat, data.lon], data.zoom || map.getZoom());
      // Контейнер сменил размер (разворот на весь экран). Leaflet следит
      // только за размером окна, а оно тут не меняется — без этого вызова
      // на новой площади остаётся пустое серое поле
      if (data.type === 'resize') {
        var stayAt = map.getCenter();
        map.invalidateSize();
        if (pendingFit && hasSize()) fitTo(pendingFit);
        else map.setView(stayAt, map.getZoom(), { animate: false });
      }
    }

    // WebView шлёт через document, браузер — через window
    document.addEventListener('message', function (e) { handle(e.data); });
    window.addEventListener('message', function (e) { handle(e.data); });

    // «Готово» — когда у карты появилась площадь. Встроенный Leaflet
    // поднимается сразу при загрузке страницы, раньше разметки окна, и
    // точки, пришедшие в карту нулевого размера, вставали мимо. Ждём не
    // дольше двух секунд: карте без площади всё равно нечего показать
    var announceTries = 0;
    function announce() {
      map.invalidateSize();
      if (hasSize() || announceTries++ >= 40) {
        send({ type: 'ready' });
        return;
      }
      setTimeout(announce, 50);
    }
    setTimeout(announce, 60);
    setTimeout(function () { map.invalidateSize(); }, 400);
  })();
</script>
</body>
</html>`;
}
