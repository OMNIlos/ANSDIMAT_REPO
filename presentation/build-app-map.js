/**
 * Minimal presentation app map for ANSDIMAT.
 *
 * The composition follows the supplied reference: neutral pills, thin
 * orthogonal connectors, generous whitespace and a strict screen hierarchy.
 */

const fs = require('fs');
const path = require('path');

const WIDTH = 1920;
const HEIGHT = 1080;
const output = path.join(__dirname, 'ANSDIMAT-app-map.svg');

const palette = {
  background: '#FFFFFF',
  title: '#272425',
  text: '#4B4849',
  muted: '#A5A2A3',
  node: '#F1F1F1',
  line: '#DAD8D9',
};

const nodes = [
  { id: 'launch', x: 72, y: 474, w: 142, h: 46, label: 'Запуск' },
  { id: 'home', x: 292, y: 460, w: 166, h: 74, label: 'Главная' },

  { id: 'pumping', x: 650, y: 206, w: 214, h: 48, label: 'Обработка откачек' },
  { id: 'projects', x: 942, y: 206, w: 180, h: 48, label: 'Проекты ОФР' },
  { id: 'processing', x: 1212, y: 206, w: 194, h: 48, label: 'Журнал проекта' },
  { id: 'ofrType', x: 1532, y: 116, w: 224, h: 44, label: 'Тип ОФР' },
  { id: 'measurements', x: 1532, y: 176, w: 224, h: 44, label: 'Замеры t–s' },
  { id: 'chart', x: 1532, y: 236, w: 224, h: 44, label: 'График и прямая' },
  { id: 'transmissivity', x: 1532, y: 296, w: 224, h: 44, label: 'Результат T' },

  { id: 'calculator', x: 650, y: 426, w: 214, h: 48, label: 'Калькулятор' },
  { id: 'basic', x: 942, y: 376, w: 204, h: 48, label: 'Базовые расчёты' },
  { id: 'advanced', x: 942, y: 526, w: 204, h: 48, label: 'Расширенные расчёты' },
  { id: 'filtration', x: 1238, y: 330, w: 252, h: 44, label: 'Коэффициент фильтрации' },
  { id: 'parameters', x: 1238, y: 386, w: 252, h: 44, label: 'Оценка параметров' },
  { id: 'forecast', x: 1238, y: 442, w: 252, h: 44, label: 'Прогноз понижения' },
  { id: 'pit', x: 1238, y: 500, w: 252, h: 44, label: 'Приток в котлован' },
  { id: 'barrage', x: 1238, y: 556, w: 252, h: 44, label: 'Барраж' },
  { id: 'leakage', x: 1238, y: 612, w: 252, h: 44, label: 'Инфильтрационные утечки' },

  { id: 'diary', x: 650, y: 700, w: 214, h: 48, label: 'Полевой дневник' },
  { id: 'map', x: 942, y: 674, w: 180, h: 44, label: 'Карта' },
  { id: 'points', x: 942, y: 758, w: 180, h: 44, label: 'Точки наблюдения' },
  { id: 'mapPoint', x: 1238, y: 648, w: 226, h: 44, label: 'Точка на карте' },
  { id: 'geolocation', x: 1238, y: 706, w: 226, h: 44, label: 'Геопозиция' },
  { id: 'pointList', x: 1238, y: 774, w: 226, h: 44, label: 'Типы и список точек' },

  { id: 'learning', x: 650, y: 856, w: 214, h: 48, label: 'Обучение' },
  { id: 'videos', x: 942, y: 830, w: 180, h: 44, label: 'Видеоуроки' },
  { id: 'materials', x: 942, y: 888, w: 180, h: 44, label: 'Материалы' },

  { id: 'service', x: 650, y: 978, w: 214, h: 48, label: 'Сервисные разделы' },
  { id: 'settings', x: 942, y: 946, w: 180, h: 44, label: 'Настройки' },
  { id: 'help', x: 942, y: 1010, w: 180, h: 44, label: 'Справка' },
  { id: 'account', x: 1238, y: 924, w: 196, h: 44, label: 'Аккаунт' },
  { id: 'subscription', x: 1238, y: 978, w: 196, h: 44, label: 'Подписка' },
  { id: 'manual', x: 1238, y: 1032, w: 196, h: 44, label: 'Руководство' },
];

