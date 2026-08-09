/**
 * Renders the vector application map to a 4K PNG for slide decks.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright-core');

const chromePath =
  process.env.CHROME_PATH ||
  '/Users/ilagulakin/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const source = path.join(__dirname, 'ANSDIMAT-app-map.svg');
const output = path.join(__dirname, 'ANSDIMAT-app-map.png');

async function render() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });

  await page.goto(pathToFileURL(source).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output, fullPage: false });
  await browser.close();
  console.log(output);
}

render().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
