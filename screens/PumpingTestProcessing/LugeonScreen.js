/**
 * Поинтервальное нагнетание: метод Люжона
 *
 * Интервал скважины отсекают пакерами и нагнетают в него воду ступенями
 * постоянного давления, замеряя расход по расходомеру. По каждой ступени
 * считается коэффициент фильтрации — по формуле Мойе или Тима, на выбор — и
 * параметр Люжона.
 *
 * Ступень — карточка: давление сверху, показания расходомера лентой под ним,
 * посчитанные расход, k и Lu в подвале. Общей таблицей на пять ступеней и
 * десять отсчётов это не помещается на телефон: пятьдесят ячеек в ряд
 * пришлось бы листать вбок, теряя из виду, к какой ступени они относятся.
 *
 * Показания — накопленный объём, а не расход: расходомер так и показывает,
 * и переводить его в уме перед вводом незачем. Пропуск в середине ступени
 * законен, см. calc/lugeon.js.
 *
 * Математика — в [`calc/lugeon.js`](../../calc/lugeon.js).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../../Localization';
import AppearIn from '../../components/ui/AppearIn';
import DrawdownChart from '../../components/DrawdownChart';
import { QUANTITIES, MINUTES_PER_DAY } from '../../calc/units';
import { X_MODES } from '../../calc/cooperJacob';
import { SERIES_ROLES } from '../../calc/chartSeries';
import { processLugeon, LUGEON_FORMULAS } from '../../calc/lugeon';
import { OFR_TYPES } from '../../db/schema';
import { emptyStage } from '../../db/params';
import {
  Card,
  Collapsible,
  Field,
  Formula,
  Note,
  Notices,
  OptionRow,
  ResultCard,
  SectionLabel,
  StatRow,
  formatValue,
  parseNumber,
  useCalcUnits,
} from '../calculator/shared';
import OfrTestShell, { useOfrParams, useParamFields } from './OfrTestShell';
import { spacing, radius, type, numericAt } from '../../theme';

/** Литров в кубометре: средний расход показывается в л/мин, как в отчёте */
const L_PER_M3 = 1000;

/**
 * Одна ступень нагнетания
 *
 * @param {Object} props
 * @returns {React.ReactElement} карточка ступени
 */
function StageCard({
  index,
  stage,
  row,
  pressureText,
  onPressure,
  readingText,
  onReading,
  onRemove,
  pressureUnit,
  volumeUnit,
  conductivityUnit,
  conductivityOut,
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.stage,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.stageHead}>
        <Text style={[type.eyebrow, { color: theme.colors.faint }]}>
          {I18n.t('lugeonStage', { n: index + 1 })}
        </Text>
        <Pressable
          onPress={() => onRemove(index)}
          hitSlop={8}
          accessibilityLabel={I18n.t('lugeonRemoveStage')}
        >
          <MaterialIcons name="close" size={16} color={theme.colors.faint} />
        </Pressable>
      </View>

      <View style={styles.pressureRow}>
        <Text style={[type.caption, { color: theme.colors.textSecondary }]}>
          {`${I18n.t('lugeonPressure')}, ${pressureUnit}`}
        </Text>
        <TextInput
          value={pressureText}
          onChangeText={(text) => onPressure(index, text)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="—"
          placeholderTextColor={theme.colors.faint}
          selectionColor={theme.colors.primary}
          underlineColorAndroid="transparent"
          style={[
            styles.pressureInput,
            numericAt(15),
            { color: theme.colors.secondary, borderColor: theme.colors.border },
          ]}
        />
      </View>

      <Text style={[type.caption, styles.readingsLabel, { color: theme.colors.faint }]}>
        {`${I18n.t('lugeonReadings')}, ${volumeUnit}`}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.readings}
      >
        {stage.readings.map((_, position) => (
          <TextInput
            key={position}
            value={readingText(index, position)}
            onChangeText={(text) => onReading(index, position, text)}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="—"
            placeholderTextColor={theme.colors.faint}
            selectionColor={theme.colors.primary}
            underlineColorAndroid="transparent"
            style={[
              styles.reading,
              numericAt(13),
              { color: theme.colors.text, borderColor: theme.colors.border },
            ]}
          />
        ))}
      </ScrollView>

      <View style={[styles.stageFoot, { borderTopColor: theme.colors.border }]}>
        <Stat
          label={`${I18n.t('lugeonMeanFlow')}, ${I18n.t('unitLiters')}/${I18n.t('unitMinutes')}`}
          value={
            isFinite(row?.flow)
              ? formatValue((row.flow * L_PER_M3) / MINUTES_PER_DAY)
              : '—'
          }
        />
        <Stat label={`k, ${conductivityUnit}`} value={conductivityOut(row?.k)} />
        <Stat label={I18n.t('lugeonStageLu')} value={formatValue(row?.lu)} />
      </View>
    </View>
  );
}

