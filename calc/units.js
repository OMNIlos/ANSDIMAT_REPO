/**
 * Единицы коэффициента фильтрации
 *
 * Базовая единица — м/сут. Факторы переводят из м/сут в целевую единицу:
 *   значение_в_единице = значение_в_м_сут × factor
 *
 * Единица Мейнцера (Meinzer unit) — американская внесистемная единица
 * проницаемости: 1 гал/сут на фут² при градиенте 1 фут/фут.
 * 1 мейнцер = 0.0407458 м/сут, поэтому обратный фактор 1/0.0407458 = 24.5424.
 */

export const FILTRATION_UNITS = [
  { key: 'm_day', labelKey: 'unitMDay', factor: 1 },
  { key: 'm_hour', labelKey: 'unitMHour', factor: 1 / 24 },
  { key: 'm_sec', labelKey: 'unitMSec', factor: 1 / 86400 },
  { key: 'cm_day', labelKey: 'unitCmDay', factor: 100 },
  { key: 'cm_sec', labelKey: 'unitCmSec', factor: 100 / 86400 },
  { key: 'mm_day', labelKey: 'unitMmDay', factor: 1000 },
  { key: 'ft_day', labelKey: 'unitFtDay', factor: 3.280839895 },
  { key: 'ft_sec', labelKey: 'unitFtSec', factor: 3.280839895 / 86400 },
  { key: 'meinzer', labelKey: 'unitMeinzer', factor: 24.542387 },
];

/**
 * Находит единицу по ключу
 *
 * @param {string} key - ключ единицы
 * @returns {Object|undefined} описание единицы
 */
export function getUnit(key) {
  return FILTRATION_UNITS.find((unit) => unit.key === key);
}

/**
 * Переводит значение из указанной единицы в м/сут
 *
 * @param {number} value - значение в исходной единице
 * @param {string} unitKey - ключ исходной единицы
 * @returns {number} значение в м/сут; NaN при неизвестной единице
 */
export function toMetersPerDay(value, unitKey) {
  const unit = getUnit(unitKey);
  if (!unit || !isFinite(value)) return NaN;
  return value / unit.factor;
}

/**
 * Переводит значение из м/сут в указанную единицу
 *
 * @param {number} valueMDay - значение в м/сут
 * @param {string} unitKey - ключ целевой единицы
 * @returns {number} значение в целевой единице; NaN при неизвестной единице
 */
export function fromMetersPerDay(valueMDay, unitKey) {
  const unit = getUnit(unitKey);
  if (!unit || !isFinite(valueMDay)) return NaN;
  return valueMDay * unit.factor;
}

/**
 * Пересчитывает значение по всем единицам сразу
 *
 * Используется на вкладке «Коэф. фильтрации»: пользователь вводит значение
 * в одной единице и сразу видит его во всех остальных.
 *
 * @param {number} value - введённое значение
 * @param {string} unitKey - ключ единицы введённого значения
 * @returns {Array<{key: string, labelKey: string, value: number}>} значения по всем единицам
 */
export function convertToAllUnits(value, unitKey) {
  const baseValue = toMetersPerDay(value, unitKey);
  return FILTRATION_UNITS.map((unit) => ({
    key: unit.key,
    labelKey: unit.labelKey,
    value: isFinite(baseValue) ? baseValue * unit.factor : NaN,
  }));
}
