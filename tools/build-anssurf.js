/**
 * Сборка встраиваемой версии AnsSurf из поставки разработчика
 *
 * AnsSurf — построитель карт гидроизогипс, приходит собранным веб-приложением:
 * два HTML по 2.1 МБ (русский и английский), внешний `ansdimat-export.js` и
 * папка картинок. Внутри приложения он живёт в WebView, и поставку надо
 * привести к тому, что WebView умеет открыть:
 *
 * 1. `ansdimat-export.js` встраивается в сам HTML. WebView открывает один
 *    файл, а не каталог: относительная ссылка на соседний скрипт из ассетов
 *    Android не разрешается, и экспорт в АНСДИМАТ молча отваливался бы.
 * 2. Счётчик Яндекс.Метрики вырезается целиком. Он включён с `webvisor: true`,
 *    то есть пишет сеанс целиком — координаты скважин, уровни, всё, что
 *    гидрогеолог ввёл в поле. В браузере на сайте это дело разработчика сайта;
 *    внутри установленного приложения это скрытая передача данных проекта
 *    третьей стороне, которую пользователю никто не объявлял.
 * 3. Иконки вкладки (`<link rel=icon>` с data-URI на 110 КБ) выбрасываются:
 *    WebView их не показывает, а вес они занимают.
 * 4. Четвёртый шаг переименовывается из «Печати» в «Выгрузку». Печати в нём
 *    нет вовсе — `window.print` в поставке не вызывается ни разу, а внутри
 *    лежат PDF, JPG с файлом привязки, GeoTIFF, DXF, Shapefile и сеточный
 *    `.grd`. На телефоне печатать некуда, и подпись обещала бы то, чего нет;
 *    выгрузка же — ровно то, ради чего сюда и приходят.
 * 5. В конец `<head>` добавляется скин — `tools/anssurf-skin.css` вместе со
 *    встроенными шрифтами из `tools/anssurf-fonts.css`. Поставка приходит со
 *    своей палитрой и десктопной вёрсткой, а внутри приложения раздел обязан
 *    читаться как его часть, а не как вставленный сайт. Скин идёт последним
 *    в `<head>`, поэтому переопределяет токены поставки без `!important`.
 * 6. Тексты и места в бандле, которые правятся под приложение: подсказки
 *    про правую кнопку мыши, кнопка «к печати», меню у края экрана — см.
 *    `PAGE_TEXT` и `SOURCE_PATCHES`.
 * 7. Первым в `<head>` встаёт скрипт приложения `tools/anssurf-host.js`: то,
 *    что скин не умеет, — прокрутка к началу при смене шага и меню в
 *    пределах экрана.
 * 8. Картинки из `img/` поставки встраиваются в страницу data-адресами: как
 *    и со скриптом экспорта, соседней папки у файла в кэше WebView нет, и
 *    ссылка на неё давала битую картинку. Картинки, которой нет в поставке,
 *    сборка не роняет, а перечисляет — её надо попросить у разработчика.
 * 9. Тегу `<html>` возвращается класс `hydro-desktop` — десктопная вёрстка
 *    поставки. До поставки от 23.09 он стоял в разметке всегда, теперь
 *    поставка ставит его сама только в Electron и по `?desktop=1`. Без него
 *    в приложении появлялись шапка и подвал сайта, лента шагов не влезала в
 *    экран, пропадали кнопка «Экспорт в АНСДИМАТ», рисование и слои, а скин
 *    не срабатывал вовсе — все его правила под этим классом.
 *
 * Имена файлов сохраняются. Внутри сборки есть ссылки вида
 * `gidroizogipsy-en.html` и определение языка по `location.pathname` —
 * переименование их бы порвало.
 *
 * Запуск:
 *   node tools/build-anssurf.js [каталог-поставки]
 *
 * По умолчанию каталог поставки — `../.anssurf-src` рядом с репозиторием:
 * распакованный архив разработчика. Собранное уезжает в `assets/anssurf/`
 * и лежит в репозитории — сборка приложения не должна зависеть от того,
 * распакован ли у сборщика чужой архив.
 */

const fs = require('fs');
const path = require('path');

/** Файлы поставки: имя на входе — имя на выходе */
const PAGES = ['gidroizogipsy.html', 'gidroizogipsy-en.html'];

