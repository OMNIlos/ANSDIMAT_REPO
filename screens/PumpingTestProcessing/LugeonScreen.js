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
import { SERIES_ROLES, SERIES_COLORS } from '../../calc/chartSeries';
import { processLugeon, lugeonLoop, LUGEON_FORMULAS } from '../../calc/lugeon';
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
import { spacing, radius, type, numericAt, fontFamily } from '../../theme';

/** Литров в кубометре: средний расход показывается в л/мин, как в отчёте */
const L_PER_M3 = 1000;

/**
 * Цвета ветвей петли «расход — давление»
 *
 * Прямой и обратный ход — половины одного опыта, и вся суть графика в том,
 * насколько они разошлись: по расхождению видно, раскрылись трещины упруго
 * или порода изменилась. Одним цветом петля читается как случайная загогулина.
 */
const BRANCH_COLORS = { rise: SERIES_COLORS[0], fall: SERIES_COLORS[1] };

/**
 * Исходный масштаб полотна под петлю
 *
 * Ноль стоит в углу, а не с отступом: петля из него выходит и в него
 * возвращается, и сдвинутое начало отсчёта выглядит так, будто график
 * обрезали. Поля по остальным краям узкие — петля должна занимать плоскость
 * целиком, чтобы форму её ветвей было видно без приближения.
 *
 * Ссылка общая на весь модуль: объект уходит в расчёт базовой области, и
 * новый на каждый рендер увёл бы экран в бесконечную перерисовку.
 */
const CHART_VIEWPORT = { fromOrigin: true, padX: 0.06, padY: 0.08 };

/**
 * Ключ черновика поля давления ступени
 *
 * @param {number} index - номер ступени
 * @returns {string} ключ
 */
const pressureKey = (index) => `stage.${index}.pressure`;

/**
 * Ключ черновика поля показания расходомера
 *
 * @param {number} index - номер ступени
 * @param {number} position - номер отсчёта
 * @returns {string} ключ
 */
const readingKey = (index, position) => `stage.${index}.reading.${position}`;

/**
 * Все ключи черновиков ступеней
 *
 * @param {Array<Object>} stages - ступени
 * @returns {Array<string>} ключи
 */
