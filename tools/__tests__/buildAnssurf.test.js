/**
 * Сборка встраиваемого AnsSurf
 *
 * Поставка — чужой минифицированный бандл, и правки в него вносятся по
 * меткам. Пропавшая метка обязана ронять сборку, а не молча оставлять на
 * телефоне подсказку про правую кнопку мыши.
 */

const fs = require('fs');
const path = require('path');
const { TOUCH_HINTS, COARSE_POINTER, adaptTouchHints } = require('../build-anssurf');

const ASSETS = path.join(__dirname, '..', '..', 'assets', 'anssurf');

/**
 * Кусок бандла с подсказками — в том виде, в каком их отдаёт поставка
 *
 * @param {string} name - имя страницы
 * @returns {string} разметка
 */
const bundle = (name) =>
  TOUCH_HINTS[name].map(([mouse]) => `children:\`${mouse}\``).join(',');

test('подсказка про мышь на сенсорном экране сменяется подсказкой про касание', () => {
  const out = adaptTouchHints(bundle('gidroizogipsy.html'), 'gidroizogipsy.html');

  for (const [mouse, touch] of TOUCH_HINTS['gidroizogipsy.html']) {
    expect(out).toContain(`(${COARSE_POINTER}?\`${touch}\`:\`${mouse}\`)`);
  }
});

test('пропавшая подсказка роняет сборку', () => {
  expect(() => adaptTouchHints('<html></html>', 'gidroizogipsy.html')).toThrow(
    'поставка AnsSurf изменилась'
  );
});

test('подсказка, встреченная дважды, роняет сборку', () => {
  const twice = `${bundle('gidroizogipsy-en.html')},${bundle('gidroizogipsy-en.html')}`;

  expect(() => adaptTouchHints(twice, 'gidroizogipsy-en.html')).toThrow(
    'поставка AnsSurf изменилась'
  );
});

describe('собранные страницы', () => {
  for (const name of Object.keys(TOUCH_HINTS)) {
    test(`${name}: подсказки для касания и правила скина на месте`, () => {
      const html = fs.readFileSync(path.join(ASSETS, name), 'utf8');

      for (const [, touch] of TOUCH_HINTS[name]) {
        expect(html).toContain(touch);
      }
      expect(html).toContain('.hydro-map-pane:has(.hydro-well-modal-bg)');
      expect(html).toContain('scrollbar-width: none');
    });
  }
});
