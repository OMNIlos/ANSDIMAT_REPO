/**
 * Генератор презентационных SVG для Figma
 *
 * Figma импортирует SVG со слоями: <text> остаётся редактируемым текстом,
 * <rect> — фигурой, <g id> — группой. Поэтому презентация собирается в SVG,
 * а не в PDF или HTML: заказчик получает картинку, дизайнер — исходник.
 *
 * Скриншоты экранов встраиваются как data URI, иначе Figma не найдёт файлы
 * при перетаскивании SVG в холст.
 *
 * Запуск: node presentation/build.js
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SCREENS = path.join(DIR, 'screens');

/** Палитра приложения — единственный источник цветов для обоих файлов */
const PALETTE = [
  { name: 'Wine', hex: '#72002F', role: 'Бренд, шапки, основные кнопки' },
  { name: 'Wine Deep', hex: '#4A001F', role: 'Нажатые состояния, край градиента' },
  { name: 'Wine Soft', hex: '#A8446A', role: 'Акценты на тёмном фоне' },
  { name: 'Abyss', hex: '#031888', role: 'Расчёты, графики, числовые результаты' },
  { name: 'Ink', hex: '#1A0710', role: 'Основной текст' },
  { name: 'Slate', hex: '#6B6169', role: 'Второстепенный текст' },
  { name: 'Hairline', hex: '#E8E4E6', role: 'Границы карточек, разделители' },
  { name: 'Paper', hex: '#FBFAFA', role: 'Фон экрана' },
  { name: 'Surface', hex: '#FFFFFF', role: 'Карточки поверх фона' },
  { name: 'Gold', hex: '#E0A83C', role: 'Избранное, точки наблюдения' },
  { name: 'Teal', hex: '#2E9B8F', role: 'Успех, родники' },
  { name: 'Danger', hex: '#B3261E', role: 'Удаление, ошибки' },
];

/** Цвета маркеров полевого дневника — заданы отдельно от палитры интерфейса */
const POINT_COLORS = [
  { name: 'Скважина', hex: '#031888' },
  { name: 'Родник', hex: '#2E9B8F' },
  { name: 'Шурф', hex: '#72002F' },
  { name: 'Наблюдение', hex: '#E0A83C' },
];

const TYPE_SCALE = [
  { name: 'Display', size: 28, weight: 700, tracking: '-0.5', sample: 'Заполнить и обработать ОФР' },
  { name: 'Title', size: 20, weight: 700, tracking: '-0.3', sample: 'Обработка одиночной откачки' },
  { name: 'Card title', size: 17, weight: 600, tracking: '-0.2', sample: 'Скв. 12 — кустовая откачка' },
  { name: 'Body', size: 15, weight: 400, tracking: '0', sample: 'Водопроводимость пласта T, м²/сут' },
  { name: 'Caption', size: 13, weight: 400, tracking: '0', sample: 'Время от начала откачки, мин' },
  { name: 'Eyebrow', size: 11, weight: 700, tracking: '1.2', sample: 'ЖУРНАЛ ЗАМЕРОВ' },
  { name: 'Numeric', size: 15, weight: 500, tracking: '0', sample: '158.13   0.9986   59.9412', mono: true },
];

/** Экраны в порядке показа: файл, название, что демонстрирует */
const SCREEN_LIST = [
  ['01-home.png', 'Главная', 'Основной сценарий и разделы'],
  ['02-projects.png', 'Журналы ОФР', 'Создание и список опытов'],
  ['03-journal.png', 'Журнал замеров', 'Дебит и таблица «время — понижение»'],
  ['04-chart.png', 'График понижения', 'Купер — Джейкоб, T и наклон прямой'],
  ['15-recovery.png', 'Восстановление уровня', 'Метод Тейса по s′ — lg(t/t′)'],
  ['05-calculator.png', 'Калькулятор', 'Перевод коэффициента фильтрации'],
  ['06-barrage.png', 'Барраж', 'Границы пласта методом отображений'],
  ['07-leakage.png', 'Инфильтрационные утечки', 'Пласт с перетеканием по Хантушу'],
  ['08-diary.png', 'Полевой дневник', 'Точки наблюдения на карте OSM'],
  ['09-videos.png', 'Примеры и видео', 'Каталог обучающих материалов'],
  ['11-manual.png', 'Руководство', 'Методика и обозначения'],
  ['10-about.png', 'Справка', 'О приложении и контакты'],
  ['12-settings.png', 'Настройки', 'Тема, язык, аккаунт, подписка'],
  ['13-subscription.png', 'Подписка', 'Тарифы и премиум-функции'],
  ['14-auth.png', 'Аккаунт', 'Вход и синхронизация'],
];

