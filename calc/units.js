/**
 * Размерности величин и перевод между ними
 *
 * Внутри приложение считает в одних и тех же единицах, а выбор пользователя
 * действует только на границе: введённое переводится в базовую единицу перед
 * расчётом, результат — обратно перед показом. Так устроен и настольный
 * АНСДИМАТ: «в дальнейшем при обработке программа использует только
 * фиксированные размерности, автоматически преобразуя введённые данные».
 *
 * Иначе смена единицы в настройках меняла бы смысл уже введённых замеров:
 * в базе лежит число, а не число с подписью.
 *
 * Факторы переводят ИЗ базовой единицы В целевую:
 *   значение_в_единице = значение_в_базовой × factor
 *
 * Базовые единицы совпадают с теми, в которых написаны расчёты в `calc/`
 * и хранятся данные: время — минуты, длина — метры, расход — м³/сут.
 */

/** Футов в метре */
const FT_PER_M = 3.280839895;
/** Квадратных футов в квадратном метре */
const SQFT_PER_SQM = FT_PER_M * FT_PER_M;
/** Американских галлонов в кубометре */
const GAL_PER_M3 = 264.1720523581;
/** Секунд в сутках */
const SEC_PER_DAY = 86400;
/** Минут в сутках */
const MIN_PER_DAY = 1440;
/** Квадратных метров в гектаре */
const SQM_PER_HA = 10000;
/** Квадратных метров в квадратном километре */
const SQM_PER_KM2 = 1e6;

/**
 * Минут в сутках — наружу
 *
 * Базовая единица времени в приложении — минута (в ней ведутся журналы ОФР),
 * а формулы прогноза в калькуляторе написаны для суток. Коэффициент нужен им,
 * чтобы не заводить второй набор размерностей.
 */
export const MINUTES_PER_DAY = MIN_PER_DAY;

/** Величины, для которых пользователь выбирает размерность */
export const QUANTITIES = {
  TIME: 'time',
  DISTANCE: 'distance',
  FLOW: 'flow',
  TRANSMISSIVITY: 'transmissivity',
  CONDUCTIVITY: 'conductivity',
  DIFFUSIVITY: 'diffusivity',
  DRAWDOWN: 'drawdown',
  AREA: 'area',
};

/**
 * Размерности по величинам
 *
 * Первое поле `base` — единица, в которой ведутся расчёты и хранение;
 * у неё factor = 1. `default` — что стоит в приложении при первом запуске.
 */
