/**
 * Вкладка «Прогноз понижения»
 *
 * Полный перенос веб-калькулятора «Оценка запасов подземных вод». Отвечает на
 * вопрос, насколько просядет уровень от работы водозаборной скважины — в самой
 * скважине и в наблюдательной на расстоянии r.
 *
 * Схем четыре, и отличаются они тем, откуда пласт берёт воду: ниоткуда (Тейс),
 * сверху через слабопроницаемый слой (Хантуш–Джейкоб), из осушаемых пор
 * (Болтон) или из реки (граница питания). Выбор схемы меняет и набор полей,
 * и типовой чертёж над результатом.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import { useUnits } from '../../UnitsContext';
import { computeWellDrawdown, drawdownSeries } from '../../calc/wellDrawdown';
import { WELL_LITHOLOGY, storativityFromSs } from '../../calc/lithology';
import WellScheme from '../../components/schemes/WellScheme';
import DrawdownLogChart from '../../components/charts/DrawdownLogChart';
import { spacing, type } from '../../theme';
import {
  Card,
  Field,
  ResultCard,
  SectionLabel,
  OptionRow,
  Notices,
  StatRow,
  parseNumber,
  formatValue,
  formatCompact,
  formatExponential,
  styles as shared,
} from './shared';

/** Расчётные схемы в порядке веб-версии */
const SCHEMES = [
  { value: 'theis', labelKey: 'wellSchemeTheis' },
  { value: 'hantush', labelKey: 'wellSchemeHantush' },
  { value: 'boulton', labelKey: 'wellSchemeBoulton' },
  { value: 'boundary', labelKey: 'wellSchemeBoundary' },
];

/** Сколько строк таблицы понижений показывать */
const TABLE_ROWS = 30;

/**
 * Переводит подписи вариантов через словарь
 *
 * @param {Array<Object>} items - варианты с ключами локализации
 * @returns {Array<{value: string, label: string}>} готовые варианты
 */
function localize(items) {
  return items.map((item) => ({ value: item.value, label: I18n.t(item.labelKey) }));
}

