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
  const tag = `<script src="${EXPORT_SCRIPT}"></script>`;
  if (!html.includes(tag)) {
    throw new Error(
      `Не найдено подключение ${EXPORT_SCRIPT}: поставка AnsSurf изменилась`
    );
  }
  // Проверка обязательна: закрывающий тег внутри кода оборвал бы скрипт
  // ровно посередине, и страница осталась бы без экспорта, не сказав ни слова
  if (/<\/script/i.test(code)) {
    throw new Error(`В ${EXPORT_SCRIPT} встретился </script> — встроить нельзя`);
  }
  return html.replace(tag, `<script>\n${code}\n</script>`);
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
 */
function buildPage(srcDir, name, exportCode, skin) {
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
  html = renameFourthStep(html, STEP_RENAME[name]);
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

  for (const name of PAGES) buildPage(srcDir, name, exportCode, skin);

  console.log(`Готово: ${OUT_DIR}`);
}

main();