/** Пропорция скриншота: 390 × 844 CSS-пикселя */
const RATIO = 844 / 390;

/**
 * Пропорция мокапа целиком: к скриншоту сверху добавляется статус-бар,
 * а по краям — грань корпуса. Нужна для раскладки блоков.
 */
const MOCK_RATIO = 0.125 + RATIO;

/** Насколько мокап выступает за ширину экрана: грань плюс боковые кнопки */
const MOCK_BLEED = 0.04;

/**
 * Экранирует текст для XML
 *
 * @param {string} s - исходная строка
 * @returns {string} строка, безопасная для вставки в SVG
 */
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Встраивает картинку как data URI
 *
 * Берёт ужатую версию из `screens/opt`, если она собрана: исходники сняты
 * в 3× ради качества, но в SVG такой вес не нужен. Если оптимизации нет,
 * подставляется оригинал, и файл просто получается тяжелее.
 *
 * @param {string} file - имя файла в папке screens
 * @returns {string} значение для атрибута href
 */
function embed(file) {
  const optimized = path.join(SCREENS, 'opt', file.replace(/\.png$/, '.jpg'));
  if (fs.existsSync(optimized)) {
    return 'data:image/jpeg;base64,' + fs.readFileSync(optimized).toString('base64');
  }
  return 'data:image/png;base64,' + fs.readFileSync(path.join(SCREENS, file)).toString('base64');
}

/**
 * Текстовый слой
 *
 * @param {Object} o - параметры текста
 * @returns {string} разметка <text>
 */
function text({ x, y, s, size = 16, weight = 400, fill = '#1A0710', family, tracking = 0, anchor = 'start', opacity = 1 }) {
  const ff = family || "Manrope, Inter, 'Helvetica Neue', Arial, sans-serif";
  return `<text x="${x}" y="${y}" font-family="${ff}" font-size="${size}" font-weight="${weight}" fill="${fill}" letter-spacing="${tracking}" text-anchor="${anchor}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${esc(s)}</text>`;
}

/** Моноширинный текст — для служебных подписей и чисел */
function mono(o) {
  return text({ ...o, family: "'JetBrains Mono', 'SF Mono', Menlo, monospace" });
}

/**
 * Разбивает абзац на строки по ширине и возвращает набор <text>
 *
 * @param {Object} o - параметры абзаца
 * @returns {string} разметка строк
 */
function paragraph({ x, y, s, size = 16, weight = 400, fill = '#1A0710', lineHeight = 1.5, maxChars = 70 }) {
  const words = String(s).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      lines.push(line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines
    .map((l, i) => text({ x, y: y + i * size * lineHeight, s: l, size, weight, fill }))
    .join('\n    ');
}

/**
 * Контур со скруглением в стиле iOS («squircle»)
 *
 * У Apple углы непрерывные: кривизна нарастает плавно, а не включается
 * скачком, как у обычного rx в SVG. Разницу видно сразу — прямоугольник
 * с rx читается как «нарисованный в редакторе», а не как корпус телефона.
 *
 * Каждый угол строится тремя сегментами: кубическая кривая на входе,
 * короткая дуга в вершине и симметричная кривая на выходе. Формулы —
 * стандартная аппроксимация непрерывного скругления.
 *
 * @param {number} x - левый край
 * @param {number} y - верхний край
 * @param {number} w - ширина
 * @param {number} h - высота
 * @param {number} r - радиус угла
 * @param {number} [smoothing] - доля сглаживания, 0 — обычное скругление
 * @returns {string} значение атрибута d
 */
function squircle(x, y, w, h, r, smoothing = 0.6) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const maxR = Math.min(w, h) / 2;
  const radius = Math.min(r, maxR);
  const p = Math.min((1 + smoothing) * radius, maxR);

  let angleAlpha;
  let angleBeta;
  if (radius <= maxR / 2) {
    angleBeta = 90 * (1 - smoothing);
    angleAlpha = 45 * smoothing;
  } else {
    // У очень больших радиусов сглаживать уже нечего: угол вырождается в дугу
    const ratio = (radius - maxR / 2) / (maxR / 2);
    angleBeta = 90 * (1 - smoothing * (1 - ratio));
    angleAlpha = 45 * smoothing * (1 - ratio);
  }

  const theta = (90 - angleBeta) / 2;
  const p3p4 = radius * Math.tan(rad(theta / 2));
  const arc = Math.sin(rad(angleBeta / 2)) * radius * Math.SQRT2;
  const c = p3p4 * Math.cos(rad(angleAlpha));
  const d = c * Math.tan(rad(angleAlpha));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;

  const n = (v) => Number(v.toFixed(3));

  return [
    `M${n(x + p)},${n(y)}`,
    `L${n(x + w - p)},${n(y)}`,
    `c${n(a)},0 ${n(a + b)},0 ${n(a + b + c)},${n(d)}`,
    `a${n(radius)},${n(radius)} 0 0 1 ${n(arc)},${n(arc)}`,
    `c${n(d)},${n(c)} ${n(d)},${n(b + c)} ${n(d)},${n(a + b + c)}`,
    `L${n(x + w)},${n(y + h - p)}`,
    `c0,${n(a)} 0,${n(a + b)} ${n(-d)},${n(a + b + c)}`,
    `a${n(radius)},${n(radius)} 0 0 1 ${n(-arc)},${n(arc)}`,
    `c${n(-c)},${n(d)} ${n(-(b + c))},${n(d)} ${n(-(a + b + c))},${n(d)}`,
    `L${n(x + p)},${n(y + h)}`,
    `c${n(-a)},0 ${n(-(a + b))},0 ${n(-(a + b + c))},${n(-d)}`,
    `a${n(radius)},${n(radius)} 0 0 1 ${n(-arc)},${n(-arc)}`,
    `c${n(-d)},${n(-c)} ${n(-d)},${n(-(b + c))} ${n(-d)},${n(-(a + b + c))}`,
    `L${n(x)},${n(y + p)}`,
    `c0,${n(-a)} 0,${n(-(a + b))} ${n(d)},${n(-(a + b + c))}`,
    `a${n(radius)},${n(radius)} 0 0 1 ${n(arc)},${n(-arc)}`,
    `c${n(c)},${n(-d)} ${n(b + c)},${n(-d)} ${n(a + b + c)},${n(-d)}`,
    'Z',
  ].join(' ');
}

