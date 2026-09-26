/**
 * Экспресс-опробование: решение Бауэра — Райса
 *
 * В скважину разом доливают или из неё разом вычерпывают объём воды, уровень
 * скачком уходит на s⁰ и сам возвращается к статическому. Журнал — время и
 * восстановление уровня, как на восстановлении после откачки: значения растут
 * от нуля до s⁰. Обработка идёт способом прямой линии по графику
 * lg(s⁰/s) — t, где s — остаток скачка; по наклону прямой считается
 * коэффициент фильтрации.
 *
 * Экран собран из трёх частей в том порядке, в каком их заполняют: геометрия
 * скважины (без неё не посчитать радиус влияния), скачок понижения, журнал.
 * График идёт последним — он показывает то, что уже введено.
 *
 * Полотно то же, что у откачек (`components/chart`): те же способы провести
 * прямую, тот же масштаб щипком и растяжением осей, тот же разворот на весь
 * экран. Прямая здесь несёт k, и выбирать участок записи по ней приходится
 * ровно так же, как на откачке, — отдельный упрощённый график значил бы, что
 * половина обработки делается вслепую.
 *
 * Отличие одно: по ординате отложено не понижение, а безразмерное lg(s⁰/s),
 * и абсцисса линейная — прямая обязана выходить из начала координат.
 *
 * Математика — в [`calc/slugTest.js`](../../calc/slugTest.js).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import I18n from '../../Localization';
import AppearIn from '../../components/ui/AppearIn';
import DrawdownChart, { FIT_MODES } from '../../components/DrawdownChart';
import { QUANTITIES } from '../../calc/units';
import { X_MODES } from '../../calc/cooperJacob';
import { SERIES_ROLES } from '../../calc/chartSeries';
import { toggleSelection, freeLine } from '../../calc/chartGeometry';
import { processSlugTest } from '../../calc/slugTest';
import { OFR_TYPES } from '../../db/schema';
import { replaceMeasurements } from '../../db/projects';
import {
  Card,
  Collapsible,
  Field,
  FittedFormula,
  FittedStatRow,
  Formula,
  Note,
  Notices,
  ResultCard,
  SectionLabel,
  StatRow,
  parseNumber,
  useCalcUnits,
} from '../calculator/shared';
import OfrTestShell, { useOfrParams, useParamFields } from './OfrTestShell';
import JournalTable from './JournalTable';
import { spacing } from '../../theme';

/** Знаков, до которых режется число при показе в поле журнала */
const SHOWN_PRECISION = 6;

