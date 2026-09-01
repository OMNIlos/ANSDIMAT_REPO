/**
 * Налив в шурф в зону аэрации: методы Болдырева и Биндемана
 *
 * Опыт ставят выше уровня грунтовых вод: в шурф доливают воду, удерживая в
 * нём постоянный слой (рекомендуют 10 см от дна шурфа), и замеряют
 * установившийся расход, который на это уходит. Вода уходит вниз через дно
 * шурфа, и по расходу считается коэффициент фильтрации зоны аэрации.
 *
 * Метод Болдырева — расход, отнесённый к площади инфильтрации:
 *
 *   k = Q/F = ΔV/(F·Δt).                                          (13.68)
 *
 * Формула Биндемана — то же с учётом капиллярных сил:
 *
 *   k = Q·z / (F·(H + H_c + z)).                                  (13.69)
 *
 * Капиллярные силы подсасывают воду вниз наравне с гравитацией, поэтому
 * напор, под которым идёт просачивание, складывается из слоя воды в шурфе H,
 * высоты капиллярного поднятия H_c и глубины промоченной зоны z. Без их
 * учёта получаемые значения коэффициента фильтрации завышены.
 *
 * Одна формула в другую не переходит подстановкой H_c = 0: у Болдырева нет
 * ни напора, ни глубины просачивания вовсе. Предельным случаем (13.69) при
 * z ≫ H + H_c она всё же остаётся — отношение z/(H + H_c + z) стремится к
 * единице, — но при обычных 10 см слоя и метрах просачивания разница
 * заметна, и подменять один метод другим нельзя.
 *
 * Высота капиллярного поднятия принимается равной половине максимальной для
 * данной породы — см. CAPILLARY_LITHOLOGY.
 *
 * Источники: Синдаловский Л.Н. «Гидрогеологические расчёты с использованием
 * программы ANSDIMAT» (2021), разд. 13.6.3, формулы (13.68) и (13.69), и
 * разд. 20.7 (вкладка «Шурф»); Справочник гидрогеолога / под ред.
 * М.Е. Альтовского (1962); Практикум по общей гидрогеологии / под ред.
 * В.С. Самариной (1994).
 */

import { MINUTES_PER_DAY } from './units';

/** Метод, по которому получен коэффициент фильтрации */
export const VADOSE_METHODS = {
  BOLDYREV: 'boldyrev',   // (13.68) k = Q/F
  BINDEMAN: 'bindeman',   // (13.69) с учётом капиллярных сил
};

/**
 * Ориентировочная максимальная высота капиллярного поднятия по породам, м
 *
 * Справочные диапазоны, а не результат опыта: список нужен, чтобы прикинуть
 * H_c, когда своих данных по капиллярности нет. Подставляемое значение —
 * половина максимального поднятия (`capillaryRise`), как принято в методе;
 * само поле остаётся редактируемым, и замеренную высоту всегда лучше
 * вписать руками.
 *
 * Ориентир для сверки: в настольном АНСДИМАТ «Суглинок лёгкий» даёт H_c =
 * 0.8 м (разд. 20.7, рис. 20.50), то есть максимальное поднятие 1.6 м —
 * середина диапазона суглинка ниже отвечает тому же порядку.
 *
 * `hMin`, `hMax` — границы максимального капиллярного поднятия, м.
 */
export const CAPILLARY_LITHOLOGY = [
  { id: 'gravel', labelKey: 'capillaryGravel', hMin: 0.02, hMax: 0.05 },
  { id: 'coarseSand', labelKey: 'capillaryCoarseSand', hMin: 0.05, hMax: 0.15 },
  { id: 'mediumSand', labelKey: 'capillaryMediumSand', hMin: 0.15, hMax: 0.35 },
  { id: 'fineSand', labelKey: 'capillaryFineSand', hMin: 0.35, hMax: 1.1 },
  { id: 'siltySand', labelKey: 'capillarySiltySand', hMin: 1.1, hMax: 2.0 },
  { id: 'sandyLoam', labelKey: 'capillarySandyLoam', hMin: 1.5, hMax: 3.0 },
  { id: 'loam', labelKey: 'capillaryLoam', hMin: 2.0, hMax: 4.0 },
  { id: 'clay', labelKey: 'capillaryClay', hMin: 4.0, hMax: 6.0 },
];

/**
 * Высота капиллярного поднятия, подставляемая для выбранной породы
 *
 * Половина максимального поднятия, взятого по середине справочного
 * диапазона.
 *
 * @param {Object} entry - запись справочника CAPILLARY_LITHOLOGY
 * @returns {number} H_c, м; NaN для неизвестной породы
 */
