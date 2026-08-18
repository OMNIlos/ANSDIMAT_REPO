/**
 * Показывать ли плавающее меню приложения
 *
 * Меню живёт в корне приложения и висит поверх любого экрана. Экрану, который
 * разворачивает содержимое на весь экран, оно мешает: закрывает низ и отнимает
 * высоту у того, ради чего разворот и нажат. Прокинуть признак пропсами
 * неоткуда — между экраном и меню лежит весь навигатор.
 *
 * Поэтому отдельное крошечное хранилище: экран говорит «спрятать», меню
 * слушает. Контекст здесь был бы тяжелее — он потребовал бы провайдера в
 * корне и перерисовывал бы поддерево на каждое переключение.
 */

import { useSyncExternalStore } from 'react';

let hidden = false;
const listeners = new Set();

/**
 * Прячет или показывает плавающее меню
 *
 * @param {boolean} next - спрятать ли меню
 */
export function setMenuHidden(next) {
  if (hidden === next) return;
  hidden = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = () => hidden;

/**
 * Спрятано ли сейчас плавающее меню
 *
 * @returns {boolean} верно, если меню показывать не нужно
 */
export function useMenuHidden() {
  return useSyncExternalStore(subscribe, read, read);
}