/** Скрипт, который встраивается в каждую страницу */
const EXPORT_SCRIPT = 'ansdimat-export.js';

/** Куда складывается собранное */
const OUT_DIR = path.join(__dirname, '..', 'assets', 'anssurf');

/** Скин и шрифты: собираются в один <style> в конце <head> */
const SKIN_FILES = ['anssurf-fonts.css', 'anssurf-skin.css'];

/** Скрипт приложения: встаёт первым в <head>, до скриптов поставки */
const HOST_SCRIPT = 'anssurf-host.js';

/**
 * Новое название четвёртого шага по языку страницы
 *
 * Ключ — имя файла поставки. Подпись живёт в объявлении шагов внутри
 * бандла: `{id:4,label:`Печать`,short:`Печать`,icon:…}`.
 */
const STEP_RENAME = {
  'gidroizogipsy.html': 'Выгрузка',
  'gidroizogipsy-en.html': 'Export',
};

/**
 * Строка бандла в обратных кавычках — так в нём записан любой текст
 *
 * @param {string} text - текст
 * @returns {string} шаблонная строка
 */
const lit = (text) => `\`${text}\``;

/**
 * Тексты страницы, которые правятся под приложение
 *
 * Подсказки поставки написаны для компьютера: «Правая кнопка мыши — добавить
 * скважину». На телефоне мыши нет, а в узком окне браузера с мышью подсказка
 * про касание была бы неверна — поэтому новые тексты верны для обоих: в
 * режиме «Поставить скважины на карте» скважину ставит обычное нажатие на
 * карту, и пальцем, и мышью. (До поставки от 23.09 кнопка называлась
 * «Добавить скважину на карте», а в режиме подсказывала «Click the map…» —
 * теперь её подпись нейтральна и правки не требует.)
 *
 * Кнопка третьего шага звала «к печати», хотя четвёртый шаг уже называется
 * «Выгрузка» и печати в нём нет.
 *
 * Подсказка второго шага отсылала к кнопкам «справа в меню». Справа они
 * только на широком экране; на телефоне панель встаёт под карту. Кнопки
 * идут сразу под подсказкой при любой раскладке — так и сказано теперь.
 *
 * В английской странице метки колонок в предпросмотре таблицы остались
 * русскими: «СКВ» у названия скважины и «ДОП» у вспомогательной колонки.
 *
 * Подсказка «156.3» в поле уровня выглядела как введённое число: человек
 * видел значение в поле и не понимал, почему «Добавить» не нажимается.
 *
 * Ключ — имя файла поставки, значение — пары «как в бандле → как надо».
 * Каждая левая часть обязана встретиться ровно один раз.
 */
const PAGE_TEXT = {
  'gidroizogipsy.html': [
    [
      lit('Укажите положение скважины. Правая кнопка мыши — добавить скважину.'),
      lit('Нажмите на карту там, где стоит скважина.'),
    ],
    [
      lit('Правая кнопка мыши на карте — добавить скважину.'),
      lit('Чтобы добавить скважину, нажмите «Поставить скважины на карте», а затем — на карту.'),
    ],
    [
      lit('Укажите положение скважины на карте (правая кнопка — добавить).'),
      lit('Нажмите на карту там, где стоит скважина.'),
    ],
    [lit('Подготовить карту к печати'), lit('Перейти к выгрузке')],
    [
      lit('Нажмите на одну из кнопок справа в меню, чтобы продолжить работу.'),
      lit('Нажмите одну из кнопок ниже, чтобы продолжить работу.'),
    ],
    [`placeholder:${lit('156.3')}`, `placeholder:${lit('напр. 156.3')}`],
  ],
  'gidroizogipsy-en.html': [
    [
      lit('Indicate the well location. Right-click the map to add a well.'),
      lit('Click or tap the map where the well is.'),
    ],
    [
      lit('Right-click the map to add a well.'),
      lit('To add a well, press “Place wells on the map”, then click or tap the map.'),
    ],
    [
      lit('Indicate the well location on the map (right-click to add).'),
      lit('Click or tap the map where the well is.'),
    ],
    [lit('Prepare the map for print'), lit('Go to export')],
    [
      lit('Click one of the buttons on the right to continue.'),
      lit('Click or tap one of the buttons below to continue.'),
    ],
    [`n===t.name?${lit('скв')}:n===t.aux?${lit('доп')}`, `n===t.name?${lit('well')}:n===t.aux?${lit('aux')}`],
    [`placeholder:${lit('156.3')}`, `placeholder:${lit('e.g. 156.3')}`],
  ],
};