/**
 * Цвет и светлота верхней полосы каждого скриншота
 *
 * Статус-бар в мокапе продолжает шапку приложения, поэтому его цвет должен
 * совпадать с самим кадром: на экранах с шапкой это бордовый, на прокрученных —
 * фон страницы. Значения снимает `optimize.js` прямо с готовых снимков —
 * ручная таблица разъезжалась при каждой пересъёмке.
 */
const TOPS_FILE = path.join(SCREENS, 'opt', 'top-colors.json');
const SCREEN_TOP = fs.existsSync(TOPS_FILE)
  ? Object.fromEntries(
      Object.entries(JSON.parse(fs.readFileSync(TOPS_FILE, 'utf8')))
        .map(([file, v]) => [file, [v.hex, v.dark]])
    )
  : {};

/**
 * Рисует содержимое статус-бара: часы и индикаторы
 *
 * Геометрия задана долями ширины экрана, поэтому мокап масштабируется
 * без пересчёта координат.
 *
 * @param {Object} o - геометрия экрана и цвет иконок
 * @returns {string} разметка статус-бара
 */
function statusBar({ x, y, w, h, tint }) {
  // Доли взяты из реального статус-бара iOS при ширине экрана 390 pt:
  // отступы 26/27 pt, иконки 17×11, 17×12 и 27×13, зазор 8 pt.
  // Считать «на глаз» нельзя — именно из-за этого иконки наезжали.
  const right = x + w * 0.933;
  const cy = y + h * 0.56;

  const gap = w * 0.0205;
  const battW = w * 0.0692;
  const battH = w * 0.0333;
  const iconW = w * 0.0436;

  const battX = right - battW;
  const wifiX = battX - gap - iconW;
  const sigX = wifiX - gap - iconW;

  // Сеть: четыре растущих столбика
  const bars = [0, 1, 2, 3].map((i) => {
    const bw = iconW * 0.185;
    const step = (iconW - bw) / 3;
    const bh = w * 0.0128 + i * w * 0.0051;
    return `<rect x="${sigX + i * step}" y="${cy + w * 0.0141 - bh}" width="${bw}" height="${bh}" rx="${bw * 0.35}" fill="${tint}"/>`;
  }).join('');

  // Wi-Fi: две дуги по 110° и точка. Полуокружности здесь читались бы
  // как незамкнутые кольца — у настоящей иконки дуги заметно короче
  const wifiCx = wifiX + iconW / 2;
  const wifiCy = cy + w * 0.0141;
  const SIN55 = 0.8192;
  const COS55 = 0.5736;
  const arc = (rad, sw) => {
    const dx = rad * SIN55;
    const dy = rad * COS55;
    return `<path d="M${wifiCx - dx},${wifiCy - dy} A${rad},${rad} 0 0 1 ${wifiCx + dx},${wifiCy - dy}" fill="none" stroke="${tint}" stroke-width="${sw}" stroke-linecap="round"/>`;
  };

  return `    ${text({ x: x + w * 0.069, y: cy + w * 0.016, s: '9:41', size: w * 0.0436, weight: 600, fill: tint })}
    ${bars}
    ${arc(iconW * 0.52, w * 0.0056)}${arc(iconW * 0.29, w * 0.0056)}
    <circle cx="${wifiCx}" cy="${wifiCy}" r="${w * 0.0042}" fill="${tint}"/>
    <rect x="${battX}" y="${cy - battH / 2 + w * 0.001}" width="${battW - w * 0.006}" height="${battH}" rx="${battH * 0.36}" fill="none" stroke="${tint}" stroke-width="${w * 0.0033}" opacity="0.45"/>
    <rect x="${battX + w * 0.0036}" y="${cy - battH / 2 + w * 0.0046}" width="${battW - w * 0.0132}" height="${battH - w * 0.0072}" rx="${(battH - w * 0.0072) * 0.32}" fill="${tint}"/>
    <path d="M${battX + battW - w * 0.0044},${cy - w * 0.0064} a${w * 0.0044},${w * 0.0044} 0 0 1 0,${w * 0.0128}" fill="${tint}" opacity="0.45"/>`;
}

