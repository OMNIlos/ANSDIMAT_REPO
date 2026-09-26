/**
 * Адреса сайта АНСДИМАТ по языку интерфейса
 *
 * У сайта две версии: русская лежит в /Ru/, английская — в корне домена.
 * Раньше «Версия для Windows», ссылка в справке и кнопка на экране контактов
 * вели в корень, и русскоязычный пользователь попадал на английский сайт.
 * Адреса собраны здесь, чтобы эти кнопки не разошлись снова.
 */

const SITE = {
  ru: 'https://ansdimat.com/Ru/',
  en: 'https://ansdimat.com/',
};

/** Тарифы и заказ лицензии */
const ORDER = {
  ru: 'https://ansdimat.com/Ru/order/',
  en: 'https://ansdimat.com/order.shtml',
};

/**
 * Язык, для которого у сайта есть версия
 *
 * Русская версия одна, всё остальное — английская: так же выбирается и язык
 * самого приложения (см. LanguageContext.js).
 *
 * @param {string} [locale] - язык интерфейса
 * @returns {'ru'|'en'} версия сайта
 */
function siteLanguage(locale) {
  return locale === 'ru' ? 'ru' : 'en';
}

/**
 * Главная страница сайта
 *
 * @param {string} [locale] - язык интерфейса
 * @returns {string} адрес
 */
export function siteUrl(locale) {
  return SITE[siteLanguage(locale)];
}

/**
 * Страница тарифов и заказа лицензии
 *
 * @param {string} [locale] - язык интерфейса
 * @returns {string} адрес
 */
export function orderUrl(locale) {
  return ORDER[siteLanguage(locale)];
}
