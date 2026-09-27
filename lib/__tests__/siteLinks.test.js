/**
 * Ссылки на сайт по языку интерфейса
 *
 * У сайта две версии: русская лежит в /Ru/, английская — в корне. Раньше все
 * кнопки вели в корень, и русскоязычный пользователь попадал на английский
 * сайт.
 */

import { orderUrl, siteUrl } from '../siteLinks';

test('русский интерфейс ведёт на русский сайт', () => {
  expect(siteUrl('ru')).toBe('https://ansdimat.com/Ru/');
});

test('английский интерфейс ведёт на английский сайт', () => {
  expect(siteUrl('en')).toBe('https://ansdimat.com/');
});

test('тарифы — на странице заказа своего языка', () => {
  expect(orderUrl('ru')).toBe('https://ansdimat.com/Ru/order/');
  expect(orderUrl('en')).toBe('https://ansdimat.com/order.shtml');
});

test('незнакомый язык получает английскую версию', () => {
  expect(siteUrl('de')).toBe('https://ansdimat.com/');
  expect(siteUrl(undefined)).toBe('https://ansdimat.com/');
});
