/**
 * Адрес страницы AnsSurf в ассетах приложения
 *
 * Страниц две — русская и английская. Язык в сборке AnsSurf зашит в текст,
 * подставить его снаружи нельзя, поэтому выбирается файл целиком.
 *
 * Страница открывается по адресу, а не подставляется строкой: два мегабайта
 * разметки в `source={{ html }}` пришлось бы каждый раз тащить через мост
 * в WebView, и открытие экрана упиралось бы в эту пересылку.
 *
 * Сама страница собирается из поставки разработчика скриптом
 * [`tools/build-anssurf.js`](../tools/build-anssurf.js).
 */

import { Asset } from 'expo-asset';

/** Страницы по языку; ключи совпадают с локалями приложения */
const PAGES = {
  ru: require('../assets/anssurf/gidroizogipsy.html'),
  en: require('../assets/anssurf/gidroizogipsy-en.html'),
};

/**
 * Возвращает адрес страницы для выбранного языка
 *
 * На устройстве ассет сперва выкладывается на диск: в сборке он лежит внутри
 * пакета приложения, и WebView до него сам не дотянется.
 *
 * @param {'ru'|'en'} locale - язык приложения
 * @returns {Promise<string>} адрес страницы
 */
export async function anssurfPageUri(locale) {
  const asset = Asset.fromModule(PAGES[locale] ?? PAGES.ru);
  if (!asset.localUri) await asset.downloadAsync();
  return asset.localUri || asset.uri;
}
