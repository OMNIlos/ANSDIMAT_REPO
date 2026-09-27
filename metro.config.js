/**
 * Конфигурация Metro
 *
 * expo-sqlite в веб-сборке работает через wa-sqlite, скомпилированный
 * в WebAssembly. Metro по умолчанию не считает `.wasm` ассетом и падает
 * на резолве — расширение нужно добавить явно.
 *
 * `.html` — по той же причине: построитель карт AnsSurf лежит в
 * `assets/anssurf/` готовой страницей и открывается в WebView по адресу
 * файла. Без этого расширения Metro пытается разобрать два мегабайта
 * разметки как модуль.
 */

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm', 'html');

module.exports = config;
