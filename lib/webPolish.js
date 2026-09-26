/**
 * Веб-обвязка оформления — нативная заглушка
 *
 * Настоящая реализация в `webPolish.web.js`: она правит то, что есть только в
 * браузере, — грани начертаний, кольцо фокуса, фон документа. На телефоне
 * шрифт выбирается по имени семейства, и ждать здесь нечего.
 */

/**
 * @param {boolean} fontsLoaded - expo-font закончил загрузку
 * @returns {boolean} всегда true: на нативе дополнительных граней нет
 */
export function useWebFontFaces(fontsLoaded) {
  return true;
}

/** На нативе глобальных стилей нет */
export function installWebGlobalStyles() {}

/** На нативе фон документа не существует */
export function syncWebSurface() {}
