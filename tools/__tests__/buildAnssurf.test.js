/**
 * Сборка встраиваемого AnsSurf
 *
 * Поставка — чужой минифицированный бандл, и правки в него вносятся по
 * меткам. Пропавшая метка обязана ронять сборку, а не молча оставлять на
 * телефоне подсказку про правую кнопку мыши или меню за краем экрана.
 */

const fs = require('fs');
const path = require('path');
const {
  PAGE_TEXT,
  SOURCE_PATCHES,
  replaceOnce,
  patchPage,
  addHostScript,
} = require('../build-anssurf');

const ASSETS = path.join(__dirname, '..', '..', 'assets', 'anssurf');

/**
 * Кусок бандла, где каждая правка встречается ровно по разу
 *
 * @param {string} name - имя страницы
 * @returns {string} разметка
 */
const bundle = (name) =>
  [...PAGE_TEXT[name], ...SOURCE_PATCHES].map(([from]) => `children:${from}`).join(',');

test('правка встаёт на место метки', () => {
  expect(replaceOnce('a `x` b', '`x`', '`y`')).toBe('a `y` b');
});

test('пропавшая метка роняет сборку', () => {
  expect(() => replaceOnce('<html></html>', '`x`', '`y`')).toThrow(
    'поставка AnsSurf изменилась'
  );
});

test('метка, встреченная дважды, роняет сборку', () => {
  expect(() => replaceOnce('`x` `x`', '`x`', '`y`')).toThrow('поставка AnsSurf изменилась');
});

test('знак доллара в замене не портит разметку', () => {
  // String.replace трактует $& и $1 в строке замены особо
  expect(replaceOnce('a `x` b', '`x`', '`$&`')).toBe('a `$&` b');
});

test('все правки страницы применяются', () => {
  for (const name of Object.keys(PAGE_TEXT)) {
    const out = patchPage(bundle(name), name);
    for (const [from, to] of [...PAGE_TEXT[name], ...SOURCE_PATCHES]) {
      expect(out).toContain(to);
      expect(out).not.toContain(`children:${from},`);
    }
  }
});

test('подсказки больше не упоминают правую кнопку мыши', () => {
  // Нажатие на карту работает и пальцем, и мышью: подсказка должна быть
  // верна для обоих, а не только для компьютера
  for (const name of Object.keys(PAGE_TEXT)) {
    for (const [, to] of PAGE_TEXT[name]) {
      expect(to).not.toMatch(/правая кнопка|right-click/i);
    }
  }
});

test('скрипт приложения встаёт первым в <head>', () => {
  const html = '<html><head><script>страница</script></head></html>';
  const out = addHostScript(html, 'window.__host = 1;');

  expect(out.indexOf('window.__host = 1;')).toBeLessThan(out.indexOf('страница'));
});

test('скрипт с закрывающим тегом внутри не встраивается', () => {
  expect(() => addHostScript('<head></head>', 'a = "</script>";')).toThrow('</script>');
});

describe('собранные страницы', () => {
  const host = fs.readFileSync(path.join(__dirname, '..', 'anssurf-host.js'), 'utf8');

  for (const name of Object.keys(PAGE_TEXT)) {
    test(`${name}: правки, скрипт приложения и скин на месте`, () => {
      const html = fs.readFileSync(path.join(ASSETS, name), 'utf8');
      const expected = [
        ...[...PAGE_TEXT[name], ...SOURCE_PATCHES].map(([, to]) => to),
        host.trim(),
        '.hydro-map-pane:has(.leaflet-container)',
        'scrollbar-width: none',
      ];

      // Список пропавшего, а не toContain: при сбое toContain печатает всю
      // страницу на два мегабайта
      expect(expected.filter((part) => !html.includes(part))).toEqual([]);
      // Прежняя развилка по типу указателя: в узком окне браузера с мышью
      // она оставляла подсказку про правую кнопку и полосы прокрутки
      expect(html.includes('matchMedia("(pointer: coarse)")')).toBe(false);
    });
  }
});
