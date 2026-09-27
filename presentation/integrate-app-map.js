/**
 * Appends the existing ANSDIMAT app map to an SVG case presentation.
 *
 * The source presentation is nested byte-for-byte inside a new outer SVG.
 * The app map is inserted immediately before the footer. The footer is then
 * repeated from the untouched source through <use> and moved to the new end.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [sourcePath, graphPath, outputPath] = process.argv.slice(2);

if (!sourcePath || !graphPath || !outputPath) {
  console.error('Usage: node integrate-app-map.js <source.svg> <graph.svg> <output.svg>');
  process.exit(1);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const graph = fs.readFileSync(graphPath, 'utf8');

// Атрибуты корневого <svg> идут в разном порядке в зависимости от сборщика,
// поэтому размеры читаются из файла, а не сверяются с записанной в скрипте
// строкой: раньше добавление xmlns в начало тега ломало сшивку
const sourceRoot = source.match(/^<svg[^>]*\bwidth="1440"[^>]*>[\s\S]*<\/svg>\s*$/);
const sourceHeightMatch = source.match(/^<svg[^>]*\bheight="(\d+)"/);
const graphRoot = graph.match(
  /^<svg[^>]*width="1920"[^>]*height="1080"[^>]*viewBox="0 0 1920 1080"[^>]*>[\s\S]*<\/svg>\s*$/
);

if (!sourceRoot || !sourceHeightMatch) {
  throw new Error('Unexpected source SVG dimensions or root structure');
}
if (!graphRoot) {
  throw new Error('Unexpected app map SVG dimensions or root structure');
}

const sourceHash = crypto.createHash('sha256').update(source).digest('hex');

// Prefix the graph-local style hooks to avoid affecting the source document.
const isolatedGraph = graph
  .replaceAll('id="arrow"', 'id="ansdimat-app-map-arrow"')
  .replaceAll('url(#arrow)', 'url(#ansdimat-app-map-arrow)')
  .replaceAll('class="connector"', 'class="ansdimat-app-map-connector"')
  .replaceAll('.connector {', '.ansdimat-app-map-connector {');

const originalHeight = Number(sourceHeightMatch[1]);
// Подвал занимает нижние 201 px презентации, ниже вставляется карта приложения
const FOOTER_HEIGHT = 201;
const MAP_SECTION_HEIGHT = 899;
const footerStart = originalHeight - FOOTER_HEIGHT;
const outputHeight = originalHeight + MAP_SECTION_HEIGHT;
const footerOffset = outputHeight - originalHeight;
const mapX = 28;
const mapY = footerStart - 30;
const mapScale = 0.72;

const integrated = `<svg width="1440" height="${outputHeight}" viewBox="0 0 1440 ${outputHeight}" fill="none"
  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <clipPath id="ansdimat-footer-clip">
      <rect x="0" y="${footerStart + footerOffset}" width="1440" height="${originalHeight - footerStart}"/>
    </clipPath>
  </defs>
  <rect width="1440" height="${outputHeight}" fill="white"/>

  <!-- Original presentation: preserved byte-for-byte. -->
  <g id="ansdimat-original-presentation">
    ${source}
  </g>

  <!-- Clear the original footer area and the added section below it. -->
  <rect x="0" y="${footerStart}" width="1440" height="${outputHeight - footerStart}" fill="white"/>

  <!-- App map: isolated addition before the footer. -->
  <g id="ansdimat-app-map-section" aria-label="App map"
    transform="translate(${mapX} ${mapY}) scale(${mapScale})">
    ${isolatedGraph}
  </g>

  <!-- Original footer: reproduced unchanged and moved to the new end. -->
  <g clip-path="url(#ansdimat-footer-clip)">
    <use href="#ansdimat-original-presentation" xlink:href="#ansdimat-original-presentation"
      transform="translate(0 ${footerOffset})"/>
  </g>
</svg>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, integrated);

const sourceAfter = fs.readFileSync(sourcePath, 'utf8');
const sourceHashAfter = crypto.createHash('sha256').update(sourceAfter).digest('hex');

if (sourceHashAfter !== sourceHash) {
  throw new Error('Source presentation changed during integration');
}

console.log(JSON.stringify({
  source: sourcePath,
  output: outputPath,
  sourceHash,
  originalHeight,
  outputHeight,
  footer: { start: footerStart, offset: footerOffset },
  map: { x: mapX, y: mapY, scale: mapScale },
}, null, 2));