const links = [
  ['launch', 'home'],

  ['home', 'pumping', 560],
  ['home', 'calculator', 560],
  ['home', 'diary', 560],
  ['home', 'learning', 560],
  ['home', 'service', 560],

  ['pumping', 'projects'],
  ['projects', 'processing'],
  ['processing', 'ofrType', 1462],
  ['processing', 'measurements', 1462],
  ['processing', 'chart', 1462],
  ['processing', 'transmissivity', 1462],

  ['calculator', 'basic', 900],
  ['calculator', 'advanced', 900],
  ['basic', 'filtration', 1186],
  ['basic', 'parameters', 1186],
  ['basic', 'forecast', 1186],
  ['advanced', 'pit', 1186],
  ['advanced', 'barrage', 1186],
  ['advanced', 'leakage', 1186],

  ['diary', 'map', 900],
  ['diary', 'points', 900],
  ['map', 'mapPoint', 1186],
  ['map', 'geolocation', 1186],
  ['points', 'pointList'],

  ['learning', 'videos', 900],
  ['learning', 'materials', 900],

  ['service', 'settings', 900],
  ['service', 'help', 900],
  ['settings', 'account', 1186],
  ['settings', 'subscription', 1186],
  ['help', 'manual'],
];

const byId = new Map(nodes.map((node) => [node.id, node]));

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function connector([fromId, toId, requestedTrunk]) {
  const from = byId.get(fromId);
  const to = byId.get(toId);
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;

  if (Math.abs(y2 - y1) < 1) {
    return `<path d="M ${x1} ${y1} H ${x2}" class="connector"/>`;
  }

  const trunk = requestedTrunk ?? x1 + Math.max(34, (x2 - x1) * 0.46);
  const direction = Math.sign(y2 - y1);
  const radius = Math.min(14, Math.abs(y2 - y1) / 2, Math.max(6, (x2 - trunk) / 2));

  return `<path d="M ${x1} ${y1}
    H ${trunk - radius}
    Q ${trunk} ${y1} ${trunk} ${y1 + direction * radius}
    V ${y2 - direction * radius}
    Q ${trunk} ${y2} ${trunk + radius} ${y2}
    H ${x2}" class="connector"/>`;
}

function node(nodeData) {
  const fontSize = nodeData.label.length > 24 ? 13.5 : 14.5;
  return `<g>
    <rect x="${nodeData.x}" y="${nodeData.y}" width="${nodeData.w}" height="${nodeData.h}"
      rx="${nodeData.h / 2}" fill="${palette.node}"/>
    <text x="${nodeData.x + nodeData.w / 2}" y="${nodeData.y + nodeData.h / 2 + 5}"
      text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
      font-size="${fontSize}" font-weight="400" fill="${palette.text}">${escapeXml(nodeData.label)}</text>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <title>App map — АНСДИМАТ</title>
  <desc>Минималистичная карта экранов и пользовательских переходов приложения АНСДИМАТ.</desc>
  <defs>
    <marker id="arrow" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 5 2.5 L 0 5 Z" fill="${palette.line}"/>
    </marker>
    <style>
      .connector {
        fill: none;
        stroke: ${palette.line};
        stroke-width: 1.35;
        stroke-linecap: round;
        stroke-linejoin: round;
        marker-end: url(#arrow);
      }
    </style>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${palette.background}"/>

  <g aria-label="Заголовок">
    <text x="72" y="92" font-family="Arial, Helvetica, sans-serif"
      font-size="38" font-weight="400" letter-spacing="-0.7" fill="${palette.title}">App map</text>
    <text x="72" y="132" font-family="Arial, Helvetica, sans-serif"
      font-size="17" font-weight="400" fill="${palette.muted}">
      <tspan x="72" dy="0">Структура ключевых экранов и пользовательских переходов.</tspan>
      <tspan x="72" dy="28">Основной сценарий — от журнала ОФР до графика и результата.</tspan>
    </text>
  </g>

  <g aria-label="Связи">${links.map(connector).join('')}</g>
  <g aria-label="Экраны">${nodes.map(node).join('')}</g>
</svg>
`;

fs.writeFileSync(output, svg);
console.log(output);
