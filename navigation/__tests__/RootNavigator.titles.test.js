/**
 * Заголовки экранов переведены на оба языка
 *
 * Localization.js включает запасной язык: забытая английская строка не
 * падает, а тихо показывается по-русски. Так заголовок «Контакты» годами
 * стоял русским в английском интерфейсе — ключа не было ни в одном блоке.
 */

import fs from 'fs';
import path from 'path';
import I18n from '../../Localization';

const source = fs.readFileSync(path.join(__dirname, '..', 'RootNavigator.js'), 'utf8');
const titleKeys = [...new Set([...source.matchAll(/I18n\.t\('([A-Za-z0-9_]+)'/g)].map((m) => m[1]))];

test('в навигаторе есть заголовки для проверки', () => {
  expect(titleKeys.length).toBeGreaterThan(10);
});

test.each(['ru', 'en'])('у каждого заголовка экрана есть строка на языке %s', (locale) => {
  const missing = titleKeys.filter((key) => typeof I18n.translations[locale]?.[key] !== 'string');

  expect(missing).toEqual([]);
});
