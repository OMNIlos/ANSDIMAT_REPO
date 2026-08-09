/**
 * Конфигурация Metro
 *
 * expo-sqlite в веб-сборке работает через wa-sqlite, скомпилированный
 * в WebAssembly. Metro по умолчанию не считает `.wasm` ассетом и падает
 * на резолве — расширение нужно добавить явно.
 */

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