/**
 * Правки кода бандла, общие для обеих страниц
 *
 * Контекстное меню «Добавить скважину» встаёт в точку нажатия и у правого
 * края экрана наполовину уходило за него. Меню получает ref, который после
 * отрисовки сдвигает его внутрь карты (`__ansdClampMenu` из скрипта
 * приложения). Функция-стрелка, а не ссылка на готовую: новый ref на каждой
 * отрисовке заставляет React вызвать его и после того, как меню переехало.
 *
 * Хранилище страницы открывается наружу как `window.__hydroZ` — по нему
 * скрипт экспорта в АНСДИМАТ берёт систему координат проекта, растры и
 * видимость слоёв, а приложение узнаёт, есть ли на карте работа. Но в сборке
 * поставки хранилище создаётся внутри ленивой инициализации модуля, а
 * присваивание стоит снаружи и выполняется раньше неё: в `window` уходил
 * `undefined`, и все эти ветки молча не работали (в Electron — тоже).
 * Геттер отдаёт хранилище в момент обращения, когда оно уже создано.
 * Исправят в поставке — правка перестанет находиться, и сборка скажет об этом.
 */
const SOURCE_PATCHES = [
  [
    'style:{left:ctx.px,top:ctx.py}',
    'ref:e=>window.__ansdClampMenu&&window.__ansdClampMenu(e),style:{left:ctx.px,top:ctx.py}',
  ],
  [
    'try{window.__hydroZ=Z;',
    'try{Object.defineProperty(window,`__hydroZ`,{configurable:!0,enumerable:!0,get:()=>Z});',
  ],
];

/**
 * Вырезает кусок между двумя метками вместе с ними
 *
 * Падает, если метки не нашлись: поставка сменила разметку, и молча собрать
 * страницу со счётчиком внутри нельзя.
 *
 * @param {string} html - разметка страницы
 * @param {string} from - начальная метка
 * @param {string} to - конечная метка
 * @param {string} what - что вырезаем, для сообщения об ошибке
 * @returns {string} разметка без куска
 */
function cutBetween(html, from, to, what) {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start + from.length);
  if (start < 0 || end < 0) {
    throw new Error(
      `Не найден ${what}: поставка AnsSurf изменилась, сборку надо обновить`
    );
  }
  return html.slice(0, start) + html.slice(end + to.length);
}

/**
 * Выбрасывает теги иконок вкладки
 *
 * @param {string} html - разметка страницы
 * @returns {string} разметка без иконок
 */
function dropIcons(html) {
  return html.replace(/\s*<link rel="(?:apple-touch-)?icon"[^>]*>/g, '');
}

/**
 * Встраивает внешний скрипт в страницу
 *
 * @param {string} html - разметка страницы
 * @param {string} code - содержимое скрипта
 * @returns {string} разметка со встроенным скриптом
 */
function inlineExport(html, code) {
  // С поставки от 23.09 адрес идёт с меткой версии против кэша браузера —
  // `ansdimat-export.js?v=20260923c`; метка от сборки к сборке своя
  const tag = new RegExp(
    `<script src="${EXPORT_SCRIPT.replace('.', '\\.')}(?:\\?[^"]*)?"></script>`,
    'g'
  );
  const found = html.match(tag);
  if (!found || found.length !== 1) {
    throw new Error(
      `Не найдено подключение ${EXPORT_SCRIPT} (или оно не одно): поставка AnsSurf изменилась`
    );
  }
  // Проверка обязательна: закрывающий тег внутри кода оборвал бы скрипт
  // ровно посередине, и страница осталась бы без экспорта, не сказав ни слова
  if (/<\/script/i.test(code)) {
    throw new Error(`В ${EXPORT_SCRIPT} встретился </script> — встроить нельзя`);
  }
  // Функция вместо строки замены: в коде скрипта `$&` и `$1` имели бы особый смысл
  return html.replace(tag, () => `<script>\n${code}\n</script>`);
}

/** Тип картинки по расширению — для data-адреса */
const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

/**
 * Ссылка на картинку поставки: относительный путь `img/…` сразу после
 * кавычки, скобки или знака равенства. Хвост чужого адреса
 * (`https://…/img/logo.png`) под это не подходит и не трогается
 */