export function capillaryRise(entry) {
  if (!entry || !isFinite(entry.hMin) || !isFinite(entry.hMax)) return NaN;
  return (entry.hMin + entry.hMax) / 4;
}

/**
 * Установившийся расход по объёму, налитому за интервал времени
 *
 * @param {Object} params
 * @param {number} params.volume - налитый объём ΔV, м³
 * @param {number} params.interval - интервал времени Δt, мин
 * @returns {number} расход Q, м³/сут; NaN при неполных данных
 */
export function flowFromVolume({ volume, interval }) {
  if (!(volume > 0) || !(interval > 0)) return NaN;
  return (volume / interval) * MINUTES_PER_DAY;
}

/**
 * Коэффициент фильтрации по методу Болдырева (13.68)
 *
 * Расход, отнесённый к площади инфильтрации. Ни слой воды в шурфе, ни
 * глубина просачивания сюда не входят: движущей силой считается одна
 * гравитация, и оттого результат выходит завышенным.
 *
 * @param {Object} params
 * @param {number} params.flow - установившийся расход Q, м³/сут
 * @param {number} params.area - площадь инфильтрации F, м²
 * @returns {number} коэффициент фильтрации k, м/сут; NaN при неполных данных
 */
export function boldyrevConductivity({ flow, area }) {
  if (!(flow > 0) || !(area > 0)) return NaN;
  return flow / area;
}

/**
 * Коэффициент фильтрации по формуле Биндемана (13.69)
 *
 * @param {Object} params
 * @param {number} params.flow - установившийся расход Q, м³/сут
 * @param {number} params.area - площадь инфильтрации F, м²
 * @param {number} params.head - высота столба воды в шурфе H, м
 * @param {number} params.depth - глубина зоны просачивания от дна шурфа z, м
 * @param {number} [params.capillary] - высота капиллярного поднятия H_c, м
 * @returns {number} коэффициент фильтрации k, м/сут; NaN при неполных данных
 */
export function bindemanConductivity({ flow, area, head, depth, capillary }) {
  const hc = isFinite(capillary) && capillary > 0 ? capillary : 0;
  if (!(flow > 0) || !(area > 0) || !(depth > 0) || !(head >= 0)) return NaN;
  const drivingHead = head + hc + depth;
  if (!(drivingHead > 0)) return NaN;
  return (flow * depth) / (area * drivingHead);
}

/**
 * Обработка налива в шурф
 *
 * Учёт капиллярных сил — не поправка к одной и той же формуле, а выбор
 * метода: с ним считают по Биндеману (13.69), без него — по Болдыреву
 * (13.68). Так же устроен и флажок «Учитывать капиллярное давление» в
 * настольном АНСДИМАТ (табл. 20.23).
 *
 * Расход можно задать двумя способами: замерить напрямую или получить из
 * налитого объёма и времени. Заданный напрямую важнее — он и есть замер,
 * а объём с интервалом лишь способ его посчитать, когда расходомера нет.
 *
 * @param {Object} params
 * @param {number} [params.flow] - установившийся расход Q, м³/сут
 * @param {number} [params.volume] - налитый объём ΔV, м³
 * @param {number} [params.interval] - интервал времени Δt, мин
 * @param {number} params.area - площадь инфильтрации F, м²
 * @param {number} params.head - высота столба воды в шурфе H, м
 * @param {number} params.depth - глубина зоны просачивания z, м
 * @param {number} [params.capillary] - высота капиллярного поднятия H_c, м
 * @param {boolean} [params.useCapillary] - считать по Биндеману
 * @returns {{flow: number, k: number, capillary: number, method: string}}
 *   расход, взятый в расчёт, коэффициент фильтрации, учтённая высота
 *   капиллярного поднятия и метод, по которому получен результат
 */
export function processVadoseFill({
  flow,
  volume,
  interval,
  area,
  head,
  depth,
  capillary,
  useCapillary = true,
}) {
  const resolvedFlow =
    isFinite(flow) && flow > 0 ? flow : flowFromVolume({ volume, interval });
  const hc = useCapillary && isFinite(capillary) && capillary > 0 ? capillary : 0;
  return {
    flow: resolvedFlow,
    capillary: hc,
    method: useCapillary ? VADOSE_METHODS.BINDEMAN : VADOSE_METHODS.BOLDYREV,
    k: useCapillary
      ? bindemanConductivity({
          flow: resolvedFlow,
          area,
          head,
          depth,
          capillary: hc,
        })
      : boldyrevConductivity({ flow: resolvedFlow, area }),
  };
}