export default function ForecastTab({ contentWidth }) {
  const theme = useTheme();
  const { unitLabel, toBase, fromBase } = useUnits();

  const inFlow = (text) => toBase(parseNumber(text), QUANTITIES.FLOW);
  const inLen = (text) => toBase(parseNumber(text), QUANTITIES.DISTANCE);
  const inDraw = (text) => toBase(parseNumber(text), QUANTITIES.DRAWDOWN);
  const inCond = (text) => toBase(parseNumber(text), QUANTITIES.CONDUCTIVITY);
  const inDiff = (text) => toBase(parseNumber(text), QUANTITIES.DIFFUSIVITY);
  const out = (value, quantity) => formatValue(fromBase(value, quantity));

  const uFlow = unitLabel(QUANTITIES.FLOW);
  const uLen = unitLabel(QUANTITIES.DISTANCE);
  const uDraw = unitLabel(QUANTITIES.DRAWDOWN);
  const uCond = unitLabel(QUANTITIES.CONDUCTIVITY);
  const uDiff = unitLabel(QUANTITIES.DIFFUSIVITY);

  const [scheme, setScheme] = useState('theis');
  const [flow, setFlow] = useState('100');
  // Длительность откачки задаётся в сутках, а не в выбранной пользователем
  // размерности времени. Базовая единица времени в приложении — минута, она
  // выбрана под журналы ОФР, и водозабор на четверть века превращался бы в
  // «13 140 000 мин». Вкладка притока считает время так же, в сутках
  const [time, setTime] = useState('9125');
  const [wellRadius, setWellRadius] = useState('0.045');
  const [distance, setDistance] = useState('5');
  const [k, setK] = useState('2');
  const [thickness, setThickness] = useState('25');
  const [storativity, setStorativity] = useState('0.0001');
  const [yieldValue, setYieldValue] = useState('0.2');
  const [diffusivity, setDiffusivity] = useState('500000');
  const [leakage, setLeakage] = useState('50');
  const [wellToRiver, setWellToRiver] = useState('62.05');
  const [obsToRiver, setObsToRiver] = useState('62.05');
  const [allowable, setAllowable] = useState('');

  const unconfined = scheme === 'boulton';

  const raw = useMemo(
    () => ({
      scheme,
      Q: inFlow(flow),
      t: parseNumber(time),
      r0: inLen(wellRadius),
      r: inLen(distance),
      k: inCond(k),
      m: unconfined ? undefined : inLen(thickness),
      h0: unconfined ? inLen(thickness) : undefined,
      S: parseNumber(storativity),
      Sy: parseNumber(yieldValue),
      a: inDiff(diffusivity),
      B: inLen(leakage),
      Lw: inLen(wellToRiver),
      Lp: inLen(obsToRiver),
      allowable: inDraw(allowable),
    }),
    [scheme, flow, time, wellRadius, distance, k, thickness, storativity, yieldValue, diffusivity, leakage, wellToRiver, obsToRiver, allowable, unconfined]
  );

  const result = useMemo(() => computeWellDrawdown(raw), [raw]);
  const series = useMemo(() => (result.ok ? drawdownSeries(raw) : []), [result, raw]);

  const caption = result.ok
    ? `k = ${formatCompact(fromBase(result.k, QUANTITIES.CONDUCTIVITY))} ${uCond} · Q = ${formatCompact(fromBase(result.Q, QUANTITIES.FLOW))} ${uFlow}`
    : null;

  const hasError = (code) => !result.ok && result.errors.includes(code);

  // Четверть века в сутках — это 9125, и на глаз срок не читается.
  // Подсказка в годах стоит и в веб-версии
  const days = parseNumber(time);
  const yearsHint =
    days >= 365 ? I18n.t('wellYearsHint', { years: (days / 365).toFixed(1) }) : null;

  /**
   * Подставляет справочные параметры выбранной породы
   *
   * Упругая водоотдача хранится на метр мощности, поэтому пересчитывается
   * под текущий горизонт: иначе при правке мощности она стала бы неверной.
   *
   * @param {string} id - идентификатор породы
   */
  const applyLithology = (id) => {
    const entry = WELL_LITHOLOGY.find((item) => item.id === id);
    if (!entry) return;
    const depth = inLen(thickness);
    setK(String(fromBase(entry.k, QUANTITIES.CONDUCTIVITY)));
    setYieldValue(String(entry.Sy));
    const elastic = storativityFromSs(entry.Ss, depth);
    if (elastic > 0) setStorativity(String(Number(elastic.toPrecision(6))));
    if (entry.k > 0 && depth > 0 && elastic > 0) {
      setDiffusivity(String(fromBase((entry.k * depth) / elastic, QUANTITIES.DIFFUSIVITY)));
    }
  };

  return (
    <>
      <SectionLabel style={styles.firstLabel}>{I18n.t('wellSchemeGroup')}</SectionLabel>
      <OptionRow options={localize(SCHEMES)} value={scheme} onChange={setScheme} />

      <SectionLabel>{I18n.t('wellPumpingGroup')}</SectionLabel>
      <Card>
        <Field label={I18n.t('wellFlow')} value={flow} onChange={setFlow} unit={uFlow} error={hasError('Q')}
          hint={result.ok ? `${formatValue(result.Q / 24)} ${I18n.t('unitM3Hour')} · ${formatValue(result.Q / 86.4)} ${I18n.t('unitLSec')}` : null} />
        <Field
          label={I18n.t('wellTime')}
          value={time}
          onChange={setTime}
          unit={I18n.t('unitDays')}
          error={hasError('t')}
          hint={yearsHint}
        />
        <Field label={I18n.t('wellRadius')} value={wellRadius} onChange={setWellRadius} unit={uLen} error={hasError('r0')} />
        <Field label={I18n.t('wellDistance')} value={distance} onChange={setDistance} unit={uLen} error={hasError('r')} />
      </Card>

      {scheme === 'boundary' ? (
        <>
          <SectionLabel>{I18n.t('wellBoundaryGroup')}</SectionLabel>
          <Card>
            <Field label={I18n.t('wellToRiver')} value={wellToRiver} onChange={setWellToRiver} unit={uLen} error={hasError('Lw')} />
            <Field label={I18n.t('wellObsToRiver')} value={obsToRiver} onChange={setObsToRiver} unit={uLen} error={hasError('Lp')} />
          </Card>
        </>
      ) : null}

      <SectionLabel>{I18n.t('wellAquiferGroup')}</SectionLabel>
      <OptionRow
        options={WELL_LITHOLOGY.map((entry) => ({ value: entry.id, label: I18n.t(entry.labelKey) }))}
        value={null}
        onChange={applyLithology}
      />
      <Text style={[type.caption, styles.note, { color: theme.colors.textSecondary }]}>
        {I18n.t('wellLithologyNote')}
      </Text>
      <Card style={styles.spaced}>
        <Field label={I18n.t('wellConductivity')} value={k} onChange={setK} unit={uCond} error={hasError('k')} />
        <Field
          label={unconfined ? I18n.t('wellSaturated') : I18n.t('wellThickness')}
          value={thickness}
          onChange={setThickness}
          unit={uLen}
          error={hasError('m') || hasError('h0')}
        />
        {unconfined ? (
          <Field label={I18n.t('wellYield')} value={yieldValue} onChange={setYieldValue} unit="" error={hasError('Sy')} />
        ) : null}
        <Field label={I18n.t('wellStorativity')} value={storativity} onChange={setStorativity} unit="" error={hasError('S')} />
        {unconfined ? null : (
          <Field label={I18n.t('wellDiffusivity')} value={diffusivity} onChange={setDiffusivity} unit={uDiff}
            hint={I18n.t('wellDiffusivityHint')} />
        )}
        {scheme === 'hantush' ? (
          <Field label={I18n.t('wellLeakage')} value={leakage} onChange={setLeakage} unit={uLen} error={hasError('B')} />
        ) : null}
      </Card>

      <SectionLabel>{I18n.t('wellAllowableGroup')}</SectionLabel>
      <Card>
        <Field label={I18n.t('wellAllowable')} value={allowable} onChange={setAllowable} unit={uDraw} />
      </Card>

      <SectionLabel>{I18n.t('wellSectionGroup')}</SectionLabel>
      <WellScheme scheme={scheme} width={contentWidth} caption={caption} />

      {result.ok ? (
        <>
          <ResultCard
            label="s(r₀)"
            value={out(result.sWell, QUANTITIES.DRAWDOWN)}
            unit={uDraw}
            formula={result.formula}
            extra={
              <View style={styles.secondValue}>
                <Text style={styles.secondLabel}>s(r) =</Text>
                <Text style={styles.secondNumber}>{out(result.sObs, QUANTITIES.DRAWDOWN)}</Text>
                <Text style={styles.secondUnit}>{uDraw}</Text>
              </View>
            }
          />
          <Notices codes={result.warnings} prefix="wellWarn_" tone={result.dewatered ? 'error' : 'warning'} />

          <SectionLabel>{I18n.t('wellStatsGroup')}</SectionLabel>
          <Card style={shared.listCard}>
            <View style={styles.stats}>
              <StatRow label={I18n.t('wellStatT')} value={`${out(result.T, QUANTITIES.TRANSMISSIVITY)} ${unitLabel(QUANTITIES.TRANSMISSIVITY)}`} />
              <StatRow label={I18n.t('wellStatA')} value={`${out(result.a, QUANTITIES.DIFFUSIVITY)} ${uDiff}`} />
              <StatRow label={I18n.t('wellStatS')} value={formatExponential(result.S)} />
              {result.rImage > 0 ? (
                <StatRow label={I18n.t('wellStatImage')} value={`${out(result.rImage, QUANTITIES.DISTANCE)} ${uLen}`} />
              ) : null}
              {result.allowable ? (
                <StatRow
                  label={I18n.t('wellStatReserve')}
                  value={`${out(result.allowable - result.sWell, QUANTITIES.DRAWDOWN)} ${uDraw}`}
                />
              ) : null}
            </View>
          </Card>

          {series.length > 1 ? (
            <>
              <SectionLabel>{I18n.t('wellChartGroup')}</SectionLabel>
              <DrawdownLogChart series={series} width={contentWidth} />

              <SectionLabel>{I18n.t('wellTableGroup')}</SectionLabel>
              <Card style={shared.listCard}>
                <View style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.cell, styles.cellIndex, { color: theme.colors.textSecondary }]}>№</Text>
                  <Text style={[styles.cell, { color: theme.colors.textSecondary }]}>t</Text>
                  <Text style={[styles.cell, { color: theme.colors.textSecondary }]}>s(r₀)</Text>
                  <Text style={[styles.cell, { color: theme.colors.textSecondary }]}>s(r)</Text>
                </View>
                {series.slice(0, TABLE_ROWS).map((point, index) => (
                  <View
                    key={point.t}
                    style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}
                  >
                    <Text style={[styles.cell, styles.cellIndex, { color: theme.colors.textSecondary }]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.cell, { color: theme.colors.text }]}>{formatExponential(point.t)}</Text>
                    <Text style={[styles.cell, { color: theme.colors.text }]}>{point.sWell.toFixed(4)}</Text>
                    <Text style={[styles.cell, { color: theme.colors.text }]}>{point.sObs.toFixed(4)}</Text>
                  </View>
                ))}
              </Card>
              <Text style={[type.caption, styles.note, { color: theme.colors.textSecondary }]}>
                {I18n.t('wellTableNote')}
              </Text>
            </>
          ) : null}
        </>
      ) : (
        <Notices codes={result.errors} prefix="wellError_" tone="error" />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
  spaced: {
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  stats: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  secondLabel: {
    ...type.numeric,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  secondNumber: {
    ...type.numeric,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondUnit: {
    ...type.numeric,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    ...type.numeric,
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  cellIndex: {
    flex: 0.4,
    textAlign: 'left',
  },
});