/**
 * Столбчатая диаграмма параметра Люжона по ступеням
 *
 * Второй из двух графиков метода (рис. 13.10, а): именно по нему сравнивают
 * опыт с эталонными видами зависимости. Петля «расход — давление» показывает
 * то же самое, но форму столбиков читать быстрее — видно сразу, вернулся ли
 * обратный ход к началу.
 *
 * Столбики, а не SVG: пять горизонтальных полос ширины «доля от максимума»
 * рисуются обычными View, и на телефоне это читается лучше графика с осями.
 *
 * @param {Object} props
 * @param {Array<{lu: number}>} props.stages - посчитанные ступени
 * @returns {React.ReactElement|null} диаграмма
 */
function LugeonBars({ stages }) {
  const theme = useTheme();
  const values = stages.map((stage) => stage.lu);
  const max = Math.max(...values.filter((value) => isFinite(value)), 0);
  if (!(max > 0)) return null;

  return (
    <View
      style={[
        styles.bars,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      {stages.map((stage, index) => (
        <View key={index} style={styles.barRow}>
          <Text
            style={[type.caption, styles.barLabel, { color: theme.colors.faint }]}
          >
            {index + 1}
          </Text>
          <View
            style={[
              styles.barTrack,
              { backgroundColor: theme.colors.surfaceSunken },
            ]}
          >
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: `${isFinite(stage.lu) ? (stage.lu / max) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={[numericAt(12), styles.barValue, { color: theme.colors.text }]}>
            {formatValue(stage.lu)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Посчитанная величина ступени
 *
 * @param {Object} props
 * @returns {React.ReactElement} подпись со значением
 */
function Stat({ label, value }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text
        style={[type.caption, { color: theme.colors.faint }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[numericAt(14), { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

export default function LugeonScreen({ route }) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const projectId = route?.params?.projectId;
  const { project, params, setParams, loading } = useOfrParams(
    projectId,
    OFR_TYPES.LUGEON
  );
  const { out, uCond, uLen, uTime, uVol, uPress, fromBase, toBase } =
    useCalcUnits();
  const { text, change } = useParamFields(params, setParams, fromBase, toBase);

  const stages = params?.stages ?? [];

  const result = useMemo(
    () =>
      processLugeon({
        stages,
        interval: params?.interval,
        lw: params?.lw,
        rw: params?.rw,
        density: params?.density,
        formula: params?.formula,
      }),
    [stages, params]
  );

  /**
   * Показывает базовое число в размерности пользователя
   *
   * @param {number} value - значение в базовой единице
   * @param {string} quantity - величина, см. QUANTITIES
   * @returns {string} текст поля
   */
  const show = useCallback(
    (value, quantity) => {
      if (value === null || value === undefined || !isFinite(value) || value === 0) {
        return '';
      }
      const converted = fromBase(value, quantity);
      return isFinite(converted) ? String(Number(converted.toPrecision(6))) : '';
    },
    [fromBase]
  );

  const setPressure = useCallback(
    (index, input) => {
      const parsed = parseNumber(input);
      const value = isFinite(parsed) ? toBase(parsed, QUANTITIES.PRESSURE) : 0;
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.map((stage, position) =>
          position === index ? { ...stage, pressure: value } : stage
        ),
      }));
    },
    [setParams, toBase]
  );

  const setReading = useCallback(
    (index, position, input) => {
      const trimmed = String(input).replace(',', '.').trim();
      // Стёртое поле — это пропуск отсчёта, а не ноль на расходомере
      const parsed = trimmed === '' ? null : Number(trimmed);
      const value =
        parsed === null || !isFinite(parsed)
          ? null
          : toBase(parsed, QUANTITIES.VOLUME);
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.map((stage, stageIndex) =>
          stageIndex === index
            ? {
                ...stage,
                readings: stage.readings.map((reading, readingIndex) =>
                  readingIndex === position ? value : reading
                ),
              }
            : stage
        ),
      }));
    },
    [setParams, toBase]
  );

  const addStage = useCallback(() => {
    setParams((previous) => ({
      ...previous,
      stages: [...previous.stages, emptyStage()],
    }));
  }, [setParams]);

  const removeStage = useCallback(
    (index) => {
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.filter((_, position) => position !== index),
      }));
    },
    [setParams]
  );

  const pressureText = useCallback(
    (index) => show(stages[index]?.pressure, QUANTITIES.PRESSURE),
    [stages, show]
  );

  const readingText = useCallback(
    (index, position) => {
      const value = stages[index]?.readings?.[position];
      if (value === null || value === undefined) return '';
      const converted = fromBase(value, QUANTITIES.VOLUME);
      return isFinite(converted) ? String(Number(converted.toPrecision(6))) : '';
    },
    [stages, fromBase]
  );

  /**
   * Серия «расход — давление» для полотна
   *
   * Ломаная идёт по ступеням в их порядке: прямой ход и обратный дают петлю,
   * по форме которой и читается вид зависимости (рис. 13.10, б). Прямую по
   * ней не ведут — роль `reference`, — поэтому подбора участка на этом
   * графике нет, только масштаб и разворот.
   *
   * Расход в л/мин против давления в единице пользователя: так же, как в
   * таблице ступеней и в отчёте настольного АНСДИМАТ.
   */
  const chartSeries = useMemo(
    () => [
      {
        id: 'lugeon',
        role: SERIES_ROLES.REFERENCE,
        measurements: result.stages
          .filter((row) => isFinite(row.pressure) && isFinite(row.flow))
          .map((row) => ({
            t: fromBase(row.pressure, QUANTITIES.PRESSURE),
            s: (row.flow * L_PER_M3) / MINUTES_PER_DAY,
          })),
      },
    ],
    [result.stages, fromBase]
  );

  // Масштабы по системам координат: живут в экране, потому что обычное и
  // развёрнутое полотно — два разных монтирования графика
  const viewportStore = useRef(new Map()).current;

  const problems = [];
  if (!(params?.lw > 0) || !(params?.rw > 0)) problems.push('lugeonNeedGeometry');
  if (!isFinite(result.meanLu)) problems.push('lugeonNeedStages');

  const patternKey = `lugeonPattern${result.pattern
    .charAt(0)
    .toUpperCase()}${result.pattern.slice(1)}`;
  const hintKey = `lugeonHint${result.pattern
    .charAt(0)
    .toUpperCase()}${result.pattern.slice(1)}`;

  return (
    <OfrTestShell
      title="lugeonTitle"
      subtitle="lugeonSubtitle"
      name={project?.name}
      loading={loading}
      overlay={
        /* Развёрнутый график: то же полотно во весь экран. Свой
           GestureHandlerRootView обязателен — содержимое Modal лежит вне
           корневого, и без него жесты до графика не дошли бы */
        <Modal
          visible={chartFullscreen}
          animationType="none"
          onRequestClose={() => setChartFullscreen(false)}
          supportedOrientations={['portrait', 'landscape']}
          statusBarTranslucent
        >
          <GestureHandlerRootView
            style={[
              styles.fullscreen,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <DrawdownChart
              series={chartSeries}
              mode={X_MODES.LINEAR}
              width={windowWidth}
              height={windowHeight}
              caption={I18n.t('lugeonChartTitle')}
              viewKey={`lugeon:${uPress}`}
              xAxisTitle={`${I18n.t('lugeonPressure')}, ${uPress}`}
              yAxisTitle={`Q, ${I18n.t('unitLiters')}/${I18n.t('unitMinutes')}`}
              emptyTitle={I18n.t('chartEmpty')}
              emptyHint={I18n.t('lugeonNeedStages')}
              viewportStore={viewportStore}
              fullscreen
              onToggleFullscreen={() => setChartFullscreen(false)}
            />
          </GestureHandlerRootView>
        </Modal>
      }
    >
      {({ contentWidth, scrollRef }) => (
        <>
        <AppearIn index={0}>
          <SectionLabel style={styles.firstLabel}>
            {I18n.t('ofrInputs')}
          </SectionLabel>
          <Card>
            <Field
              label={I18n.t('lugeonIntervalLength')}
              symbol="l_w"
              unit={uLen}
              value={text('lw', QUANTITIES.DISTANCE)}
              onChange={change('lw', QUANTITIES.DISTANCE)}
              error={!(params?.lw > 0)}
            />
            <Field
              label={I18n.t('lugeonWellRadius')}
              symbol="r_w"
              unit={uLen}
              value={text('rw', QUANTITIES.DISTANCE)}
              onChange={change('rw', QUANTITIES.DISTANCE)}
              error={!(params?.rw > 0)}
            />
            <Field
              label={I18n.t('lugeonReadingInterval')}
              symbol="Δt"
              unit={uTime}
              value={text('interval', QUANTITIES.TIME)}
              onChange={change('interval', QUANTITIES.TIME)}
              error={!(params?.interval > 0)}
            />
            <Field
              label={I18n.t('lugeonDensity')}
              symbol="ρ"
              value={text('density')}
              onChange={change('density')}
            />
          </Card>

          {/* Формулы Мойе и Тима дают близкие результаты, но какая из них
              стоит в отчёте — решает геолог, и выбор сохраняется с журналом */}
          <SectionLabel>{I18n.t('lugeonFormula')}</SectionLabel>
          <OptionRow
            value={params?.formula ?? LUGEON_FORMULAS.MOYE}
            onChange={(value) =>
              setParams((previous) => ({ ...previous, formula: value }))
            }
            options={[
              { value: LUGEON_FORMULAS.MOYE, label: I18n.t('lugeonFormulaMoye') },
              { value: LUGEON_FORMULAS.THIEM, label: I18n.t('lugeonFormulaThiem') },
            ]}
          />
        </AppearIn>

        <AppearIn index={1}>
          <SectionLabel>{I18n.t('lugeonStagesTitle')}</SectionLabel>
          {stages.map((stage, index) => (
            <StageCard
              key={index}
              index={index}
              stage={stage}
              row={result.stages[index]}
              pressureText={pressureText(index)}
              onPressure={setPressure}
              readingText={readingText}
              onReading={setReading}
              onRemove={removeStage}
              pressureUnit={uPress}
              volumeUnit={uVol}
              conductivityUnit={uCond}
              conductivityOut={(value) => out(value, QUANTITIES.CONDUCTIVITY)}
            />
          ))}
          <Pressable
            onPress={addStage}
            style={[
              styles.addStage,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <MaterialIcons name="add" size={16} color={theme.colors.primary} />
            <Text style={[type.caption, { color: theme.colors.primary }]}>
              {I18n.t('lugeonAddStage')}
            </Text>
          </Pressable>
        </AppearIn>

        <AppearIn index={2}>
          <SectionLabel>{I18n.t('lugeonLuChart')}</SectionLabel>
          <LugeonBars stages={result.stages} />
          <Note>{I18n.t('lugeonStagePlan')}</Note>

          <SectionLabel>{I18n.t('lugeonChartTitle')}</SectionLabel>
          <DrawdownChart
            series={chartSeries}
            mode={X_MODES.LINEAR}
            width={contentWidth}
            scrollRef={scrollRef}
            fullscreen={false}
            onToggleFullscreen={() => setChartFullscreen(true)}
            caption={I18n.t('lugeonChartTitle')}
            viewKey={`lugeon:${uPress}`}
            xAxisTitle={`${I18n.t('lugeonPressure')}, ${uPress}`}
            yAxisTitle={`Q, ${I18n.t('unitLiters')}/${I18n.t('unitMinutes')}`}
            emptyTitle={I18n.t('chartEmpty')}
            emptyHint={I18n.t('lugeonNeedStages')}
            viewportStore={viewportStore}
          />
        </AppearIn>

        <AppearIn index={3}>
          <Notices codes={problems} tone="error" />
          <ResultCard
            title={I18n.t('quantityConductivity')}
            label="k"
            value={out(result.meanK, QUANTITIES.CONDUCTIVITY)}
            unit={uCond}
            rows={[
              {
                label: I18n.t('lugeonMeanLu'),
                value: formatValue(result.meanLu),
                unit: 'Lu',
              },
            ]}
          />
          <Card>
            <StatRow
              label={I18n.t('lugeonPatternTitle')}
              value={I18n.t(patternKey)}
            />
            <StatRow
              label={I18n.t('lugeonRepresentative')}
              value={formatValue(result.representativeLu)}
            />
            {/* Табл. 13.5: класс берётся по представительному Lu, а не по
                среднему — среднее по петле породу характеризует хуже */}
            {result.rockClass ? (
              <StatRow
                label={I18n.t('lugeonRockClass')}
                value={`${I18n.t(
                  `lugeonPermeability${result.rockClass.id.charAt(0).toUpperCase()}${result.rockClass.id.slice(1)}`
                )} · ${I18n.t(
                  `lugeonRock${result.rockClass.id.charAt(0).toUpperCase()}${result.rockClass.id.slice(1)}`
                )}`}
              />
            ) : null}
          </Card>
          <Note>{I18n.t(hintKey)}</Note>

          <Collapsible title={I18n.t('ofrMethodTitle')} note="ƒ">
            <Formula>
              {params?.formula === LUGEON_FORMULAS.THIEM
                ? I18n.t('lugeonThiemMethod')
                : I18n.t('lugeonMethod')}
            </Formula>
            <Formula>{I18n.t('lugeonLuMethod')}</Formula>
            <Note>{I18n.t('lugeonScale')}</Note>
          </Collapsible>
        </AppearIn>
        </>
      )}
    </OfrTestShell>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
  stage: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pressureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pressureInput: {
    flex: 1,
    textAlign: 'right',
    paddingVertical: spacing.xs,
  },
  readingsLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  readings: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  reading: {
    width: 66,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  stageFoot: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  bars: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  barLabel: {
    width: 14,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: radius.chip,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.chip,
  },
  barValue: {
    width: 52,
    textAlign: 'right',
  },
  fullscreen: {
    flex: 1,
  },
  addStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    marginBottom: spacing.md,
  },
});
