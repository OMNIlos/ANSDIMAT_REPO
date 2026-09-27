/**
 * Сборка hero-кадра: главный экран приложения на предметном мокапе
 *
 * Исходник — рендер сцены из пака мокапов (телефон на бетонных блоках).
 * Экран приложения кладётся на плоскость телефона проективным
 * преобразованием: обычного масштабирования мало, телефон снят под углом.
 *
 * Углы экрана на рендере подобраны вручную и вынесены в CORNERS —
 * если поменяется сцена, править нужно только их.
 *
 * Запуск: node presentation/compose-hero.js
 * Ожидает исходную сцену в presentation/hero-source.png
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const DIR = __dirname;
const SCENE = path.join(DIR, 'hero-source.png');
const SHOT = path.join(DIR, 'screens', '01-home.png');
const OUT = path.join(DIR, 'hero.png');

/** Размер исходного рендера сцены */
const SCENE_W = 3680;
const SCENE_H = 2760;

/** Ширина готового кадра: больше не нужно, файл и так тяжёлый */
const RENDER_W = 2400;

/**
 * Углы экрана телефона на рендере, по часовой стрелке от левого верхнего.
 * Координаты в пикселях исходного изображения.
 */
const CORNERS = [
  [2112, 604],
  [3016, 893],
  [2244, 2318],
  [1288, 2078],
];

/** Экран мокапа: скриншот плюс полоса статус-бара сверху */
const SW = 390;
const STATUS_H = 46;
const SH = 844 + STATUS_H;

/**
 * Отдаёт файл как data URI
 *
 * @param {string} file - путь к PNG
 * @returns {string} data URI
 */
const dataUri = (file) =>
  'data:image/png;base64,' + fs.readFileSync(file).toString('base64');

/**
 * Собирает страницу композиции
 *
 * @returns {string} HTML
 */
function buildPage() {
  return `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: #fff; }
  #stage { position: relative; width: ${SCENE_W}px; height: ${SCENE_H}px; transform-origin: 0 0; }
  #scene { position: absolute; inset: 0; width: ${SCENE_W}px; height: ${SCENE_H}px; }
  #screen { position: absolute; top: 0; left: 0; width: ${SW}px; height: ${SH}px; transform-origin: 0 0; }
  #screen img { position: absolute; top: ${STATUS_H}px; left: 0; width: ${SW}px; height: 844px; display: block; }
  #status { position: absolute; top: 0; left: 0; width: ${SW}px; height: ${STATUS_H}px; background: #72002F; }
  #island { position: absolute; top: 10px; left: 132px; width: 125px; height: 36px; background: #08070A; border-radius: 18px; }
  #island::after { content: ''; position: absolute; right: 11px; top: 11px; width: 15px; height: 15px; border-radius: 50%; background: #15141A; }
  #clock { position: absolute; top: 14px; left: 27px; font: 600 17px/1 -apple-system, 'Helvetica Neue', Arial; color: #fff; }
  #sig { position: absolute; top: 18px; right: 86px; display: flex; gap: 2px; align-items: flex-end; height: 11px; }
  #sig i { display: block; width: 3px; background: #fff; border-radius: 1px; }
  #wifi { position: absolute; top: 17px; right: 60px; width: 17px; height: 12px; }
  #batt { position: absolute; top: 17px; right: 26px; width: 25px; height: 13px; border: 1.4px solid rgba(255,255,255,.45); border-radius: 4px; }
  #batt::before { content: ''; position: absolute; inset: 1.6px; background: #fff; border-radius: 2px; }
  #batt::after { content: ''; position: absolute; right: -4px; top: 4px; width: 2px; height: 5px; background: rgba(255,255,255,.45); border-radius: 0 2px 2px 0; }
  /* Полоса жеста: низ экрана светлый, поэтому она тёмная */
  #home { position: absolute; bottom: 9px; left: 127px; width: 136px; height: 5px; border-radius: 3px; background: #1A0710; opacity: .5; }
</style>

<div id="stage">
  <img id="scene" src="${dataUri(SCENE)}">
  <div id="screen">
    <img src="${dataUri(SHOT)}">
    <div id="status"></div>
    <div id="clock">9:41</div>
    <div id="sig"><i style="height:4px"></i><i style="height:6px"></i><i style="height:9px"></i><i style="height:11px"></i></div>
    <svg id="wifi" viewBox="0 0 17 12" fill="none">
      <path d="M1 4.2a11 11 0 0 1 15 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <path d="M4.2 7.4a6.4 6.4 0 0 1 8.6 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <circle cx="8.5" cy="10.4" r="1.5" fill="#fff"/>
    </svg>
    <div id="batt"></div>
    <div id="home"></div>
  </div>
</div>

<script>
const CORNERS = ${JSON.stringify(CORNERS)};
const SW = ${SW}, SH = ${SH};

/**
 * Гомография единичного прямоугольника в четырёхугольник
 *
 * @param {Array<Array<number>>} dst - углы назначения
 * @param {number} w - ширина источника
 * @param {number} h - высота источника
 * @returns {Array<number>} коэффициенты для CSS matrix3d
 */
function projectionFor(dst, w, h) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  for (let i = 0; i < 8; i++) {
    let p = i;
    for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = 0; r < 8; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const k = b.map((v, i) => v / A[i][i]);
  const [a, bb, c, d, e, f, g, hh] = k;
  return [a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1];
}

const m = projectionFor(CORNERS, SW, SH);
document.getElementById('screen').style.transform = 'matrix3d(' + m.join(',') + ')';
document.getElementById('stage').style.transform = 'scale(' + (${RENDER_W} / ${SCENE_W}) + ')';
</script>
`;
}

/**
 * Рендерит композицию и сохраняет PNG
 */
async function main() {
  if (!fs.existsSync(SCENE)) {
    console.error('Нет исходной сцены: ' + SCENE);
    console.error('Положите рендер мокапа туда под этим именем.');
    process.exit(1);
  }

  const html = buildPage();
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({
    viewport: { width: RENDER_W, height: Math.round((RENDER_W / SCENE_W) * SCENE_H) },
    deviceScaleFactor: 1,
  });
  await page.goto('http://localhost:' + port, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT, type: 'png' });
  await browser.close();
  server.close();

  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log('hero.png ' + RENDER_W + 'px, ' + kb + ' КБ');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
