/**
 * HTML карты на Leaflet + OpenStreetMap
 *
 * Один и тот же документ используется на всех платформах: на устройстве его
 * показывает WebView, в вебе — iframe. Так карта выглядит и ведёт себя
 * одинаково везде и не требует ключей API, как в дизайн-прототипе.
 *
 * Протокол обмена с приложением:
 *   вниз (в карту):  { type: 'points', points: [...] }
 *                    { type: 'center', lat, lon, zoom }
 *   вверх (наружу):  { type: 'press', lat, lon }
 *                    { type: 'ready' }
 */

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
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H"
      crossorigin="anonymous" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #EDE9EA; }
  .ans-pin {
    width: 16px; height: 16px; border-radius: 50%;
    border: 3px solid #fff; box-sizing: border-box;
    box-shadow: 0 2px 6px rgba(20,7,14,.45);
  }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH"
        crossorigin="anonymous"></script>
<script>
  (function () {
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([${center.lat}, ${center.lon}], ${center.zoom});

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var layer = L.layerGroup().addTo(map);

    /** Отправляет сообщение наружу — в WebView или в родительское окно */
    function send(payload) {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
      else if (window.parent !== window) window.parent.postMessage(msg, '*');
    }

    map.on('click', function (e) {
      send({ type: 'press', lat: e.latlng.lat, lon: e.latlng.lng });
    });

    /** Перерисовывает маркеры точек наблюдения */
    function renderPoints(points) {
      layer.clearLayers();
      (points || []).forEach(function (p) {
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
        var icon = L.divIcon({
          className: '',
          html: '<div class="ans-pin" style="background:' + (p.color || '#72002F') + '"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        var marker = L.marker([p.lat, p.lon], { icon: icon }).addTo(layer);
        if (p.title) marker.bindPopup(p.title);
      });
    }

    /** Разбирает входящее сообщение от приложения */
    function handle(raw) {
      var data;
      try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (err) { return; }
      if (!data || !data.type) return;
      if (data.type === 'points') renderPoints(data.points);
      if (data.type === 'center') map.setView([data.lat, data.lon], data.zoom || map.getZoom());
      // Контейнер сменил размер (разворот на весь экран). Leaflet следит
      // только за размером окна, а оно тут не меняется — без этого вызова
      // на новой площади остаётся пустое серое поле
      if (data.type === 'resize') {
        var stayAt = map.getCenter();
        map.invalidateSize();
        map.setView(stayAt, map.getZoom(), { animate: false });
      }
    }

    // WebView шлёт через document, браузер — через window
    document.addEventListener('message', function (e) { handle(e.data); });
    window.addEventListener('message', function (e) { handle(e.data); });

    setTimeout(function () { map.invalidateSize(); send({ type: 'ready' }); }, 60);
    setTimeout(function () { map.invalidateSize(); }, 400);
  })();
</script>
</body>
</html>`;
}
