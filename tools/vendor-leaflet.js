/**
 * Встраивание Leaflet в карты приложения
 *
 * Карты полевого дневника и зоны санитарной охраны раньше подключали Leaflet
 * с unpkg.com. В поле без сети скрипт не приезжал, и вместо карты оставался
 * серый прямоугольник — при том что подсказка просила «нажать на карту».
 * Подложка OpenStreetMap без сети не загрузится всё равно, но сама карта —
 * точки, их перетаскивание, постановка нажатием — от сети не зависит, если
 * Leaflet лежит в приложении.
 *
 * Скрипт скачивает те же два файла, что раньше подключались по ссылке,
 * сверяет их с прежними хэшами SRI (подмена или битая загрузка не пройдут) и
 * пишет модуль `components/leafletAssets.js` со строками CSS и JS. Модуль
 * лежит в репозитории: сборка приложения от сети не зависит.
 *
 * Запуск:
 *   node tools/vendor-leaflet.js [каталог-с-файлами]
 *
 * Без аргумента файлы скачиваются с unpkg.com; с аргументом — берутся из
 * каталога (leaflet.js, leaflet.css, LICENSE).
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const VERSION = '1.9.4';

/** Файлы и их хэши SRI — те, что стояли в ссылках на unpkg */
const FILES = {
  'leaflet.css': {
    url: `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.css`,
    sri: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H',
  },
  'leaflet.js': {
    url: `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.js`,
    sri: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH',
  },
  LICENSE: { url: `https://unpkg.com/leaflet@${VERSION}/LICENSE` },
};

const OUT = path.join(__dirname, '..', 'components', 'leafletAssets.js');

/**
 * Скачивает файл, следуя перенаправлениям unpkg
 *
 * @param {string} url - адрес
 * @returns {Promise<Buffer>} содержимое
 */
function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(download(new URL(res.headers.location, url).toString()));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`${url}: HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/**
 * Хэш SRI содержимого
 *
 * @param {Buffer} data - содержимое
 * @returns {string} `sha384-…`
 */
const sri = (data) => `sha384-${crypto.createHash('sha384').update(data).digest('base64')}`;

/**
 * Строковый литерал JS
 *
 * @param {string} text - текст
 * @returns {string} литерал
 */
const literal = (text) => JSON.stringify(text);

async function main() {
  const dir = process.argv[2];
  const data = {};
  for (const [name, file] of Object.entries(FILES)) {
    data[name] = dir ? fs.readFileSync(path.join(dir, name)) : await download(file.url);
    if (file.sri && sri(data[name]) !== file.sri) {
      throw new Error(`${name}: хэш ${sri(data[name])} не совпадает с ${file.sri}`);
    }
  }

  // Текст встаёт в HTML внутрь <script> и <style>: закрывающий тег в нём
  // оборвал бы встроенный код посередине
  const css = data['leaflet.css'].toString('utf8');
  const js = data['leaflet.js'].toString('utf8');
  if (/<\/style/i.test(css) || /<\/script/i.test(js)) {
    throw new Error('В файлах Leaflet встретился закрывающий тег — встроить нельзя');
  }

  const license = data.LICENSE.toString('utf8').trim().replace(/\*\//g, '* /');
  const module = `/**
 * Leaflet ${VERSION}, встроенный в карты приложения
 *
 * Сгенерировано tools/vendor-leaflet.js — руками не править. Файлы сверены
 * с хэшами SRI, с которыми раньше подключались с unpkg.com.
 *
${license
  .split('\n')
  .map((line) => ` * ${line}`.trimEnd())
  .join('\n')}
 */
/* eslint-disable */

export const LEAFLET_VERSION = '${VERSION}';

export const LEAFLET_CSS = ${literal(css)};

export const LEAFLET_JS = ${literal(js)};
`;
  fs.writeFileSync(OUT, module);
  console.log(`${path.relative(process.cwd(), OUT)}: ${Math.round(Buffer.byteLength(module) / 1024)} КБ`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
