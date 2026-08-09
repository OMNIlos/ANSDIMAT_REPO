/**
 * Ссылка на корневой навигатор
 *
 * Нужна элементам, которые живут вне экранов — например, плавающему нижнему
 * меню: оно отрисовано поверх всей навигации, поэтому не может получить
 * navigation через useNavigation().
 */

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Переходит на экран корневого навигатора
 *
 * @param {string} name - имя маршрута
 * @param {Object} [params] - параметры маршрута
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

/**
 * Открывает боковое меню
 */
export function openDrawer() {
  if (navigationRef.isReady()) {
    navigationRef.dispatch({ type: 'OPEN_DRAWER' });
  }
}
