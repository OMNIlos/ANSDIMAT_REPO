/**
 * Вкладка «Приток в котлован»
 *
 * Полный перенос веб-калькулятора водопритока. Отвечает на вопрос, сколько
 * воды придётся откачивать из выработки: контур котлована заменяется «большим
 * колодцем» приведённого радиуса, и приток считается по стационарным формулам
 * Дюпюи и Дюпюи–Тима.
 *
 * Форма собрана в том же порядке, что и на сайте — геометрия, пласт, граница
 * и радиус влияния, — потому что этот порядок повторяет ход рассуждения:
 * сначала что копаем, потом в чём, потом откуда идёт вода. Разрез стоит сразу
 * под выбором схемы: он показывает задачу раньше, чем начинается ввод.
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import { useUnits } from '../../UnitsContext';
import { compute, seriesQ, compareR, PIT_EXAMPLES } from '../../calc/pitInflow';
import { PIT_LITHOLOGY } from '../../calc/lithology';
import PitScheme from '../../components/schemes/PitScheme';
import InflowChart from '../../components/charts/InflowChart';
import AppearIn from '../../components/ui/AppearIn';
import { spacing } from '../../theme';
import {
  Card,
  Collapsible,
  Field,
  Formula,
  Note,
  Notices,
  OptionRow,
  PresetRow,
  ResultCard,
  SectionLabel,
  StatRow,
  parseNumber,
  formatValue,
  styles as shared,
} from './shared';

/** Расчётные схемы в порядке веб-версии */
const SCHEMES = [
  { value: 'unconfined_unlimited', labelKey: 'pitSchemeUnconfined', methodKey: 'pitMethodUnconfined' },
  { value: 'unconfined_river', labelKey: 'pitSchemeUnconfinedRiver', methodKey: 'pitMethodUnconfinedRiver' },
  { value: 'confined_unlimited', labelKey: 'pitSchemeConfined', methodKey: 'pitMethodConfined' },
  { value: 'confined_river', labelKey: 'pitSchemeConfinedRiver', methodKey: 'pitMethodConfinedRiver' },
];

/** Способы задания геометрии выработки */
const GEOMETRIES = [
  { value: 'area', labelKey: 'pitGeomArea' },
  { value: 'rect', labelKey: 'pitGeomRect' },
  { value: 'radius', labelKey: 'pitGeomRadius' },
];

/** Способы приведения прямоугольника к радиусу */
const R0_MODES = [
  { value: 'area', labelKey: 'pitR0Area' },
  { value: 'forchheimer', labelKey: 'pitR0Forchheimer' },
];

/** Способы расчёта радиуса влияния */
const R_METHODS = [
  { value: 'fromWall', labelKey: 'pitRFromWall' },
  { value: 'manual', labelKey: 'pitRManual' },
];

/**
 * Подпись способа расчёта R в таблице сравнения
 *
 * Считается при отрисовке, а не один раз при загрузке модуля: язык меняется
 * в настройках на ходу, и словарь, собранный заранее, остался бы на старом.
 *
 * @param {string} method - идентификатор способа
 * @returns {string} подпись строки
 */
function compareLabel(method) {
  if (method === 'fromWall') return 'r₀ + √(π a t)';
  return I18n.t(`pitR_${method}`, { defaultValue: method });
}

/**
 * Переводит подписи вариантов через словарь
 *
 * @param {Array<Object>} items - варианты с ключами локализации
 * @returns {Array<{value: string, label: string}>} готовые варианты
 */
function localize(items) {
  return items.map((item) => ({ value: item.value, label: I18n.t(item.labelKey) }));
}

