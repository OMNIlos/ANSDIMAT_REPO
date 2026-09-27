/**
 * Переключатели раздела «Данные и расчёты» — общее хранилище
 *
 * Настройки лежали в базе, экран настроек их писал, но ни один экран их не
 * читал: тумблер «Адаптация под планшет» или «Автоопределение координат»
 * щёлкал и ничего не менял. Здесь они читаются один раз при запуске и
 * раздаются подпиской — как видимость меню в components/chromeVisibility.js:
 * экрану не нужен свой запрос к базе, а переключение в настройках сразу
 * видно на всех открытых экранах.
 */

import { useSyncExternalStore } from 'react';
import { getSettings, setSetting } from '../db/settings';
import { DEFAULT_SETTINGS } from '../db/schema';

let prefs = {
  tablet: DEFAULT_SETTINGS.tablet,
  autoLocation: DEFAULT_SETTINGS.autoLocation,
  tabularNums: DEFAULT_SETTINGS.tabularNums,
};
let loading = null;
const listeners = new Set();

function publish(patch) {
  prefs = { ...prefs, ...patch };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = () => prefs;

/**
 * Читает переключатели из базы — один раз за запуск
 *
 * @returns {Promise<void>} готово, когда значения прочитаны
 */
export function loadPrefs() {
  loading =
    loading ??
    getSettings()
      .then((stored) =>
        publish({
          tablet: stored.tablet,
          autoLocation: stored.autoLocation,
          tabularNums: stored.tabularNums,
        })
      )
      .catch(() => {
        // База недоступна — остаются значения по умолчанию
      });
  return loading;
}

/**
 * Меняет переключатель: сразу на экранах, затем в базе
 *
 * @param {'tablet'|'autoLocation'|'tabularNums'} key - переключатель
 * @param {boolean} value - новое значение
 */
export function setPref(key, value) {
  publish({ [key]: value });
  setSetting(key, value).catch(() => {});
}

/**
 * Текущие значения переключателей
 *
 * @returns {{tablet: boolean, autoLocation: boolean, tabularNums: boolean}}
 */
export function usePrefs() {
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Предел ширины колонки содержимого с учётом «Адаптации под планшет»
 *
 * Включена — на широком экране содержимое стоит удобной колонкой по центру;
 * выключена — занимает всю ширину окна.
 *
 * @param {number} maxWidth - ширина колонки экрана, px
 * @returns {number|undefined} предел или undefined, если предела нет
 */
export function useContentMaxWidth(maxWidth) {
  const { tablet } = usePrefs();
  return tablet ? maxWidth : undefined;
}