export const UNITS = {
  [QUANTITIES.TIME]: {
    labelKey: 'quantityTime',
    base: 'min',
    default: 'min',
    options: [
      { key: 'day', labelKey: 'unitDays', factor: 1 / MIN_PER_DAY },
      { key: 'hour', labelKey: 'unitHours', factor: 1 / 60 },
      { key: 'min', labelKey: 'unitMinutes', factor: 1 },
    ],
  },
  [QUANTITIES.DISTANCE]: {
    labelKey: 'quantityDistance',
    base: 'm',
    default: 'm',
    options: [
      { key: 'm', labelKey: 'unitMeters', factor: 1 },
      { key: 'ft', labelKey: 'unitFeet', factor: FT_PER_M },
    ],
  },
  [QUANTITIES.FLOW]: {
    labelKey: 'quantityFlow',
    base: 'm3_day',
    default: 'm3_day',
    options: [
      { key: 'l_sec', labelKey: 'unitLSec', factor: 1000 / SEC_PER_DAY },
      { key: 'm3_day', labelKey: 'unitFlowRate', factor: 1 },
      { key: 'm3_hour', labelKey: 'unitM3Hour', factor: 1 / 24 },
      { key: 'gal_min', labelKey: 'unitGalMin', factor: GAL_PER_M3 / MIN_PER_DAY },
      { key: 'ft3_day', labelKey: 'unitFt3Day', factor: SQFT_PER_SQM * FT_PER_M },
    ],
  },
  [QUANTITIES.TRANSMISSIVITY]: {
    labelKey: 'quantityTransmissivity',
    base: 'm2_day',
    default: 'm2_day',
    options: [
      { key: 'm2_day', labelKey: 'unitTransmissivity', factor: 1 },
      { key: 'ft2_day', labelKey: 'unitFt2Day', factor: SQFT_PER_SQM },
      { key: 'gal_day_ft', labelKey: 'unitGalDayFt', factor: GAL_PER_M3 / FT_PER_M },
    ],
  },
  [QUANTITIES.CONDUCTIVITY]: {
    labelKey: 'quantityConductivity',
    base: 'm_day',
    default: 'm_day',
    options: [
      { key: 'm_day', labelKey: 'unitMDay', factor: 1 },
      { key: 'm_sec', labelKey: 'unitMSecond', factor: 1 / SEC_PER_DAY },
      { key: 'ft_day', labelKey: 'unitFootDay', factor: FT_PER_M },
      { key: 'cm_sec', labelKey: 'unitCmSecond', factor: 100 / SEC_PER_DAY },
      { key: 'gal_day_ft2', labelKey: 'unitGalDayFt2', factor: GAL_PER_M3 / SQFT_PER_SQM },
    ],
  },
  [QUANTITIES.DIFFUSIVITY]: {
    labelKey: 'quantityDiffusivity',
    base: 'm2_day',
    default: 'm2_day',
    options: [
      { key: 'm2_day', labelKey: 'unitTransmissivity', factor: 1 },
      { key: 'm2_sec', labelKey: 'unitM2Sec', factor: 1 / SEC_PER_DAY },
      { key: 'ft2_day', labelKey: 'unitFt2Day', factor: SQFT_PER_SQM },
    ],
  },
  [QUANTITIES.DRAWDOWN]: {
    labelKey: 'quantityDrawdown',
    base: 'm',
    default: 'm',
    options: [
      { key: 'm', labelKey: 'unitMeters', factor: 1 },
      { key: 'ft', labelKey: 'unitFeet', factor: FT_PER_M },
    ],
  },
  // Площадь спрашивают только в расчёте притока в котлован: там задают
  // размер выработки. Гектары и квадратные километры нужны карьерам —
  // в квадратных метрах их площадь читается плохо.
  [QUANTITIES.AREA]: {
    labelKey: 'quantityArea',
    base: 'm2',
    default: 'm2',
    options: [
      { key: 'm2', labelKey: 'unitM2', factor: 1 },
      { key: 'ha', labelKey: 'unitHectare', factor: 1 / SQM_PER_HA },
      { key: 'km2', labelKey: 'unitKm2', factor: 1 / SQM_PER_KM2 },
      { key: 'ft2', labelKey: 'unitFt2', factor: SQFT_PER_SQM },
    ],
  },
};

/** Размерности по умолчанию: то, что стоит в приложении до правки настроек */
export const DEFAULT_UNITS = Object.fromEntries(
  Object.entries(UNITS).map(([quantity, spec]) => [quantity, spec.default])
);

/**
 * Находит описание выбранной размерности
 *
 * Неизвестный ключ (настройка из будущей версии, повреждённое значение)
 * не должен ронять расчёт: возвращается размерность по умолчанию.
 *
 * @param {string} quantity - величина, см. QUANTITIES
 * @param {string} unitKey - ключ размерности
 * @returns {Object|undefined} описание размерности
 */
export function resolveUnit(quantity, unitKey) {
  const spec = UNITS[quantity];
  if (!spec) return undefined;
  return (
    spec.options.find((option) => option.key === unitKey) ||
    spec.options.find((option) => option.key === spec.default)
  );
}

/**
 * Переводит введённое значение в базовую единицу
 *
 * @param {number} value - значение в выбранной пользователем размерности
 * @param {string} quantity - величина, см. QUANTITIES
 * @param {string} unitKey - ключ размерности
 * @returns {number} значение в базовой единице; NaN, если значение не число
 */
export function toBase(value, quantity, unitKey) {
  const unit = resolveUnit(quantity, unitKey);
  if (!unit || !isFinite(value)) return NaN;
  return value / unit.factor;
}

/**
 * Переводит значение из базовой единицы в выбранную пользователем
 *
 * @param {number} value - значение в базовой единице
 * @param {string} quantity - величина, см. QUANTITIES
 * @param {string} unitKey - ключ размерности
 * @returns {number} значение в выбранной размерности; NaN, если не число
 */
export function fromBase(value, quantity, unitKey) {
  const unit = resolveUnit(quantity, unitKey);
  if (!unit || !isFinite(value)) return NaN;
  return value * unit.factor;
}

/**
 * Единицы коэффициента фильтрации для вкладки-конвертера
 *
 * Отдельный, более широкий список: на вкладке «Коэф. фильтрации» значение
 * показывается сразу во всех единицах, и сузить её до пяти размерностей из
 * настроек значило бы убрать у пользователя половину пересчётов.
 *
 * Базовая единица — м/сут, факторы переводят из м/сут в целевую единицу.
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
