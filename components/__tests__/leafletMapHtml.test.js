/**
 * HTML карты на Leaflet
 *
 * Карта дневника и зоны санитарной охраны работает в поле, где сети часто
 * нет. Раньше Leaflet подключался с unpkg.com, и без сети вместо карты
 * оставался серый прямоугольник.
 */

import { buildMapHtml } from '../leafletMapHtml';
import { LEAFLET_CSS, LEAFLET_JS } from '../leafletAssets';

test('Leaflet встроен в документ, а не подключается из сети', () => {
  const html = buildMapHtml();

  expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
  expect(html).not.toMatch(/<link[^>]*stylesheet/i);
  // includes, а не toContain: при сбое toContain печатал бы 160 КБ Leaflet
  expect(html.includes(LEAFLET_JS)).toBe(true);
  expect(html.includes(LEAFLET_CSS)).toBe(true);
});

test('встроенный текст не закрывает свой тег раньше времени', () => {
  expect(/<\/script/i.test(LEAFLET_JS)).toBe(false);
  expect(/<\/style/i.test(LEAFLET_CSS)).toBe(false);
});
