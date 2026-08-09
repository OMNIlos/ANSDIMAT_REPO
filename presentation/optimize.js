/**
 * Подготовка изображений к вставке в SVG
 *
 * Съёмка идёт в 3× ради качества, но встраивать такие кадры в SVG нельзя:
 * файл раздувается до десяти мегабайт, и Figma открывает его через силу.
 * Здесь кадры ужимаются до 2× от размера в макете — этого хватает и для
 * ретины, и для печати, — а фотографический hero переводится в JPEG.
 *
 * Запуск: node presentation/optimize.js
 * Результат: screens/opt/*.png и hero-opt.jpg
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const DIR = __dirname;
const SRC = path.join(DIR, 'screens');
const OUT = path.join(SRC, 'opt');

/**
 * Ширина ужатого скриншота: в макете экран занимает 290–390 px, так что
 * 800 даёт двойной запас. Формат JPEG: PNG после перерисовки в canvas
 * теряет исходную оптимизацию и весит больше самого 3× оригинала.
 */
const SCREEN_W = 800;
const SCREEN_QUALITY = 0.94;

/** Ширина hero-кадра в JPEG */
const HERO_W = 2000;
const HERO_QUALITY = 0.9;

/**
 * Ужимает изображения через canvas в браузере
 */
async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.png')).sort();
  const hero = path.join(DIR, 'hero.png');

  // Отдаём исходники по http: file:// в canvas помечает холст как tainted
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><body></body>');
      return;
    }
    const file = rel === '/hero.png' ? hero : path.join(SRC, path.basename(rel));
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage();
  // Страница должна быть с того же origin, что и картинки, иначе canvas
  // становится «испорченным» и toDataURL бросает исключение
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });

  /**
   * Перерисовывает изображение в нужный размер и возвращает data URL
   *
   * @param {string} url - адрес исходника
   * @param {number} width - целевая ширина
   * @param {string} type - MIME-тип результата
   * @param {number} quality - качество для JPEG
   * @returns {Promise<string>} data URL
   */
  const resize = (url, width, type, quality) =>
    page.evaluate(async ([url, width, type, quality]) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await img.decode();
      const scale = width / img.naturalWidth;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL(type, quality);
    }, [url, width, type, quality]);

  /**
   * Снимает цвет верхней строки кадра
   *
   * Статус-бар в мокапе продолжает шапку приложения, и его цвет обязан
   * совпадать с самим скриншотом. Раньше соответствие держалось в таблице
   * руками — и разъезжалось при каждой пересъёмке.
   *
   * @param {string} url - адрес кадра
   * @returns {Promise<{hex: string, dark: boolean}>} цвет и его светлота
   */
  const topColor = (url) =>
    page.evaluate(async (url) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = 8;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // Усредняем по пяти точкам: одиночный пиксель может попасть на иконку
      const xs = [0.03, 0.25, 0.5, 0.75, 0.97].map((k) => Math.round(img.naturalWidth * k));
      let r = 0, g = 0, b = 0;
      for (const x of xs) {
        const d = ctx.getImageData(Math.min(x, img.naturalWidth - 1), 3, 1, 1).data;
        r += d[0]; g += d[1]; b += d[2];
      }
      r = Math.round(r / xs.length); g = Math.round(g / xs.length); b = Math.round(b / xs.length);
      const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      return { hex, dark: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.55 };
    }, url);

  let before = 0;
  let after = 0;
  const tops = {};

  for (const f of files) {
    const src = path.join(SRC, f);
    before += fs.statSync(src).size;
    tops[f] = await topColor(base + '/' + f);
    const uri = await resize(base + '/' + f, SCREEN_W, 'image/jpeg', SCREEN_QUALITY);
    const buf = Buffer.from(uri.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, f.replace(/\.png$/, '.jpg')), buf);
    after += buf.length;
  }

  fs.writeFileSync(path.join(OUT, 'top-colors.json'), JSON.stringify(tops, null, 2));
  console.log(`Экраны: ${files.length} шт, ${(before / 1048576).toFixed(1)} → ${(after / 1048576).toFixed(1)} МБ`);

  if (fs.existsSync(hero)) {
    const uri = await resize(base + '/hero.png', HERO_W, 'image/jpeg', HERO_QUALITY);
    const buf = Buffer.from(uri.split(',')[1], 'base64');
    fs.writeFileSync(path.join(DIR, 'hero-opt.jpg'), buf);
    console.log(`Hero: ${(fs.statSync(hero).size / 1048576).toFixed(1)} → ${(buf.length / 1048576).toFixed(1)} МБ`);
  }

  await browser.close();
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