/**
 * Мокап экрана в корпусе iPhone 17 Pro
 *
 * Корпус, титановая грань, кнопки, Dynamic Island, статус-бар и полоса
 * жеста — всё векторное, поэтому в Figma правится как обычные фигуры.
 * Скриншот вставляется под статус-бар: на устройстве шапка приложения
 * уходит под него, а Dynamic Island лежит поверх.
 *
 * @param {Object} o - положение, ширина экрана и файл скриншота
 * @returns {string} группа мокапа
 */
function mockup({ x, y, w, file, id }) {
  const statusH = w * 0.125;        // safe area сверху
  const shotH = w * RATIO;          // скриншот в своих пропорциях
  const h = statusH + shotH;        // высота экрана целиком

  // Грань тонкая: у современных корпусов рамка почти не видна, толстый кант
  // сразу читается как дешёвый мокап
  const frame = w * 0.019;
  const rIn = w * 0.145;
  const rOut = rIn + frame;

  const [topHex, isDark] = SCREEN_TOP[file] || ['#72002F', true];
  const tint = isDark ? '#FFFFFF' : '#1A0710';

  // Dynamic Island: 125 × 36 pt при ширине 390, отступ сверху 11 pt
  const diW = w * 0.3205;
  const diH = w * 0.0923;
  const diX = x + (w - diW) / 2;
  const diY = y + w * 0.0243;

  // Кнопки выступают на треть своей толщины — остальное «утоплено» в грань,
  // поэтому у корпуса не появляется зубцов по контуру
  const bw = frame * 0.5;
  const btn = (bx, by, bh) =>
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bw * 0.5}" fill="url(#edge-${id})"/>`;

  const bodyPath = squircle(x - frame, y - frame, w + frame * 2, h + frame * 2, rOut);
  const bezelPath = squircle(x - frame * 0.2, y - frame * 0.2, w + frame * 0.4, h + frame * 0.4, rIn + frame * 0.2);
  const screenPath = squircle(x, y, w, h, rIn);

  return `  <g id="${id}">
    <defs>
      <linearGradient id="body-${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#121116"/>
        <stop offset="0.03" stop-color="#5A5964"/>
        <stop offset="0.11" stop-color="#24232A"/>
        <stop offset="0.5" stop-color="#1B1A20"/>
        <stop offset="0.89" stop-color="#24232A"/>
        <stop offset="0.97" stop-color="#5A5964"/>
        <stop offset="1" stop-color="#121116"/>
      </linearGradient>
      <linearGradient id="edge-${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#17161B"/>
        <stop offset="0.5" stop-color="#4E4D57"/>
        <stop offset="1" stop-color="#17161B"/>
      </linearGradient>
      <clipPath id="clip-${id}"><path d="${screenPath}"/></clipPath>
    </defs>

    ${btn(x - frame - bw * 0.34, y + h * 0.128, h * 0.036)}
    ${btn(x - frame - bw * 0.34, y + h * 0.206, h * 0.06)}
    ${btn(x - frame - bw * 0.34, y + h * 0.28, h * 0.06)}
    ${btn(x + w + frame - bw * 0.66, y + h * 0.234, h * 0.095)}

    <path d="${bodyPath}" fill="url(#body-${id})"/>
    <path d="${bezelPath}" fill="#08070A"/>

    <g clip-path="url(#clip-${id})">
      <rect x="${x}" y="${y}" width="${w}" height="${statusH + 1}" fill="${topHex}"/>
      <image href="${embed(file)}" x="${x}" y="${y + statusH}" width="${w}" height="${shotH}" preserveAspectRatio="xMidYMid slice"/>
    </g>

${statusBar({ x, y, w, h: statusH, tint })}

    <rect x="${diX}" y="${diY}" width="${diW}" height="${diH}" rx="${diH / 2}" fill="#08070A"/>
    <circle cx="${diX + diW - diH * 0.52}" cy="${diY + diH / 2}" r="${diH * 0.2}" fill="#15141A"/>
    <circle cx="${diX + diW - diH * 0.52}" cy="${diY + diH / 2}" r="${diH * 0.095}" fill="#232B3D"/>

    <rect x="${x + (w - w * 0.35) / 2}" y="${y + h - w * 0.031}" width="${w * 0.35}" height="${w * 0.0128}" rx="${w * 0.0064}" fill="#1A0710" opacity="0.5"/>
  </g>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Файл 1. Презентация-кейс
// ─────────────────────────────────────────────────────────────────────────────

const W = 1440;
const M = 100;          // поля
const CW = W - M * 2;   // ширина контента

const FACTS = [
  ['Платформы', 'iOS · Android · Web'],
  ['Стек', 'React Native · Expo 53'],
  ['Экранов', '15'],
  ['Расчётных модулей', '7'],
  ['Тестов на формулы', '133'],
  ['Языки интерфейса', 'RU · EN'],
];

const OLD_FLOW = [
  'замеры — в бумажный журнал',
  'вечером перенос в Excel',
  'предобработка вручную',
  'расчёт в офисе на ПК',
  'ошибку видно через сутки',
];

const NEW_FLOW = [
  'замеры сразу на объекте',
  'график строится на лету',
  'T и k — на устройстве',
  'участок задаётся вручную',
  'журнал уходит коллеге',
];

const CASE_BLOCKS = [
  {
    label: 'Обработка ОФР',
    lead: 'Журнал опыта, график понижения и параметры пласта на одном экране. Любая правка в таблице сразу пересчитывает прямую и водопроводимость.',
    screens: ['03-journal.png', '04-chart.png', '15-recovery.png'],
    captions: ['Журнал замеров', 'Купер — Джейкоб', 'Восстановление уровня'],
  },
  {
    label: 'Калькулятор',
    lead: 'Шесть расчётов, которые нужны в поле: перевод размерностей, оценка параметров, прогноз понижения, приток в котлован, барраж и инфильтрационные утечки.',
    screens: ['05-calculator.png', '06-barrage.png', '07-leakage.png'],
    captions: ['Коэффициент фильтрации', 'Границы пласта', 'Пласт с перетеканием'],
  },
  {
    label: 'Поле и обучение',
    lead: 'Точки наблюдения ложатся на карту по координатам устройства и живут в памяти телефона. Рядом — каталог видеоуроков и текстовое руководство.',
    screens: ['08-diary.png', '09-videos.png', '11-manual.png'],
    captions: ['Полевой дневник', 'Видеоуроки', 'Руководство'],
  },
  {
    label: 'Аккаунт',
    lead: 'Без аккаунта приложение работоспособно целиком. Вход нужен, чтобы те же журналы открывались на другом телефоне или планшете.',
    screens: ['12-settings.png', '13-subscription.png', '14-auth.png'],
    captions: ['Настройки', 'Подписка', 'Вход'],
  },
];

/**
 * Собирает SVG презентации-кейса
 *
 * @returns {string} содержимое файла
 */
function buildCase() {
  const parts = [];
  let y = 0;

  // ── Шапка
  parts.push(mono({ x: M, y: 86, s: 'ПОЛЕВОЙ КАЛЬКУЛЯТОР ГИДРОГЕОЛОГА', size: 14, tracking: 3, fill: '#6B6169' }));
  parts.push(mono({ x: W - M, y: 86, s: '2026', size: 14, tracking: 3, fill: '#6B6169', anchor: 'end' }));
  parts.push(`  <rect x="${M}" y="110" width="${CW}" height="1" fill="#E8E4E6"/>`);
  parts.push(text({ x: M, y: 320, s: 'АНСДИМАТ', size: 210, weight: 800, tracking: -8 }));
  y = 400;

  // ── Hero: предметный кадр, собранный в compose-hero.js
  const heroJpg = path.join(DIR, 'hero-opt.jpg');
  const heroPng = path.join(DIR, 'hero.png');
  const heroPath = fs.existsSync(heroJpg) ? heroJpg : heroPng;
  const heroH = Math.round((W * 1800) / 2400);
  if (fs.existsSync(heroPath)) {
    const mime = heroPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const uri = `data:${mime};base64,` + fs.readFileSync(heroPath).toString('base64');
    parts.push(`  <image href="${uri}" x="0" y="${y}" width="${W}" height="${heroH}" preserveAspectRatio="xMidYMid slice"/>`);
  } else {
    // Запасной вариант, если предметный кадр ещё не собран
    parts.push(`  <rect x="0" y="${y}" width="${W}" height="${heroH}" fill="#F1EFF0"/>`);
    parts.push(mockup({ x: W / 2 - 165, y: y + 60, w: 330, file: '01-home.png', id: 'hero' }));
  }
  y += heroH + 100;

  // ── Описание
  parts.push(paragraph({
    x: M, y, size: 30, weight: 500, lineHeight: 1.45, maxChars: 62,
    s: 'Мобильная версия АНСДИМАТ — программы для обработки опытно-фильтрационных работ, которой гидрогеологи пользуются с 1993 года. Приложение переносит расчёт из офиса на объект: замеры, график и параметры пласта — в поле, без связи.',
  }));
  y += 30 * 1.45 * 4 + 70;

  // ── Факты
  const factW = (CW - 40) / 3;
  FACTS.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const fx = M + col * (factW + 20);
    const fy = y + row * 150;
    parts.push(`  <rect x="${fx}" y="${fy}" width="${factW}" height="130" fill="#F5F3F4"/>`);
    parts.push(mono({ x: fx + 28, y: fy + 44, s: f[0], size: 13, tracking: 1.5, fill: '#6B6169' }));
    parts.push(text({ x: fx + 28, y: fy + 90, s: f[1], size: 26, weight: 700 }));
  });
  y += 2 * 150 + 80;

  // ── Задача и решение
  parts.push(`  <rect x="${M}" y="${y}" width="${CW}" height="1" fill="#E8E4E6"/>`);
  y += 70;
  // Колонки шагов: между ними обязателен зазор, иначе строки соседних
  // колонок читаются как одна сплошная фраза
  const stepW = (CW - 260) / 5;
  const stepChars = 19;

  /**
   * Рисует ленту шагов процесса
   *
   * @param {Array<string>} flow - подписи шагов
   * @param {string} title - заголовок ленты
   * @param {string} accent - цвет номеров и линии
   * @param {number} top - вертикальная позиция начала ленты
   * @returns {number} позиция под лентой
   */
  const flowStrip = (flow, title, accent, top) => {
    let fy = top;
    parts.push(mono({ x: M + 260, y: fy, s: title, size: 12, tracking: 2, fill: accent }));
    fy += 20;
    parts.push(`  <rect x="${M + 260}" y="${fy}" width="${CW - 260}" height="1" fill="${accent === '#6B6169' ? '#E8E4E6' : accent}"/>`);
    fy += 46;
    flow.forEach((s, i) => {
      const sx = M + 260 + i * stepW;
      parts.push(mono({ x: sx, y: fy, s: String(i + 1), size: 22, weight: 700, fill: accent === '#6B6169' ? '#1A0710' : accent }));
      parts.push(paragraph({ x: sx, y: fy + 30, s, size: 14, fill: '#6B6169', maxChars: stepChars, lineHeight: 1.45 }));
    });
    return fy + 130;
  };

  parts.push(text({ x: M, y, s: 'Задача', size: 22, weight: 700 }));
  parts.push(text({ x: M + 260, y: y - 2, s: 'Расчёт оторван от места работ', size: 26, weight: 600 }));
  y = flowStrip(OLD_FLOW, 'КАК БЫЛО', '#6B6169', y + 60);
  y += 40;

  parts.push(text({ x: M, y, s: 'Решение', size: 22, weight: 700 }));
  parts.push(text({ x: M + 260, y: y - 2, s: 'Приложение считает прямо на объекте', size: 26, weight: 600 }));
  y = flowStrip(NEW_FLOW, 'КАК СТАЛО', '#72002F', y + 60);
  y += 60;

  // ── Блоки экранов
  CASE_BLOCKS.forEach((block, bi) => {
    const mw = 290;
    const mh = mw * MOCK_RATIO;
    const bleed = mw * MOCK_BLEED;
    const blockH = mh + 270;
    parts.push(`  <rect x="0" y="${y}" width="${W}" height="${blockH}" fill="${bi % 2 ? '#F5F3F4' : '#FFFFFF'}"/>`);
    parts.push(text({ x: M, y: y + 76, s: block.label, size: 22, weight: 700 }));
    parts.push(paragraph({ x: M + 260, y: y + 70, s: block.lead, size: 16, fill: '#6B6169', maxChars: 74, lineHeight: 1.5 }));

    // Мокап шире экрана на грань корпуса, поэтому раскладка ведётся
    // по внешним габаритам, иначе соседние телефоны соприкоснутся
    const outer = mw + bleed * 2;
    const gap = (CW - outer * 3) / 2;
    block.screens.forEach((file, si) => {
      const mx = M + bleed + si * (outer + gap);
      const my = y + 170;
      parts.push(mockup({ x: mx, y: my, w: mw, file, id: `b${bi}s${si}` }));
      parts.push(mono({ x: mx - bleed, y: my + mh + 56, s: block.captions[si], size: 13, tracking: 1, fill: '#6B6169' }));
    });
    y += blockH;
  });

  // ── Футер
  y += 60;
  parts.push(`  <rect x="${M}" y="${y}" width="${CW}" height="1" fill="#E8E4E6"/>`);
  y += 60;
  parts.push(text({ x: M, y, s: 'ansdimat.com', size: 22, weight: 700 }));
  y += 120;

  const H = Math.round(y);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
${parts.join('\n')}
</svg>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Файл 2. UI-кит: все экраны, палитра, типографика
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Собирает SVG с полным набором экранов и дизайн-токенами
 *
 * @returns {string} содержимое файла
 */
function buildKit() {
  const KW = 1920;
  const KM = 80;
  const parts = [];
  let y = 0;

  parts.push(mono({ x: KM, y: 80, s: 'ANSDIMAT MOBILE · UI KIT', size: 14, tracking: 3, fill: '#6B6169' }));
  parts.push(mono({ x: KW - KM, y: 80, s: 'v1.0.0 · 2026', size: 14, tracking: 3, fill: '#6B6169', anchor: 'end' }));
  parts.push(text({ x: KM, y: 190, s: 'Все экраны приложения', size: 76, weight: 800, tracking: -2 }));
  parts.push(paragraph({
    x: KM, y: 250, size: 18, fill: '#6B6169', maxChars: 110,
    s: 'Светлая тема, 390 × 844. Приложение также поддерживает тёмную тему и планшетную вёрстку.',
  }));
  y = 350;

  // ── Сетка экранов: 5 колонок. Шаг считается по внешним габаритам мокапа,
  // включая грань корпуса и боковые кнопки
  const cols = 5;
  const gapX = 70;
  const outer = (KW - KM * 2 - gapX * (cols - 1)) / cols;
  const mw = outer / (1 + MOCK_BLEED * 2);
  const bleed = mw * MOCK_BLEED;
  const mh = mw * MOCK_RATIO;
  SCREEN_LIST.forEach(([file, name, note], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = KM + bleed + col * (outer + gapX);
    const my = y + row * (mh + 160);
    parts.push(mockup({ x, y: my, w: mw, file, id: `k${i}` }));
    parts.push(text({ x: x - bleed, y: my + mh + 58, s: name, size: 19, weight: 700 }));
    parts.push(paragraph({ x: x - bleed, y: my + mh + 86, s: note, size: 14, fill: '#6B6169', maxChars: 34, lineHeight: 1.4 }));
  });
  y += Math.ceil(SCREEN_LIST.length / cols) * (mh + 160) + 60;

  // ── Палитра
  parts.push(`  <rect x="0" y="${y}" width="${KW}" height="1" fill="#E8E4E6"/>`);
  y += 90;
  parts.push(text({ x: KM, y, s: 'Палитра', size: 46, weight: 800, tracking: -1 }));
  y += 70;

  const sw = (KW - KM * 2 - 30 * 5) / 6;
  PALETTE.forEach((c, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = KM + col * (sw + 30);
    const sy = y + row * 260;
    parts.push(`  <rect x="${x}" y="${sy}" width="${sw}" height="130" rx="10" fill="${c.hex}" stroke="#E8E4E6"/>`);
    parts.push(text({ x, y: sy + 168, s: c.name, size: 18, weight: 700 }));
    parts.push(mono({ x, y: sy + 196, s: c.hex, size: 15, fill: '#6B6169' }));
    parts.push(paragraph({ x, y: sy + 224, s: c.role, size: 13, fill: '#6B6169', maxChars: 30, lineHeight: 1.35 }));
  });
  y += 2 * 260 + 50;

  // ── Цвета точек дневника
  parts.push(text({ x: KM, y, s: 'Маркеры полевого дневника', size: 24, weight: 700 }));
  y += 50;
  POINT_COLORS.forEach((c, i) => {
    const x = KM + i * 300;
    parts.push(`  <circle cx="${x + 20}" cy="${y}" r="20" fill="${c.hex}"/>`);
    parts.push(text({ x: x + 56, y: y + 2, s: c.name, size: 17, weight: 600 }));
    parts.push(mono({ x: x + 56, y: y + 26, s: c.hex, size: 13, fill: '#6B6169' }));
  });
  y += 110;

  // ── Типографика
  parts.push(`  <rect x="0" y="${y}" width="${KW}" height="1" fill="#E8E4E6"/>`);
  y += 90;
  parts.push(text({ x: KM, y, s: 'Типографика', size: 46, weight: 800, tracking: -1 }));
  y += 40;
  parts.push(paragraph({
    x: KM, y, size: 17, fill: '#6B6169', maxChars: 100,
    s: 'Manrope — интерфейс. JetBrains Mono — числа, координаты и служебные подписи: колонки замеров обязаны выравниваться по разрядам.',
  }));
  y += 90;

  TYPE_SCALE.forEach((t) => {
    parts.push(mono({ x: KM, y, s: t.name, size: 14, fill: '#6B6169' }));
    parts.push(mono({ x: KM + 200, y, s: `${t.size}/${t.weight}`, size: 14, fill: '#6B6169' }));
    parts.push(text({
      x: KM + 340, y, s: t.sample, size: t.size, weight: t.weight, tracking: t.tracking,
      family: t.mono ? "'JetBrains Mono', 'SF Mono', Menlo, monospace" : undefined,
    }));
    y += Math.max(t.size * 1.6, 54);
  });
  y += 40;

  // ── Радиусы и тени
  parts.push(`  <rect x="0" y="${y}" width="${KW}" height="1" fill="#E8E4E6"/>`);
  y += 90;
  parts.push(text({ x: KM, y, s: 'Радиусы и глубина', size: 46, weight: 800, tracking: -1 }));
  y += 70;

  const radii = [
    ['sm', 12, 'Мелкие плашки'],
    ['md', 16, 'Карточки'],
    ['card', 18, 'Крупные карточки'],
    ['lg', 22, 'Герой-блоки'],
    ['chip', 20, 'Чипы и сегменты'],
    ['pill', 26, 'Кнопки-пилюли'],
  ];
  radii.forEach((r, i) => {
    const x = KM + i * 300;
    parts.push(`  <rect x="${x}" y="${y}" width="150" height="110" rx="${r[1]}" fill="#FFFFFF" stroke="#E8E4E6" stroke-width="2"/>`);
    parts.push(mono({ x, y: y + 148, s: `${r[0]} · ${r[1]}px`, size: 14, weight: 700 }));
    parts.push(paragraph({ x, y: y + 174, s: r[2], size: 13, fill: '#6B6169', maxChars: 24 }));
  });
  y += 240;

  parts.push(text({ x: KM, y, s: 'Тени', size: 24, weight: 700 }));
  y += 50;
  const shadows = [
    ['card', '0 5px 12px rgba(20,7,14,.10)', '#FFFFFF'],
    ['brandButton', '0 8px 16px rgba(114,0,47,.32)', '#72002F'],
    ['dataButton', '0 8px 16px rgba(3,24,136,.30)', '#031888'],
    ['raised', '0 10px 20px rgba(74,0,31,.42)', '#4A001F'],
  ];
  shadows.forEach((s, i) => {
    const x = KM + i * 440;
    parts.push(`  <rect x="${x}" y="${y}" width="170" height="90" rx="18" fill="${s[2]}" stroke="#E8E4E6"/>`);
    parts.push(mono({ x: x + 200, y: y + 40, s: s[0], size: 15, weight: 700 }));
    parts.push(mono({ x: x + 200, y: y + 66, s: s[1], size: 12, fill: '#6B6169' }));
  });
  y += 190;

  const KH = Math.round(y);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${KW}" height="${KH}" viewBox="0 0 ${KW} ${KH}" fill="none">
  <rect width="${KW}" height="${KH}" fill="#FFFFFF"/>
${parts.join('\n')}
</svg>
`;
}

fs.writeFileSync(path.join(DIR, 'ANSDIMAT-case.svg'), buildCase());
fs.writeFileSync(path.join(DIR, 'ANSDIMAT-ui-kit.svg'), buildKit());

const size = (f) => (fs.statSync(path.join(DIR, f)).size / 1024 / 1024).toFixed(1) + ' МБ';
console.log('ANSDIMAT-case.svg  ', size('ANSDIMAT-case.svg'));
console.log('ANSDIMAT-ui-kit.svg', size('ANSDIMAT-ui-kit.svg'));