export default function SlugTestScreen({ route }) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const projectId = route?.params?.projectId;
  const { project, params, setParams, loading } = useOfrParams(
    projectId,
    OFR_TYPES.SLUG
  );
  const { out, uCond, uLen, uDraw, uTime, fromBase, toBase } = useCalcUnits();
  const { text, change } = useParamFields(params, setParams, fromBase, toBase);

  // Журнал живёт строками текста, а не числами: пока замер набирают, «0.» и
  // пустая строка — законные состояния поля, а число из них не разбирается
  const [rows, setRows] = useState([]);

  // Как проведена прямая. Хранит экран, а не график: через неё считается k,
  // и те же отметки нужны расчёту, а не только полотну
  const [fitMode, setFitMode] = useState(FIT_MODES.AUTO);
  const [selectedPoints, setSelectedPoints] = useState([]);
  // Свободные точки в базовых единицах: время в минутах, ордината
  // безразмерна. Иначе смена размерности времени сдвигала бы прямую, а
  // вместе с ней и коэффициент фильтрации
  const [freeAnchors, setFreeAnchors] = useState(null);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  // Масштабы по системам координат: живут в экране, потому что обычное и
  // развёрнутое полотно — два разных монтирования графика
  const viewportStore = useRef(new Map()).current;

  useEffect(() => {
    if (!project) return;
    const show = (value, quantity) => {
      if (!value) return '';
      const converted = fromBase(value, quantity);
      return isFinite(converted)
        ? String(Number(converted.toPrecision(SHOWN_PRECISION)))
        : '';
    };
    setRows(
      (project.measurements ?? []).map((measurement) => ({
        key: measurement.id,
        id: measurement.id,
        tText: show(measurement.t, QUANTITIES.TIME),
        sText: show(measurement.s, QUANTITIES.DRAWDOWN),
      }))
    );
    // fromBase меняется вместе с настройкой размерности: журнал нужно
    // перечитать, иначе в полях останутся числа прежней единицы
  }, [project, fromBase]);

  /**
   * Пишет журнал в базу
   *
   * Строки без времени или понижения не сохраняются: пустая строка — это
   * место под замер, а не замер со значением ноль.
   *
   * @param {Array<Object>} next - строки таблицы
   */
  const save = useCallback(
    (next) => {
      if (!projectId) return;
      const measurements = next
        .map((row) => ({
          id: row.id,
          t: toBase(parseNumber(row.tText), QUANTITIES.TIME),
          s: toBase(parseNumber(row.sText), QUANTITIES.DRAWDOWN),
        }))
        .filter((row) => isFinite(row.t) && isFinite(row.s));
      replaceMeasurements(projectId, measurements).catch(() => {
        // Правка остаётся на экране: ронять ввод из-за отказа базы незачем
      });
    },
    [projectId, toBase]
  );

  const editRow = useCallback(
    (index, field, value) => {
      setRows((previous) => {
        const next = previous.map((row, position) =>
          position === index ? { ...row, [field]: value } : row
        );
        save(next);
        return next;
      });
    },
    [save]
  );

  const addRow = useCallback(() => {
    setRows((previous) => [
      ...previous,
      { key: `new-${Date.now()}`, tText: '', sText: '' },
    ]);
  }, []);

  const removeRow = useCallback(
    (index) => {
      setRows((previous) => {
        const next = previous.filter((_, position) => position !== index);
        save(next);
        return next;
      });
    },
    [save]
  );

  // Замеры в числовом виде — общий источник для расчёта и графика
  const measurements = useMemo(
    () =>
      rows
        .map((row) => ({
          t: toBase(parseNumber(row.tText), QUANTITIES.TIME),
          s: toBase(parseNumber(row.sText), QUANTITIES.DRAWDOWN),
        }))
        .filter((row) => isFinite(row.t) && isFinite(row.s)),
    [rows, toBase]
  );

  // Прямая, проведённая руками по плоскости. Приходит в расчёт готовой:
  // точки лежат в базовых единицах, и наклон сразу в 1/мин
  const manualLine = useMemo(() => {
    if (fitMode !== FIT_MODES.FREEDOM) return undefined;
    const line = freeLine(freeAnchors);
    return line.ready ? line : undefined;
  }, [fitMode, freeAnchors]);

  const result = useMemo(
    () =>
      processSlugTest({
        measurements,
        initialDrawdown: params?.s0,
        rw: params?.rw,
        rc: params?.rc,
        lw: params?.lw,
        lt: params?.lt,
        m: params?.m,
        selected: fitMode === FIT_MODES.AUTO ? selectedPoints : undefined,
        freeLine: manualLine,
      }),
    [measurements, params, fitMode, selectedPoints, manualLine]
  );

  /**
   * Серия для полотна в размерностях пользователя
   *
   * График рисует то, что видит геолог: время в выбранной единице, по
   * ординате безразмерное lg(s⁰/s). Расчёт идёт по тем же точкам в базовых
   * единицах, см. `result.points`.
   */
  const chartSeries = useMemo(
    () => [
      {
        id: 'slug',
        role: SERIES_ROLES.FIT,
        measurements: result.points.map((point) => ({
          t: fromBase(point.t, QUANTITIES.TIME),
          s: point.y,
        })),
      },
    ],
    [result.points, fromBase]
  );

  // Свободные точки на полотне: по абсциссе — в единице пользователя
  const chartAnchors = useMemo(
    () =>
      freeAnchors?.length === 2
        ? freeAnchors.map((anchor) => ({
            x: fromBase(anchor.x, QUANTITIES.TIME),
            y: anchor.y,
          }))
        : null,
    [freeAnchors, fromBase]
  );

  /**
   * Принимает свободные точки от графика и переводит их в базовые единицы
   *
   * @param {Array<{x: number, y: number}>} next - точки в координатах графика
   */
  const handleAnchorsChange = useCallback(
    (next) => {
      if (next?.length !== 2) return;
      setFreeAnchors(
        next.map((anchor) => ({
          x: toBase(anchor.x, QUANTITIES.TIME),
          y: anchor.y,
        }))
      );
    },
    [toBase]
  );

  const handleToggleSelect = useCallback((index) => {
    setSelectedPoints((previous) => toggleSelection(previous, index));
  }, []);

  const handleFitModeChange = useCallback((next) => {
    setFitMode(next);
    // Отметки замеров не снимаются: вернувшись в авто, геолог должен увидеть
    // ту же прямую, что вёл до перехода. Свободные точки, наоборот,
    // сбрасываются — график поставит их заново на нынешнюю прямую
    if (next === FIT_MODES.FREEDOM) setFreeAnchors(null);
  }, []);

  /**
   * Чем задана система координат
   *
   * Меняется только от выбранной размерности времени: правка замера масштаб
   * не сбрасывает — геолог приблизил поздний участок, поправил опечатку, и
   * окно должно остаться там же.
   */
  const chartViewKey = `slug:${uTime}`;

  // Что мешает расчёту: сначала геометрия — без неё не считается радиус
  // влияния и график строить не по чему, потом скачок, потом сами замеры
  const problems = [];
  if (!(result.influenceLog > 0)) problems.push('slugNeedGeometry');
  if (!(params?.s0 > 0)) problems.push('slugNeedInitialDrawdown');
  else if (result.points.length < 2) problems.push('slugNeedMeasurements');

  // Оговорки к посчитанному радиусу влияния: они не ошибки, но результат
  // получен не совсем по замерам, и об этом надо сказать
  const notes = [];
  notes.push(result.partial ? 'slugSchemePartial' : 'slugSchemeFull');
  if (result.capped) notes.push('slugThicknessCapped');
  // Про излом говорится только там, где его искали: прямую по отметкам и
  // проведённую руками разбиение не трогает
  if (result.split !== null) notes.push('slugTwoSegments');
  if (isFinite(params?.lw) && isFinite(params?.rw) && params.rw > 0) {
    const beta = params.lw / params.rw;
    if (beta < 1 || beta > 2000) notes.push('slugBetaClamped');
  }

  // В радиус влияния идут не все три коэффициента разом: у фильтра короче
  // пласта — A₁ и A₂, у фильтра во всю мощность — один A₃. Показывать заодно
  // и неиспользованные значит звать сверять расчёт не с теми числами.
  // Каждый на своей строке и во столько цифр, сколько в неё влезает: сверка
  // с настольным АНСДИМАТ идёт по дальним знакам
  const coefficients = result.partial
    ? [
        { label: 'A₁', value: result.A1 },
        { label: 'A₂', value: result.A2 },
      ]
    : [{ label: 'A₃', value: result.A3 }];

  return (
    <OfrTestShell
      title="slugTitle"
      subtitle="slugSubtitle"
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
              fitMode={fitMode}
              onFitModeChange={handleFitModeChange}
              selected={selectedPoints}
              onToggleSelect={handleToggleSelect}
              anchors={chartAnchors}
              onAnchorsChange={handleAnchorsChange}
              caption="lg(s⁰/s) — t"
              viewKey={chartViewKey}
              xAxisTitle={`t, ${uTime}`}
              yAxisTitle="lg(s⁰/s)"
              emptyTitle={I18n.t('chartEmpty')}
              emptyHint={I18n.t('slugNeedMeasurements')}
              timeUnit={uTime}
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
            {I18n.t('slugWellSection')}
          </SectionLabel>
          <Card>
            <Field
              label={I18n.t('slugFilterRadius')}
              symbol="r_w"
              unit={uLen}
              value={text('rw', QUANTITIES.DISTANCE)}
              onChange={change('rw', QUANTITIES.DISTANCE)}
              error={!(params?.rw > 0)}
            />
            <Field
              label={I18n.t('slugCasingRadius')}
              symbol="r_c"
              unit={uLen}
              value={text('rc', QUANTITIES.DISTANCE)}
              onChange={change('rc', QUANTITIES.DISTANCE)}
              error={!(params?.rc > 0)}
            />
            <Field
              label={I18n.t('slugFilterLength')}
              symbol="l_w"
              unit={uLen}
              value={text('lw', QUANTITIES.DISTANCE)}
              onChange={change('lw', QUANTITIES.DISTANCE)}
              error={!(params?.lw > 0)}
            />
            <Field
              label={I18n.t('slugFilterMiddle')}
              symbol="LT_w"
              unit={uLen}
              value={text('lt', QUANTITIES.DISTANCE)}
              onChange={change('lt', QUANTITIES.DISTANCE)}
              error={!(params?.lt > 0)}
            />
            <Field
              label={I18n.t('slugThickness')}
              symbol="m"
              unit={uLen}
              value={text('m', QUANTITIES.DISTANCE)}
              onChange={change('m', QUANTITIES.DISTANCE)}
            />
            <Field
              label={I18n.t('slugInitialDrawdown')}
              symbol="s⁰"
              unit={uDraw}
              value={text('s0', QUANTITIES.DRAWDOWN)}
              onChange={change('s0', QUANTITIES.DRAWDOWN)}
              error={!(params?.s0 > 0)}
            />
          </Card>
          <Notices codes={notes} />
        </AppearIn>

        <AppearIn index={1}>
          <SectionLabel>{I18n.t('slugJournalTitle')}</SectionLabel>
          <Note lead>{I18n.t('slugJournalNote')}</Note>
          <JournalTable
            rows={rows}
            onChange={editRow}
            onAdd={addRow}
            onRemove={removeRow}
            timeUnit={uTime}
            valueUnit={uDraw}
            valueLabel="Δs"
          />
        </AppearIn>

        <AppearIn index={2}>
          <SectionLabel>{I18n.t('ofrChart')}</SectionLabel>
          <DrawdownChart
            series={chartSeries}
            mode={X_MODES.LINEAR}
            width={contentWidth}
            scrollRef={scrollRef}
            fitMode={fitMode}
            onFitModeChange={handleFitModeChange}
            selected={selectedPoints}
            onToggleSelect={handleToggleSelect}
            anchors={chartAnchors}
            onAnchorsChange={handleAnchorsChange}
            fullscreen={false}
            onToggleFullscreen={() => setChartFullscreen(true)}
            caption="lg(s⁰/s) — t"
            viewKey={chartViewKey}
            xAxisTitle={`t, ${uTime}`}
            yAxisTitle="lg(s⁰/s)"
            emptyTitle={I18n.t('chartEmpty')}
            emptyHint={I18n.t('slugNeedMeasurements')}
            timeUnit={uTime}
            viewportStore={viewportStore}
          />
          <Note>{I18n.t('slugLineNote')}</Note>
        </AppearIn>

        <AppearIn index={3}>
          <Notices codes={problems} tone="error" />
          <ResultCard
            title={I18n.t('resultConductivity')}
            label="k"
            value={out(result.k, QUANTITIES.CONDUCTIVITY)}
            unit={uCond}
          />
          <Card style={styles.afterResult}>
            <FittedStatRow
              label={I18n.t('slugInfluenceRadius')}
              value={result.influenceLog}
              testID="slug-influence-log"
            />
            <FittedStatRow
              label={I18n.t('slugBeta')}
              value={result.beta}
              testID="slug-beta"
            />
            {/* Тот же k, что в карточке выше, но во всех знаках, какие влезают
                в строку: настольный АНСДИМАТ подписывает k семью значащими
                цифрами, и по четырём из карточки сверить расчёт нельзя —
                расхождение в пятом знаке выглядит как «близко, но не то» */}
            <FittedStatRow
              label={`k, ${uCond}`}
              value={fromBase(result.k, QUANTITIES.CONDUCTIVITY)}
              testID="slug-k-precise"
            />
            {/* Низ фильтра считается из середины: показан, чтобы схему было
                видно числом, а не только по подписи поля */}
            <StatRow
              label={I18n.t('slugFilterBottom')}
              value={`${out(result.z, QUANTITIES.DISTANCE)} ${uLen}`}
            />
            {/* Первый участок в ответ не идёт, но его k показывают рядом:
                настольный АНСДИМАТ подписывает на чертеже обе прямые, и
                сверять расчёт удобнее, когда видно оба числа */}
            {isFinite(result.firstK) ? (
              <FittedStatRow
                label={`${I18n.t('slugFirstSegmentK')}, ${uCond}`}
                value={fromBase(result.firstK, QUANTITIES.CONDUCTIVITY)}
                testID="slug-first-k"
              />
            ) : null}
          </Card>

          <Collapsible title={I18n.t('ofrMethodTitle')} note="ƒ">
            <Formula>{I18n.t('slugMethod')}</Formula>
            <FittedFormula lines={coefficients} testID="slug-coefficients" />
            <Note>{I18n.t('slugLineNote')}</Note>
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
  fullscreen: {
    flex: 1,
  },
});
