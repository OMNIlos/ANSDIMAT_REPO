/**
 * Текстовая сводка по видам ОФР со своей расчётной схемой
 *
 * «Поделиться текстом» отдаёт журнал таблицей «время — понижение»: её можно
 * вставить в отчёт или в Excel. У трёх видов ОФР такой таблицы либо нет вовсе
 * (налив в шурф), либо она не главное (поинтервальное нагнетание считается по
 * ступеням). Отправлять для них пустую таблицу с заголовком «t, мин» значило
 * бы посылать получателю пустой бланк.
 *
 * Поэтому здесь собирается то, что у этих видов и есть содержанием: исходные
 * данные и посчитанный по ним результат. Расчёт берётся из `calc/`, а не
 * хранится: он выводится из тех же чисел и не может с ними разойтись.
 *
 * Числа переводятся в размерности получателя — как и таблица замеров: в
 * отчёт вставляют то, в чём человек работает, а не базовые единицы.
 */

import I18n from '../Localization';
import { QUANTITIES, MINUTES_PER_DAY } from '../calc/units';
import { OFR_TYPES } from '../db/schema';
import { processLugeon } from '../calc/lugeon';
import { processVadoseFill } from '../calc/vadoseFill';

/** Литров в кубометре: расход ступени принято писать в л/мин */
const L_PER_M3 = 1000;

/**
 * Ведёт ли вид ОФР журнал «время — понижение»
 *
 * Экспресс-опробование ведёт: там время и текущее понижение. У нагнетания
 * замеры лежат ступенями, у налива в шурф журнала нет.
 *
 * @param {string} ofrType - вид ОФР, см. OFR_TYPES
 * @returns {boolean} есть ли таблица замеров
 */
export function hasDrawdownJournal(ofrType) {
  return ofrType !== OFR_TYPES.LUGEON && ofrType !== OFR_TYPES.VADOSE;
}

/**
 * Показывается ли у вида ОФР дебит откачки
 *
 * @param {string} ofrType - вид ОФР, см. OFR_TYPES
 * @returns {boolean} есть ли постоянный дебит
 */
export function hasFlowRate(ofrType) {
  return (
    ofrType !== OFR_TYPES.LUGEON &&
    ofrType !== OFR_TYPES.VADOSE &&
    ofrType !== OFR_TYPES.SLUG
  );
}

/**
 * Строки сводки по исходным данным и результату
 *
 * @param {Object} project - журнал из `getProject`
 * @param {Object} units
 * @param {Function} units.fromBase - перевод из базовой единицы
 * @param {Function} units.unitLabel - подпись размерности
 * @returns {Array<string>} строки; пусто у видов без своих исходных данных
 */
export function ofrSummaryLines(project, { fromBase, unitLabel }) {
  const params = project?.params;
  if (!params) return [];

  /**
   * @param {string} key - ключ перевода подписи
   * @param {number} value - значение в базовой единице
   * @param {string} [quantity] - величина, см. QUANTITIES
   * @returns {string} строка «подпись: значение единица»
   */
  const line = (key, value, quantity) => {
    if (!isFinite(value)) return `${I18n.t(key)}: —`;
    const shown = quantity ? fromBase(value, quantity) : value;
    const unit = quantity ? ` ${unitLabel(quantity)}` : '';
    return `${I18n.t(key)}: ${Number(shown.toPrecision(6))}${unit}`;
  };

  if (project.ofrType === OFR_TYPES.SLUG) {
    return [
      '',
      I18n.t('ofrInputs'),
      line('slugFilterRadius', params.rw, QUANTITIES.DISTANCE),
      line('slugCasingRadius', params.rc, QUANTITIES.DISTANCE),
      line('slugFilterLength', params.lw, QUANTITIES.DISTANCE),
      line('slugFilterBottom', params.z, QUANTITIES.DISTANCE),
      line('slugThickness', params.m, QUANTITIES.DISTANCE),
      line('slugInitialDrawdown', params.s0, QUANTITIES.DRAWDOWN),
    ];
  }

  if (project.ofrType === OFR_TYPES.VADOSE) {
    const result = processVadoseFill(params);
    return [
      '',
      I18n.t('ofrInputs'),
      line('vadoseVolume', params.volume, QUANTITIES.VOLUME),
      line('vadoseInterval', params.interval, QUANTITIES.TIME),
      line('vadoseArea', params.area, QUANTITIES.AREA),
      line('vadoseHead', params.head, QUANTITIES.DISTANCE),
      line('vadoseDepth', params.depth, QUANTITIES.DISTANCE),
      line('vadoseCapillary', result.capillary, QUANTITIES.DISTANCE),
      '',
      I18n.t('ofrResult'),
      `${I18n.t('vadoseMethodName')}: ${I18n.t(
        result.method === 'bindeman'
          ? 'vadoseMethodBindemanName'
          : 'vadoseMethodBoldyrevName'
      )}`,
      line('vadoseFlow', result.flow, QUANTITIES.FLOW),
      line('quantityConductivity', result.k, QUANTITIES.CONDUCTIVITY),
    ];
  }

  if (project.ofrType === OFR_TYPES.LUGEON) {
    const result = processLugeon({
      stages: params.stages,
      interval: params.interval,
      lw: params.lw,
      rw: params.rw,
      density: params.density,
      formula: params.formula,
    });
    const flowUnit = `${I18n.t('unitLiters')}/${I18n.t('unitMinutes')}`;
    const number = (value, digits = 6) =>
      isFinite(value) ? String(Number(value.toPrecision(digits))) : '—';

    return [
      '',
      I18n.t('ofrInputs'),
      line('lugeonIntervalLength', params.lw, QUANTITIES.DISTANCE),
      line('lugeonWellRadius', params.rw, QUANTITIES.DISTANCE),
      line('lugeonReadingInterval', params.interval, QUANTITIES.TIME),
      line('lugeonDensity', params.density),
      `${I18n.t('lugeonFormula')}: ${I18n.t(
        result.formula === 'thiem' ? 'lugeonFormulaThiem' : 'lugeonFormulaMoye'
      )}`,
      '',
      I18n.t('lugeonStagesTitle'),
      [
        `${I18n.t('lugeonPressure')}, ${unitLabel(QUANTITIES.PRESSURE)}`,
        `${I18n.t('lugeonMeanFlow')}, ${flowUnit}`,
        `k, ${unitLabel(QUANTITIES.CONDUCTIVITY)}`,
        I18n.t('lugeonStageLu'),
      ].join('\t'),
      ...result.stages.map((stage) =>
        [
          number(fromBase(stage.pressure, QUANTITIES.PRESSURE)),
          number((stage.flow * L_PER_M3) / MINUTES_PER_DAY),
          number(fromBase(stage.k, QUANTITIES.CONDUCTIVITY)),
          number(stage.lu),
        ].join('\t')
      ),
      '',
      I18n.t('ofrResult'),
      line('lugeonMeanK', result.meanK, QUANTITIES.CONDUCTIVITY),
      `${I18n.t('lugeonMeanLu')}: ${number(result.meanLu)}`,
      `${I18n.t('lugeonPatternTitle')}: ${I18n.t(
        `lugeonPattern${result.pattern.charAt(0).toUpperCase()}${result.pattern.slice(1)}`
      )}`,
      result.rockClass
        ? `${I18n.t('lugeonRockClass')}: ${I18n.t(
            `lugeonRock${result.rockClass.id.charAt(0).toUpperCase()}${result.rockClass.id.slice(1)}`
          )}`
        : null,
    ].filter((entry) => entry !== null);
  }

  return [];
}