const stageDraftKeys = (stages) =>
  stages.flatMap((stage, index) => [
    pressureKey(index),
    ...(stage.readings ?? []).map((_, position) => readingKey(index, position)),
  ]);

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
          testID={`lugeon-pressure-${index}`}
          value={pressureText}
          onChangeText={onPressure}
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
          <View key={position} style={styles.readingCell}>
            {/* Номер отсчёта над полем. Без него ряд одинаковых клеток не
                говорит, что в них вносят: это показание расходомера в конце
                первого промежутка Δt, второго, третьего — а не расход за
                каждый из них */}
            <Text style={[numericAt(10), styles.readingIndex, { color: theme.colors.faint }]}>
              {position + 1}
            </Text>
            <TextInput
              testID={`lugeon-reading-${index}-${position}`}
              value={readingText(position)}
              onChangeText={onReading(position)}
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
          </View>
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

      {/* Расход вышел отрицательным — показания убывают. Так выглядит самая
          частая ошибка ввода: вместо нарастающего итога вносят прирост за
          каждый промежуток, и последний отсчёт оказывается меньше первого.
          Сказать об этом надо здесь, у самих полей: в подвале ступени
          «—1.250» ничего не объясняет */}
      {isFinite(row?.flow) && row.flow < 0 ? (
        <Text style={[type.caption, styles.stageWarning, { color: theme.colors.error }]}>
          {I18n.t('lugeonReadingsFalling')}
        </Text>
      ) : null}
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
      {/* Подпись до двух строк и прижата к числу снизу: «Средний расход,
          л/мин» в треть ширины телефона одной строкой не помещалась и
          обрезалась многоточием. Короткие подписи стоят на той же линии,
          что и последняя строка длинной, и числа всех трёх колонок — вровень */}
      <View style={styles.statLabelBox}>
        <Text
          style={[type.caption, styles.statLabel, { color: theme.colors.faint }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
      <Text style={[numericAt(14), { color: theme.colors.text }]} numberOfLines={1}>
        {value}
      </Text>
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
  const { text, change, forget, draftOr, draftChange } = useParamFields(
    params,
    setParams,
    fromBase,
    toBase
  );

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

  /**
   * Пишет давление ступени
   *
   * Принимает число в размерности пользователя, а не текст: разбор строки
   * лежит на черновике в `useParamFields`, здесь остаётся перевод в базовую
   * единицу. Пустое поле — ноль: ступень без давления не задана.
   *
   * @param {number} index - номер ступени
   * @param {number|null} value - давление в размерности пользователя
   */
  const setPressure = useCallback(
    (index, value) => {
      const base = value === null ? 0 : toBase(value, QUANTITIES.PRESSURE);
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.map((stage, position) =>
          position === index
            ? { ...stage, pressure: isFinite(base) ? base : 0 }
            : stage
        ),
      }));
    },
    [setParams, toBase]
  );

  /**
   * Пишет показание расходомера
   *
   * Стёртое поле — это пропуск отсчёта, а не ноль на расходомере: ноль
   * означал бы, что прибор обнулился.
   *
   * @param {number} index - номер ступени
   * @param {number} position - номер отсчёта
   * @param {number|null} input - показание в размерности пользователя
   */
  const setReading = useCallback(
    (index, position, input) => {
      const base = input === null ? null : toBase(input, QUANTITIES.VOLUME);
      const value = base === null || !isFinite(base) ? null : base;
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
      // Черновики привязаны к номеру ступени, а номера после удаления
      // съезжают: набранный текст пятой ступени оказался бы в четвёртой.
      // Числа уже в наборе величин, так что сброс черновиков не теряет ничего
      forget(...stageDraftKeys(stages));
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.filter((_, position) => position !== index),
      }));
    },
    [setParams, forget, stages]
  );

  const pressureText = useCallback(
    (index) =>
      draftOr(pressureKey(index), show(stages[index]?.pressure, QUANTITIES.PRESSURE)),
    [stages, show, draftOr]
  );

  const readingText = useCallback(
    (index, position) => {
      const value = stages[index]?.readings?.[position];
      const converted =
        value === null || value === undefined ? NaN : fromBase(value, QUANTITIES.VOLUME);
      const ready = isFinite(converted) ? String(Number(converted.toPrecision(6))) : '';
      return draftOr(readingKey(index, position), ready);
    },
    [stages, fromBase, draftOr]
  );

  /**
   * Ветви петли «расход — давление» для полотна
   *
   * Ломаная идёт по ступеням в их порядке и замыкается в нуле: без
   * избыточного давления нагнетания нет, и петля из этой точки выходит и в
   * неё возвращается (рис. 13.10, б). Подъём и спуск давления — две серии
   * разного цвета: по форме их расхождения и читается вид зависимости, а
   * одним цветом видно только, что линия куда-то сходила и вернулась.
   * Геометрия петли — в [`calc/lugeon.js`](../../calc/lugeon.js).
   *
   * Обе ветви — серии сравнения: прямую по ним не ведут, поэтому подбора
   * участка на этом графике нет, только масштаб и разворот. Сплошными они
   * идут потому, что других данных на полотне нет — пунктир отличает кривую
   * сравнения от кривой подбора, а сравнивать здесь не с чем.
   *
   * Расход в л/мин против давления в единице пользователя: так же, как в
   * таблице ступеней и в отчёте настольного АНСДИМАТ.
   */
  const loop = useMemo(() => lugeonLoop(result.stages), [result.stages]);

  const chartSeries = useMemo(() => {
    /** Точка петли в координатах полотна */
    const toPoint = (point) => ({
      t: fromBase(point.pressure, QUANTITIES.PRESSURE),
      s: (point.flow * L_PER_M3) / MINUTES_PER_DAY,
    });

    return [
      { id: 'rise', label: 'lugeonBranchRise', color: BRANCH_COLORS.rise, points: loop.rise },
      { id: 'fall', label: 'lugeonBranchFall', color: BRANCH_COLORS.fall, points: loop.fall },
    ]
      // Ветвь из одной точки линией не станет, а её ноль на полотне
      // выглядел бы замером, которого не было
      .filter((branch) => branch.points.length > 1)
      .map((branch) => ({
        id: branch.id,
        name: I18n.t(branch.label),
        color: branch.color,
        role: SERIES_ROLES.REFERENCE,
        dashed: false,
        measurements: branch.points.map(toPoint),
      }));
  }, [loop, fromBase]);

  // Масштабы по системам координат: живут в экране, потому что обычное и
  // развёрнутое полотно — два разных монтирования графика
  const viewportStore = useRef(new Map()).current;

  const problems = [];
  if (!(params?.lw > 0) || !(params?.rw > 0)) problems.push('lugeonNeedGeometry');
  if (!isFinite(result.meanLu)) problems.push('lugeonNeedStages');

  /** Класс трещиноватости в виде суффикса ключа перевода: veryLow → VeryLow */
  const rockKey = result.rockClass
    ? `${result.rockClass.id.charAt(0).toUpperCase()}${result.rockClass.id.slice(1)}`
    : '';

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
              viewport={CHART_VIEWPORT}
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
            {/* Размерность — в строке под подписью, как у остальных полей:
                в самой подписи она обрезалась на узком экране */}
            <Field
              label={I18n.t('lugeonDensity')}
              symbol="ρ"
              unit={I18n.t('unitDensity')}
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
          {/* Пояснение стоит до карточек, а не после: читают его перед тем,
              как заполнять поля, а не разбираясь, почему расход отрицательный */}
          <Note lead>{I18n.t('lugeonReadingsHint')}</Note>
          {stages.map((stage, index) => (
            <StageCard
              key={index}
              index={index}
              stage={stage}
              row={result.stages[index]}
              pressureText={pressureText(index)}
              onPressure={draftChange(pressureKey(index), (value) =>
                setPressure(index, value)
              )}
              readingText={(position) => readingText(index, position)}
              onReading={(position) =>
                draftChange(readingKey(index, position), (value) =>
                  setReading(index, position, value)
                )
              }
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
            <MaterialIcons name="add" size={18} color={theme.colors.primaryAccent} />
            <Text style={[styles.addStageText, { color: theme.colors.primaryAccent }]}>
              {I18n.t('lugeonAddStage')}
            </Text>
          </Pressable>
        </AppearIn>

        <AppearIn index={2}>
          <SectionLabel>{I18n.t('lugeonLuChart')}</SectionLabel>
          <LugeonBars stages={result.stages} />

          {/* Заголовка над полотном нет: график подписан своей строкой
              управления, и вторая подпись повторяла бы её слово в слово */}
          <DrawdownChart
            series={chartSeries}
            mode={X_MODES.LINEAR}
            width={contentWidth}
            scrollRef={scrollRef}
            fullscreen={false}
            onToggleFullscreen={() => setChartFullscreen(true)}
            caption={I18n.t('lugeonChartTitle')}
            viewKey={`lugeon:${uPress}`}
            viewport={CHART_VIEWPORT}
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
            title={I18n.t('resultConductivity')}
            label="k"
            value={out(result.meanK, QUANTITIES.CONDUCTIVITY)}
            unit={uCond}
            rows={[
              // Единица не подписывается: она уже стоит в названии величины,
              // и «Среднее Lu — 4.918 Lu» читалось бы как опечатка
              { label: I18n.t('lugeonMeanLu'), value: formatValue(result.meanLu) },
            ]}
          />
          <Card style={styles.afterResult}>
            <StatRow
              label={I18n.t('lugeonPatternTitle')}
              value={I18n.t(patternKey)}
              text
            />
            <StatRow
              label={I18n.t('lugeonRepresentative')}
              value={formatValue(result.representativeLu)}
            />
            {/* Табл. 13.5: класс берётся по представительному Lu, а не по
                среднему — среднее по петле породу характеризует хуже.

                Порода и проницаемость — двумя строками, а не одной через
                точку: под общей подписью «Трещиноватость» значение
                «Умеренная · Трещиноватые» читалось как одно слово дважды */}
            {result.rockClass ? (
              <>
                <StatRow
                  label={I18n.t('lugeonRockClass')}
                  value={I18n.t(`lugeonRock${rockKey}`)}
                  text
                />
                <StatRow
                  label={I18n.t('lugeonPermeabilityTitle')}
                  value={I18n.t(`lugeonPermeability${rockKey}`)}
                  text
                />
              </>
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
            <Note>{I18n.t('lugeonStagePlan')}</Note>
          </Collapsible>
        </AppearIn>
        </>
      )}
    </OfrTestShell>
  );
}

const styles = StyleSheet.create({
  // Карточка подробностей под карточкой результата: без зазора синяя и
  // тёмная сливались краями в один неровный блок
  afterResult: {
    marginTop: spacing.md,
  },
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
  readingCell: {
    alignItems: 'center',
    gap: 2,
  },
  readingIndex: {
    textAlign: 'center',
  },
  // Ширина под восемь знаков: нарастающий итог расходомера в литрах —
  // пять-шесть цифр и дробная часть, и в 66 px «12707.5» обрезалось до «12707.»
  reading: {
    width: 84,
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
    minWidth: 0,
    gap: 2,
  },
  statLabelBox: {
    minHeight: 34,
    justifyContent: 'flex-end',
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  stageWarning: {
    marginTop: spacing.sm,
    lineHeight: 18,
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
    gap: 6,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    marginBottom: spacing.md,
  },
  addStageText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
});