export default function PitTab({ contentWidth }) {
  const { unitLabel, toBase, fromBase } = useUnits();

  const inArea = (text) => toBase(parseNumber(text), QUANTITIES.AREA);
  const inLen = (text) => toBase(parseNumber(text), QUANTITIES.DISTANCE);
  const inDraw = (text) => toBase(parseNumber(text), QUANTITIES.DRAWDOWN);
  const inCond = (text) => toBase(parseNumber(text), QUANTITIES.CONDUCTIVITY);
  const inDiff = (text) => toBase(parseNumber(text), QUANTITIES.DIFFUSIVITY);
  const out = (value, quantity) => formatValue(fromBase(value, quantity));

  const uArea = unitLabel(QUANTITIES.AREA);
  const uLen = unitLabel(QUANTITIES.DISTANCE);
  const uDraw = unitLabel(QUANTITIES.DRAWDOWN);
  const uCond = unitLabel(QUANTITIES.CONDUCTIVITY);
  const uDiff = unitLabel(QUANTITIES.DIFFUSIVITY);
  const uFlow = unitLabel(QUANTITIES.FLOW);

  const [scheme, setScheme] = useState('unconfined_unlimited');
  const [geom, setGeom] = useState('area');
  const [r0mode, setR0mode] = useState('area');
  const [rMethod, setRMethod] = useState('fromWall');

  const [area, setArea] = useState('44000');
  const [length, setLength] = useState('400');
  const [pitWidth, setPitWidth] = useState('110');
  const [radiusInput, setRadiusInput] = useState('118');
  const [k, setK] = useState('5');
  const [thickness, setThickness] = useState('20');
  const [drawdown, setDrawdown] = useState('10');
  const [time, setTime] = useState('100');
  const [diffusivity, setDiffusivity] = useState('1000');
  const [storage, setStorage] = useState('0.1');
  const [manualR, setManualR] = useState('500');
  const [riverDistance, setRiverDistance] = useState('2200');
  const [factor, setFactor] = useState('1');

  const river = scheme.includes('river');
  const confined = scheme.startsWith('confined');

  const raw = useMemo(
    () => ({
      scheme,
      geom,
      r0mode,
      rMethod,
      F: inArea(area),
      length: inLen(length),
      width: inLen(pitWidth),
      r0: inLen(radiusInput),
      k: inCond(k),
      m: confined ? inLen(thickness) : undefined,
      h0: confined ? undefined : inLen(thickness),
      S: inDraw(drawdown),
      t: parseNumber(time),
      a: inDiff(diffusivity),
      mu: parseNumber(storage),
      Rmanual: inLen(manualR),
      L: inLen(riverDistance),
      factor: parseNumber(factor),
    }),
    // Пересчёт идёт на каждое изменение поля, как в веб-версии: результат
    // должен успевать за вводом, иначе кнопку «посчитать» приходится искать
    [scheme, geom, r0mode, rMethod, area, length, pitWidth, radiusInput, k, thickness, drawdown, time, diffusivity, storage, manualR, riverDistance, factor, confined]
  );

  const result = useMemo(() => compute(raw), [raw]);
  const series = useMemo(() => (result.ok ? seriesQ(raw, parseNumber(time), 24) : []), [result, raw, time]);
  const comparison = useMemo(() => (result.ok && !river ? compareR(raw) : []), [result, raw, river]);

  // Подпись над разрезом называет схему и метод: чипы выбора укорочены до
  // одного слова, а по какой формуле идёт счёт — вопрос не праздный
  const caption = I18n.t(
    (SCHEMES.find((item) => item.value === scheme) || SCHEMES[0]).methodKey
  );

  /**
   * Подставляет готовый пример из веб-калькулятора
   *
   * @param {string} id - идентификатор схемы примера
   */
  const applyExample = (id) => {
    const example = PIT_EXAMPLES[id];
    setScheme(example.scheme);
    setGeom('area');
    setRMethod('fromWall');
    setArea(String(fromBase(example.F, QUANTITIES.AREA)));
    setK(String(fromBase(example.k, QUANTITIES.CONDUCTIVITY)));
    setThickness(String(fromBase(example.scheme.startsWith('confined') ? example.m : example.h0, QUANTITIES.DISTANCE)));
    setDrawdown(String(fromBase(example.S, QUANTITIES.DRAWDOWN)));
    setDiffusivity(String(fromBase(example.a, QUANTITIES.DIFFUSIVITY)));
    setStorage(String(example.mu));
    setTime(String(example.t));
    setRiverDistance(String(fromBase(example.L, QUANTITIES.DISTANCE)));
    setFactor('1');
  };

  const hasError = (code) => !result.ok && result.errors.includes(code);

  return (
    <>
      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>{I18n.t('pitSchemeGroup')}</SectionLabel>
        <OptionRow options={localize(SCHEMES)} value={scheme} onChange={setScheme} />
        <View style={styles.scheme}>
          <PitScheme result={result} width={contentWidth} caption={caption} />
        </View>
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>{I18n.t('pitGeometryGroup')}</SectionLabel>
        <OptionRow options={localize(GEOMETRIES)} value={geom} onChange={setGeom} />
        <Card style={styles.spaced}>
          {geom === 'area' ? (
            <Field label={I18n.t('pitArea')} symbol="F" value={area} onChange={setArea} unit={uArea} error={hasError('F')} />
          ) : null}
          {geom === 'rect' ? (
            <>
              <Field label={I18n.t('pitLength')} symbol="L" value={length} onChange={setLength} unit={uLen} error={hasError('rect')} />
              <Field label={I18n.t('pitWidth')} symbol="B" value={pitWidth} onChange={setPitWidth} unit={uLen} error={hasError('rect')} />
            </>
          ) : null}
          {geom === 'radius' ? (
            <Field label={I18n.t('pitReducedRadius')} symbol="r₀" value={radiusInput} onChange={setRadiusInput} unit={uLen} error={hasError('r0')} />
          ) : null}
        </Card>
        {geom === 'rect' ? (
          <View style={styles.spaced}>
            <OptionRow options={localize(R0_MODES)} value={r0mode} onChange={setR0mode} />
          </View>
        ) : null}
      </AppearIn>

      <AppearIn index={2}>
        <SectionLabel>{I18n.t('pitAquiferGroup')}</SectionLabel>
        <PresetRow
          options={PIT_LITHOLOGY.map((entry) => ({
            value: entry.id,
            label: `${I18n.t(entry.labelKey)} · ${entry.k}`,
          }))}
          onPick={(id) => {
            const entry = PIT_LITHOLOGY.find((item) => item.id === id);
            if (entry) setK(String(fromBase(entry.k, QUANTITIES.CONDUCTIVITY)));
          }}
        />
        <Card style={styles.spaced}>
          <Field
            label={I18n.t('pitConductivity')}
            symbol="k"
            value={k}
            onChange={setK}
            unit={uCond}
            error={hasError('k')}
            hint={result.ok ? `${formatValue(result.k_ms)} ${I18n.t('unitMSecond')}` : null}
          />
          <Field
            label={confined ? I18n.t('pitThicknessConfined') : I18n.t('pitThicknessUnconfined')}
            symbol={confined ? 'm' : 'h₀'}
            value={thickness}
            onChange={setThickness}
            unit={uLen}
            error={hasError('m') || hasError('h0')}
          />
          <Field
            label={I18n.t('pitDrawdown')}
            symbol="s"
            value={drawdown}
            onChange={setDrawdown}
            unit={uDraw}
            error={hasError('S') || hasError('S_gt_h0')}
          />
        </Card>
      </AppearIn>

      <AppearIn index={3}>
        <SectionLabel>{I18n.t('pitBoundaryGroup')}</SectionLabel>
        {river ? null : <OptionRow options={localize(R_METHODS)} value={rMethod} onChange={setRMethod} />}
        <Card style={river ? null : styles.spaced}>
          {river ? (
            <Field
              label={I18n.t('pitRiverDistance')}
              symbol="L"
              value={riverDistance}
              onChange={setRiverDistance}
              unit={uLen}
              error={hasError('L') || hasError('L_le_r0')}
              hint={I18n.t('pitRiverHint')}
            />
          ) : null}
          {!river && rMethod === 'manual' ? (
            <Field label={I18n.t('pitManualR')} symbol="R" value={manualR} onChange={setManualR} unit={uLen} error={hasError('Rmanual') || hasError('R_le_r0')} />
          ) : null}
          {!river && rMethod === 'fromWall' ? (
            <>
              <Field label={I18n.t('pitTime')} symbol="t" value={time} onChange={setTime} unit={I18n.t('unitDays')} error={hasError('t')} />
              <Field
                label={I18n.t('pitDiffusivity')}
                symbol="a"
                value={diffusivity}
                onChange={setDiffusivity}
                unit={uDiff}
                error={hasError('a')}
                hint={I18n.t('pitDiffusivityHint')}
              />
              <Field label={I18n.t('pitStorage')} symbol="μ" value={storage} onChange={setStorage} />
            </>
          ) : null}
          <Field label={I18n.t('pitFactor')} symbol="n" value={factor} onChange={setFactor} hint={I18n.t('pitFactorHint')} />
        </Card>
      </AppearIn>

      <AppearIn index={4}>
        <Collapsible title={I18n.t('pitExamplesGroup')}>
          <OptionRow
            options={Object.keys(PIT_EXAMPLES).map((id) => ({
              value: id,
              label: I18n.t(`pitExample_${id}`),
            }))}
            value={null}
            onChange={applyExample}
          />
        </Collapsible>
      </AppearIn>

      {result.ok ? (
        <AppearIn index={5}>
          <ResultCard
            title={I18n.t('pitResultTitle')}
            label="Q"
            value={out(result.Q, QUANTITIES.FLOW)}
            unit={uFlow}
            rows={[
              { label: I18n.t('pitStatQHour'), value: formatValue(result.Q_m3h) },
              { label: I18n.t('pitStatQSec'), value: formatValue(result.Q_ls) },
              ...(result.factor !== 1
                ? [{ label: I18n.t('pitStatDesign'), value: out(result.Qdesign, QUANTITIES.FLOW), unit: uFlow }]
                : []),
            ]}
          />
          <Notices codes={result.warnings} prefix="pitWarn_" />

          <Collapsible title={I18n.t('pitStatsGroup')} note="ƒ">
            {/* Формула — внутри раздела: в шапке она переносилась на вторую
                строку и налезала на заголовок */}
            <Formula>
              {confined ? 'Q = 2π k m s / ln(R/r₀)' : 'Q = π k (h₀² − h_w²) / ln(R/r₀)'}
            </Formula>
            <Card style={shared.listCard}>
              <StatRow label={I18n.t('pitStatR0')} value={`${out(result.r0, QUANTITIES.DISTANCE)} ${uLen}`} />
              <StatRow label={I18n.t('pitStatR')} value={`${out(result.R, QUANTITIES.DISTANCE)} ${uLen}`} />
              <StatRow label={I18n.t('pitStatRatio')} value={formatValue(result.ratio)} />
              <StatRow label={I18n.t('pitStatLn')} value={formatValue(result.lnTerm)} />
              <StatRow label={I18n.t('pitStatT')} value={`${out(result.T, QUANTITIES.TRANSMISSIVITY)} ${unitLabel(QUANTITIES.TRANSMISSIVITY)}`} />
            </Card>
          </Collapsible>

          {series.length > 1 ? (
            <Collapsible title={I18n.t('pitChartGroup')} initiallyOpen>
              <InflowChart points={series} markerT={parseNumber(time)} width={contentWidth} />
            </Collapsible>
          ) : null}

          {comparison.length > 0 ? (
            <Collapsible title={I18n.t('pitCompareGroup')} note={`${comparison.length}`}>
              <Card style={shared.listCard}>
                {comparison.map((row) => (
                  <StatRow
                    key={row.method}
                    label={compareLabel(row.method)}
                    value={`R = ${out(row.R, QUANTITIES.DISTANCE)} · Q = ${out(row.Q, QUANTITIES.FLOW)}`}
                  />
                ))}
              </Card>
              <Note>{I18n.t('pitCompareNote')}</Note>
            </Collapsible>
          ) : null}
        </AppearIn>
      ) : (
        <AppearIn index={5}>
          <Notices codes={result.errors} prefix="pitError_" tone="error" />
        </AppearIn>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
  spaced: {
    marginTop: spacing.md,
  },
  scheme: {
    marginTop: spacing.md,
  },
});
