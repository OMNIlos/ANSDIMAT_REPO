/**
 * Контекст размерностей
 *
 * Держит выбор пользователя и даёт экранам перевод «введённое ↔ базовое».
 * Расчёты в `calc/` и данные в базе всегда в базовых единицах: время в
 * минутах, длина в метрах, расход в м³/сут. Настройка действует только на
 * границе ввода и вывода — иначе смена единицы задним числом меняла бы смысл
 * уже сохранённых замеров.
 *
 * Хранится одним ключом `units` в настройках: состав величин меняется
 * вместе с расчётами, и заводить под каждую свою строку в таблице незачем.
 */

import React from 'react';
import I18n from './Localization';
import {
  DEFAULT_UNITS,
  UNITS,
  QUANTITIES,
  resolveUnit,
  toBase as convertToBase,
  fromBase as convertFromBase,
} from './calc/units';
import { getSettings, setSetting } from './db/settings';

export const UnitsContext = React.createContext({
  units: DEFAULT_UNITS,
  setUnit: () => {},
  unitLabel: () => '',
  toBase: (value) => value,
  fromBase: (value) => value,
});

export const UnitsProvider = ({ children }) => {
  const [units, setUnits] = React.useState(DEFAULT_UNITS);

  React.useEffect(() => {
    getSettings()
      // Настройка из старой версии может не знать про часть величин:
      // недостающие добираем значениями по умолчанию, а не оставляем пустыми
      .then((settings) => setUnits({ ...DEFAULT_UNITS, ...(settings.units ?? {}) }))
      .catch(() => {});
  }, []);

  /**
   * Меняет размерность одной величины
   *
   * @param {string} quantity - величина, см. QUANTITIES
   * @param {string} unitKey - ключ выбранной размерности
   */
  const setUnit = React.useCallback((quantity, unitKey) => {
    setUnits((prev) => {
      const next = { ...prev, [quantity]: unitKey };
      setSetting('units', next).catch(() => {});
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      units,
      setUnit,

      /**
       * Подпись текущей размерности величины
       *
       * @param {string} quantity - величина, см. QUANTITIES
       * @returns {string} например «м³/сут»
       */
      unitLabel: (quantity) => {
        const unit = resolveUnit(quantity, units[quantity]);
        return unit ? I18n.t(unit.labelKey) : '';
      },

      /**
       * Переводит введённое пользователем значение в базовую единицу
       *
       * @param {number} value - значение в выбранной размерности
       * @param {string} quantity - величина, см. QUANTITIES
       * @returns {number} значение в базовой единице
       */
      toBase: (value, quantity) => convertToBase(value, quantity, units[quantity]),

      /**
       * Переводит рассчитанное значение в выбранную пользователем размерность
       *
       * @param {number} value - значение в базовой единице
       * @param {string} quantity - величина, см. QUANTITIES
       * @returns {number} значение в выбранной размерности
       */
      fromBase: (value, quantity) => convertFromBase(value, quantity, units[quantity]),
    }),
    [units, setUnit]
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
};

/**
 * Доступ к размерностям из экрана
 *
 * @returns {Object} units, setUnit, unitLabel, toBase, fromBase
 */
export function useUnits() {
  return React.useContext(UnitsContext);
}

export { QUANTITIES, UNITS };