const IMAGE_REF = /(?<=["'`(=])img\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|gif|svg|webp)/g;

/**
 * Встраивает картинки поставки в страницу
 *
 * @param {string} html - разметка страницы
 * @param {string} srcDir - каталог поставки
 * @returns {{html: string, missing: Array<string>}} разметка и пути картинок,
 *   которых в поставке нет
 */
function inlineImages(html, srcDir) {
  const refs = [...new Set(html.match(IMAGE_REF) || [])];
  const uris = {};
  const missing = [];
  for (const ref of refs) {
    const file = path.join(srcDir, ref);
    if (!fs.existsSync(file)) {
      missing.push(ref);
      continue;
    }
    const mime = IMAGE_MIME[path.extname(ref).slice(1).toLowerCase()];
    uris[ref] = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  }
  return {
    html: html.replace(IMAGE_REF, (ref) => uris[ref] || ref),
    missing,
  };
}

/**
 * Переводит байты в килобайты для отчёта
 *
 * @param {number} bytes - размер
 * @returns {string} размер в КБ
 */
const kb = (bytes) => `${Math.round(bytes / 1024)} КБ`;

/**
 * Переименовывает четвёртый шаг
 *
 * Значок шага не трогаем: его имя в бандле минифицировано и меняется от
 * сборки к сборке, поэтому в образце оно не закреплено.
 *
 * @param {string} html - разметка страницы
 * @param {string} label - новая подпись
 * @returns {string} разметка с переименованным шагом
 */
function renameFourthStep(html, label) {
  const pattern = /(\{id:4,label:`)[^`]+(`,short:`)[^`]+(`)/g;
  const found = html.match(pattern);
  if (!found || found.length !== 1) {
    throw new Error(
      `Объявление четвёртого шага не найдено или не одно (${
        found ? found.length : 0
      }): поставка AnsSurf изменилась`
    );
  }
  return html.replace(pattern, `$1${label}$2${label}$3`);
}

/**
 * Заменяет кусок бандла, встреченный ровно один раз
 *
 * Ни одного вхождения — поставка сменила текст, и правка молча пропала бы.
 * Больше одного — замена задела бы чужое место.
 *
 * @param {string} html - разметка страницы
 * @param {string} from - что заменить
 * @param {string} to - на что
 * @returns {string} разметка с заменой
 */
function replaceOnce(html, from, to) {
  const count = html.split(from).length - 1;
  if (count !== 1) {
    throw new Error(
      `«${from}» найдено ${count} раз вместо одного: поставка AnsSurf изменилась`
    );
  }
  // Функция вместо строки замены: в строке `$&` и `$1` имели бы особый смысл
  return html.replace(from, () => to);
}

/**
 * Включает десктопную вёрстку поставки
 *
 * Класс ставится прямо в разметку, а не адресом `?desktop=1`: тогда вёрстка
 * одна и та же в WebView, в iframe веб-сборки и при открытии файла руками, а
 * поставка не принимает приложение за Electron и не рисует рамку окна
 * Windows (`hydro-winchrome` она ставит только вместе с адресом).
 *
 * @param {string} html - разметка страницы
 * @returns {string} разметка с классом у <html>
 */
function desktopLayout(html) {
  const tag = /<html\b([^>]*)>/g;
  const found = html.match(tag);
  if (!found || found.length !== 1) {
    throw new Error(
      `Тег <html> не найден или не один (${found ? found.length : 0}): поставка AnsSurf изменилась`
    );
  }
  return html.replace(tag, (whole, attrs) => {
    const cls = /\bclass="([^"]*)"/.exec(attrs);
    if (!cls) return `<html${attrs} class="hydro-desktop">`;
    if (/(?:^|\s)hydro-desktop(?:\s|$)/.test(cls[1])) return whole;
    return `<html${attrs.replace(cls[0], `class="hydro-desktop ${cls[1]}"`)}>`;
  });
}

/**
 * Применяет к странице тексты и правки кода
 *
 * @param {string} html - разметка страницы
 * @param {string} name - имя файла поставки
 * @returns {string} разметка с правками
 */
function patchPage(html, name) {
  return [...PAGE_TEXT[name], ...SOURCE_PATCHES].reduce(
    (out, [from, to]) => replaceOnce(out, from, to),
    html
  );
}

/**
 * Ставит скрипт приложения первым в <head>
 *
 * Первым — чтобы подмена `window.scrollTo` и функции для бандла были готовы
 * раньше, чем скрипты поставки их позовут.
 *
 * @param {string} html - разметка страницы
 * @param {string} code - содержимое скрипта
 * @returns {string} разметка со скриптом
 */
function addHostScript(html, code) {
  // Закрывающий тег внутри кода оборвал бы скрипт посередине
  if (/<\/script/i.test(code)) {
    throw new Error(`В ${HOST_SCRIPT} встретился </script> — встроить нельзя`);
  }
  return replaceOnce(html, '<head>', `<head>\n<script data-ansdimat-host>\n${code}\n</script>`);
}

/**
 * Дописывает скин в конец <head>
 *
 * Именно в конец: правила поставки лежат выше, и одинаковая по весу
 * селекторов подмена токена побеждает порядком, а не `!important`.
 *
 * @param {string} html - разметка страницы
 * @param {string} skin - содержимое скина
 * @returns {string} разметка со скином
 */
function addSkin(html, skin) {
  const head = html.lastIndexOf('</head>');
  if (head < 0) {
    throw new Error('Не найден </head>: поставка AnsSurf изменилась');
  }
  return (
    html.slice(0, head) +
    `<style data-ansdimat-skin>\n${skin}\n</style>\n` +
    html.slice(head)
  );
}

/**
 * Собирает одну страницу
 *
 * @param {string} srcDir - каталог поставки
 * @param {string} name - имя файла страницы
 * @param {string} exportCode - содержимое встраиваемого скрипта
 * @param {string} skin - содержимое скина
 * @param {string} host - скрипт приложения
 */
function buildPage(srcDir, name, exportCode, skin, host) {
  const source = fs.readFileSync(path.join(srcDir, name), 'utf8');

  let html = source;
  html = cutBetween(
    html,
    '<!-- Yandex.Metrika counter -->',
    '<!-- /Yandex.Metrika counter -->',
    'счётчик Яндекс.Метрики'
  );
  html = dropIcons(html);
  html = inlineExport(html, exportCode);
  const images = inlineImages(html, srcDir);
  html = images.html;
  if (images.missing.length) {
    console.warn(
      `${name}: в поставке нет картинок — попросите у разработчика: ${images.missing.join(', ')}`
    );
  }
  html = desktopLayout(html);
  html = renameFourthStep(html, STEP_RENAME[name]);
  html = patchPage(html, name);
  html = addHostScript(html, host);
  html = addSkin(html, skin);

  if (/mc\.yandex\.ru|metrika/i.test(html)) {
    throw new Error(`В ${name} остались следы Метрики после вырезания`);
  }

  fs.writeFileSync(path.join(OUT_DIR, name), html);
  console.log(
    `${name}: ${kb(Buffer.byteLength(source))} → ${kb(Buffer.byteLength(html))}`
  );
}

/**
 * Точка входа
 */
function main() {
  const srcDir = path.resolve(
    process.argv[2] || path.join(__dirname, '..', '..', '.anssurf-src')
  );

  if (!fs.existsSync(path.join(srcDir, EXPORT_SCRIPT))) {
    console.error(
      `Поставка AnsSurf не найдена в ${srcDir}\n` +
        `Распакуйте архив разработчика и укажите каталог:\n` +
        `  node tools/build-anssurf.js <каталог>`
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const exportCode = fs.readFileSync(path.join(srcDir, EXPORT_SCRIPT), 'utf8');

  const skin = SKIN_FILES.map((file) =>
    fs.readFileSync(path.join(__dirname, file), 'utf8')
  ).join('\n');
  const host = fs.readFileSync(path.join(__dirname, HOST_SCRIPT), 'utf8');

  for (const name of PAGES) buildPage(srcDir, name, exportCode, skin, host);

  console.log(`Готово: ${OUT_DIR}`);
}

// Сборка запускается из командной строки; тест подключает модуль ради
// отдельных шагов и собирать страницы при этом не должен
if (require.main === module) main();

module.exports = {
  PAGE_TEXT,
  SOURCE_PATCHES,
  replaceOnce,
  patchPage,
  addHostScript,
  desktopLayout,
  inlineExport,
  inlineImages,
};
