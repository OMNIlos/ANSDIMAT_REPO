/**
 * Справочники фильтрационных параметров типовых грунтов
 *
 * Два разных набора, а не один общий. Расчёту притока в котлован нужен только
 * коэффициент фильтрации, и его список построен под водопонижение. Расчёту
 * понижения от водозабора нужны ещё водоотдача и упругая ёмкость, и его список
 * взят из справочника ANSDIMAT ParaBase и AQTESOLV. Объединить их значило бы
 * подставлять в котлован параметры, которых там не спрашивают, а в водозабор —
 * породы без водоотдачи.
 *
 * Третий набор — для зоны санитарной охраны: там кроме проницаемости нужна
 * активная пористость, и справочник взят иностранный (Domenico & Schwartz).
 *
 * Значения совпадают с веб-калькуляторами АНСДИМАТ: они служат подсказкой на
 * этапе прикидки, когда своих опытных данных ещё нет.
 */

/**
 * Грунты для расчёта притока в котлован
 *
 * `k` — коэффициент фильтрации, м/сут.
 */
export const PIT_LITHOLOGY = [
  { id: 'clay', labelKey: 'lithoClay', k: 0.001 },
  { id: 'loam', labelKey: 'lithoLoam', k: 0.05 },
  { id: 'sandyLoam', labelKey: 'lithoSandyLoam', k: 0.5 },
  { id: 'fineSand', labelKey: 'lithoFineSand', k: 3 },
  { id: 'mediumSand', labelKey: 'lithoMediumSand', k: 10 },
  { id: 'coarseSand', labelKey: 'lithoCoarseSand', k: 30 },
  { id: 'gravel', labelKey: 'lithoGravel', k: 80 },
  { id: 'fractured', labelKey: 'lithoFractured', k: 15 },
];

/**
 * Грунты для расчёта понижения от водозаборной скважины
 *
 * `k`  — коэффициент фильтрации, м/сут;
 * `Sy` — гравитационная водоотдача, безразмерная;
 * `Ss` — упругая ёмкость на метр мощности, 1/м.
 *
 * Упругая водоотдача пласта получается умножением на мощность: S = Ss · m.
 * Хранить именно `Ss` правильнее, чем готовое `S`: последнее зависит от
 * мощности конкретного горизонта и при её правке становится неверным.
 */
export const WELL_LITHOLOGY = [
  { id: 'gravel', labelKey: 'lithoWellGravel', k: 150, Sy: 0.25, Ss: 7e-5 },
  { id: 'coarseSand', labelKey: 'lithoWellCoarseSand', k: 25, Sy: 0.27, Ss: 1.6e-4 },
  { id: 'mediumSand', labelKey: 'lithoWellMediumSand', k: 10, Sy: 0.22, Ss: 2e-4 },
  { id: 'fineSand', labelKey: 'lithoWellFineSand', k: 2, Sy: 0.18, Ss: 3e-4 },
  { id: 'siltySand', labelKey: 'lithoWellSiltySand', k: 0.5, Sy: 0.12, Ss: 5e-4 },
  { id: 'loam', labelKey: 'lithoWellLoam', k: 0.05, Sy: 0.06, Ss: 1e-3 },
  { id: 'clay', labelKey: 'lithoWellClay', k: 0.001, Sy: 0.03, Ss: 2e-3 },
  { id: 'sandstone', labelKey: 'lithoWellSandstone', k: 5, Sy: 0.21, Ss: 1e-5 },
  { id: 'limestone', labelKey: 'lithoWellLimestone', k: 20, Sy: 0.14, Ss: 2e-5 },
  { id: 'fractured', labelKey: 'lithoWellFractured', k: 5, Sy: 0.02, Ss: 1e-5 },
];

/**
 * Грунты для расчёта зоны санитарной охраны
 *
 * `kMin`, `kMax` — границы коэффициента фильтрации, м/сут;
 * `nMin`, `nMax` — границы активной пористости.
 *
 * Справочник Domenico & Schwartz (1990) даёт не числа, а диапазоны, и у
 * проницаемости они тянутся на четыре-пять порядков. Поэтому подставляемое
 * значение считается, а не хранится: у проницаемости — среднее
 * геометрическое, у пористости — обычное. Арифметическое среднее диапазона
 * 25…2600 дало бы 1312 м/сут, то есть верхнюю границу, а не типичный гравий.
 */
export const WHPA_LITHOLOGY = [
  { id: 'gravel', labelKey: 'whpaLithoGravel', kMin: 25, kMax: 2600, nMin: 0.1, nMax: 0.3 },
  { id: 'coarseSand', labelKey: 'whpaLithoCoarseSand', kMin: 0.08, kMax: 520, nMin: 0.15, nMax: 0.3 },
  { id: 'mediumSand', labelKey: 'whpaLithoMediumSand', kMin: 0.08, kMax: 40, nMin: 0.15, nMax: 0.32 },
  { id: 'fineSand', labelKey: 'whpaLithoFineSand', kMin: 0.02, kMax: 20, nMin: 0.15, nMax: 0.35 },
  { id: 'loess', labelKey: 'whpaLithoLoess', kMin: 0.0001, kMax: 2, nMin: 0.05, nMax: 0.2 },
  { id: 'till', labelKey: 'whpaLithoTill', kMin: 1e-7, kMax: 0.2, nMin: 0.05, nMax: 0.2 },
  { id: 'clay', labelKey: 'whpaLithoClay', kMin: 1e-6, kMax: 4e-4, nMin: 0.05, nMax: 0.1 },
  { id: 'marineClay', labelKey: 'whpaLithoMarineClay', kMin: 1e-7, kMax: 2e-4, nMin: 0.05, nMax: 0.1 },
  { id: 'karst', labelKey: 'whpaLithoKarst', kMin: 0.1, kMax: 1700, nMin: 0.05, nMax: 0.15 },
  { id: 'limestone', labelKey: 'whpaLithoLimestone', kMin: 0.0001, kMax: 5, nMin: 0.005, nMax: 0.05 },
  { id: 'sandstone', labelKey: 'whpaLithoSandstone', kMin: 3e-5, kMax: 2, nMin: 0.1, nMax: 0.3 },
  { id: 'siltstone', labelKey: 'whpaLithoSiltstone', kMin: 1e-6, kMax: 0.001, nMin: 0.05, nMax: 0.2 },
  { id: 'shale', labelKey: 'whpaLithoShale', kMin: 1e-8, kMax: 2e-4, nMin: 0.05, nMax: 0.3 },
];

/**
 * Типичные значения породы из справочника ЗСО
 *
 * @param {Object} entry - запись справочника
 * @returns {{k: number, n: number}} подставляемые значения
 */
export function whpaTypical(entry) {
  return {
    k: Math.sqrt(entry.kMin * entry.kMax),
    n: (entry.nMin + entry.nMax) / 2,
  };
}

/**
 * Находит породу в справочнике
 *
 * @param {Array<Object>} catalog - PIT_LITHOLOGY или WELL_LITHOLOGY
 * @param {string} id - идентификатор породы
 * @returns {Object|undefined} описание породы
 */
export function findLithology(catalog, id) {
  return catalog.find((entry) => entry.id === id);
}

/**
 * Упругая водоотдача пласта по справочной ёмкости и мощности
 *
 * @param {number} Ss - упругая ёмкость на метр, 1/м
 * @param {number} m - мощность горизонта, м
 * @returns {number} упругая водоотдача S, безразмерная; NaN при неполных данных
 */
export function storativityFromSs(Ss, m) {
  if (!(Ss > 0) || !(m > 0)) return NaN;
  return Ss * m;
}
