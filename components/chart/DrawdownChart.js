/**
 * График понижения — основной инструмент графоаналитической обработки
 *
 * По вертикали понижение s (м), по горизонтали время в одном из режимов:
 * lg t, t или √t. Каждый режим спрямляет свой тип кривой, поэтому геолог
 * переключает оси, пока точки не лягут на прямую.
 *
 * Компонент только собирает части. Считают за него чистые модули: серии —
 * `calc/chartSeries.js`, область просмотра — `calc/chartViewport.js`, сцена —
 * `calc/chartScene.js`. Жесты и масштаб живут в `useChartViewport`. Так
 * устроено потому, что всё перечисленное проверяется тестами, а разметка —
 * нет, и держать их в одном файле значит лишить проверки и то и другое.
 *
 * Прямую строят в двух режимах, см. FIT_MODES. В обычном она идёт по всем
 * замерам, а отметив две точки, геолог заменяет её прямой через них: начало
 * откачки и выход на границу пласта в прямую не ложатся, и там ручной выбор
 * участка даёт более достоверный наклон. В свободном прямую держат две точки,
 * поставленные где угодно на плоскости: их тащат пальцем или ставят касанием.
 *
 * Масштаб меняется тремя способами: кнопками — равномерно, щипком — по каждой
 * оси в меру разброса пальцев вдоль неё, и перетаскиванием полосы оси — только
 * по этой оси. Последние два взяты у Desmos: чтобы вытянуть поздний участок
 * записи по времени, не теряя размаха по понижению.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { linearRegression, lineThroughPoints, X_MODES } from '../../calc/cooperJacob';
import { anchorsOnLine, freeLine } from '../../calc/chartGeometry';
import { buildSeries, SERIES_ROLES } from '../../calc/chartSeries';
import { fitViewport } from '../../calc/chartViewport';
import { buildScene } from '../../calc/chartScene';
import ChartCanvas from './ChartCanvas';
import ChartToolbar from './ChartToolbar';
import useChartViewport from './useChartViewport';
import { FIT_MODES } from './fitModes';
import { spacing, radius, type, fontFamily } from '../../theme';

export { FIT_MODES };

const DEFAULT_HEIGHT = 230;

/**
 * Поля вокруг области построения, px
 *
 * В развёрнутом виде они шире: сверху стоит подпись осей и легенда, справа —
 * колонка кнопок, снизу — переключатели способа прямой. Держать данные под
 * ними значило бы отдать управлению ту самую площадь, ради которой график и
 * разворачивают.
 */
const PADDING = { left: 46, right: 14, top: 14, bottom: 38 };

/**
 * Поля развёрнутого полотна, px
 *
 * Справа поле узкое: кнопки масштаба висят поверх плоскости, а не отодвигают
 * её. Так делает Desmos, и так координатной плоскости достаётся вся ширина —
 * ради этого разворот и нажимают. Слева поле под подписи оси ординат.
 */
const PADDING_FULL = { left: 56, right: 20 };

/** Высота строки управления вверху развёрнутого полотна, px */
const CONTROL_ROW_HEIGHT = 56;

/** Сколько нужно снизу под подписи оси абсцисс, px */
const AXIS_LABEL_ROOM = 30;

/** Пределы масштаба относительно исходного вида */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 50;

/**
 * Пустой список — общая ссылка на весь модуль
 *
 * Умолчание вида `measurements = []` создаёт новый массив на каждый рендер.
 * Такой массив попадает в зависимости мемо, мемо пересчитывается всегда, и
 * дальше по цепочке новая базовая область вызывает setState в эффекте —
 * получается бесконечная перерисовка. Общая ссылка эту цепочку разрывает.
 */
const EMPTY = [];

export default function DrawdownChart({
  /**
   * Замеры ряда: [{ t, s }]
   *
   * Совместимый вход: если `series` не задан, из него и `extraSeries`
   * собирается список серий. У точки могут стоять `group` и `groupName` —
   * тогда ряд красится по группе и попадает в легенду.
   */
  measurements = EMPTY,
  /**
   * Кривые остальных скважин куста: [{ id, name, measurements }]
   *
   * Соседние кривые нужны для сравнения: по кусту сразу видно, какая скважина
   * выбивается из общей картины. В масштаб они входят наравне с основной,
   * иначе часть графика уезжала бы за край.
   */
  extraSeries = EMPTY,
  /**
   * Серии целиком: [{ id, name, role, color?, measurements }]
   *
   * Общий вход вместо `measurements` и `extraSeries`. Роль `fit` означает, что
   * по серии идёт прямая и на ней отмечаются точки; `reference` — что серия
   * только для сравнения. Через это на полотно попадает кривая восстановления.
   */
  series,
  // Название открытой скважины: нужно только легенде, и только когда кривых
  // больше одной
  activeSeriesName,
  /**
   * Выбор кривой, по которой ведётся прямая: (seriesId) => void
   *
   * У куста на плоскости s — lg t лежит несколько кривых: открытая скважина и
   * соседние. Прямая идёт по открытой, и до этого сменить её можно было
   * только чипом скважины над журналом — далеко от полотна, на котором эту
   * прямую и двигают. Разница не косметическая: в пьезопроводность входит
   * расстояние r, своё у каждой скважины.
   *
   * Без обработчика легенда остаётся подписью: на одиночной откачке вторая
   * кривая — это фаза восстановления, и выбирать там нечего.
   */
  onSelectSeries,
  mode = X_MODES.LOG,
  width = 340,
  onFitChange,
  // Прокручиваемый контейнер, внутри которого лежит график. Пока идёт жест
  // по графику, прокрутка блокируется штатным механизмом RNGH
  scrollRef,
  // Способ построения прямой и выбранные точки хранит экран: те же точки
  // можно отмечать и в таблице замеров, поэтому состояние должно быть общим
  fitMode = FIT_MODES.AUTO,
  onFitModeChange,
  selected = EMPTY,
  onToggleSelect,
  /**
   * Свободные точки: [{ x, y }] в координатах графика
   *
   * Живут в состоянии экрана, а не графика: через них считается прямая, а
   * через прямую — водопроводимость.
   */
  anchors,
  onAnchorsChange,
  /**
   * Чем задана нынешняя система координат
   *
   * Меняется при смене вида графика, фазы опыта, момента площадного среза и
   * выбранных размерностей. От правки замеров не меняется: масштаб геолог
   * ставит руками, и терять его посреди работы с журналом нельзя.
   */
  viewKey = '',
  /**
   * Хранилище масштабов по ключу системы координат
   *
   * Живёт в экране и приходит сюда пропсом: развёрнутый и обычный график —
   * две разные ветки рендера, то есть два разных монтирования компонента, и
   * хранилище внутри графика их бы не пережило.
   */
  viewportStore,
  // Подпись осей. По умолчанию выводится из режима, но на восстановлении
  // по оси X отложено отношение t/t′, а не время — там подпись своя
  caption,
  /**
   * Подпись величины у оси абсцисс: «t, мин», «r, м», «t/r², мин/м²»
   *
   * Заголовок над полотном называет график целиком (`s — lg r`), а это —
   * что именно отложено по оси.
   */
  xAxisTitle,
  /**
   * Подпись величины у оси ординат: «s, м», «lg(s⁰/s)», «Q, л/мин»
   *
   * По умолчанию — понижение: на откачке по ординате отложено оно. У видов
   * ОФР со своей схемой по этой оси лежит другое — безразмерный логарифм
   * отношения уровней у экспресс-опробования, расход у нагнетания, — и
   * подпись «s, м» там просто врала бы.
   */
  yAxisTitle,
  /**
   * Почему на полотне пусто
   *
   * Причин у пустого графика несколько, и общая подсказка «внесите замеры»
   * врёт, когда замеры внесены, а не хватает расстояний или общего момента.
   */
  emptyTitle,
  emptyHint,
  // Размерности осей для подписей. Приходят снаружи: экран знает выбор
  // пользователя, график получает уже пересчитанные точки
  timeUnit = 'мин',
  drawdownUnit = 'м',
  // Развёрнут ли график на весь экран
  fullscreen = false,
  onToggleFullscreen,
  // Высота графика: в развёрнутом виде её задаёт экран
  height,
}) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  /**
   * Настоящий размер полотна в развёрнутом виде
   *
   * Меряем сам себя, а не берём переданные ширину и высоту окна: контейнер
   * экрана ниже окна на системные полосы, и полотно вылезало за него —
   * подписи оси абсцисс и полоса её растяжения оказывались за пределами
   * компонента, на белом фоне приложения, и до полосы было не дотянуться.
   */
  const [box, setBox] = useState(null);
  const handleLayout = useCallback((event) => {
    const next = event.nativeEvent.layout;
    setBox((prev) =>
      prev && prev.width === next.width && prev.height === next.height
        ? prev
        : { width: next.width, height: next.height }
    );
  }, []);

  const chartWidth = fullscreen && box?.width > 0 ? box.width : width;
  const chartHeight = fullscreen
    ? (box?.height > 0 ? box.height : (height ?? DEFAULT_HEIGHT))
    : (height ?? DEFAULT_HEIGHT);

  // Серии в координатах данных: от масштаба не зависят, считаются один раз.
  // Совместимый вход приводится к общему: экран может передать либо `series`,
  // либо прежнюю пару `measurements` + `extraSeries`
  const chartSeries = useMemo(() => {
    if (series) return buildSeries({ raw: series, mode });
    return buildSeries({
      raw: [
        {
          id: 'main',
          name: activeSeriesName,
          role: SERIES_ROLES.FIT,
          measurements,
        },
        ...extraSeries.map((one) => ({
          id: one.id,
          name: one.name,
          role: SERIES_ROLES.REFERENCE,
          measurements: one.measurements ?? [],
        })),
      ],
      mode,
    });
  }, [series, measurements, extraSeries, activeSeriesName, mode]);

  // Точки, по которым ведётся прямая и работает отметка. Соседние кривые сюда
  // не входят: прямая строится по открытой в журнале скважине
  const fitPoints = useMemo(
    () =>
      chartSeries
        .filter((one) => one.role === SERIES_ROLES.FIT)
        .flatMap((one) => one.points),
    [chartSeries]
  );

  // Сколько кривых попадёт в легенду: от этого зависит верхнее поле полотна
  // в развёрнутом виде. Легенда лежит поверх него и не должна накрывать данные
  const legend = chartSeries.length > 1 ? chartSeries : EMPTY;

  /**
   * Область построения внутри полотна
   *
   * В развёрнутом виде поля считаются по тому, что реально лежит поверх:
   * сверху подпись осей и легенда, снизу переключатели прямой и плавающее
   * меню приложения. Фиксированные поля «на глаз» оставляли то пустую полосу
   * сверху, то данные под меню.
   */
  const plot = useMemo(() => {
    if (!fullscreen) {
      return {
        x: PADDING.left,
        y: PADDING.top,
        w: Math.max(40, chartWidth - PADDING.left - PADDING.right),
        h: Math.max(40, chartHeight - PADDING.top - PADDING.bottom),
      };
    }

    // Резервируется только строка управления сверху и место под подписи оси
    // снизу. Меню приложения на развёрнутом графике скрыто, переключатели
    // способа прямой не показываются, легенда лежит поверх полотна — всё
    // остальное отдано координатной плоскости
    const top = insets.top + CONTROL_ROW_HEIGHT;
    const bottom = insets.bottom + AXIS_LABEL_ROOM;

    return {
      x: PADDING_FULL.left,
      y: top,
      w: Math.max(40, chartWidth - PADDING_FULL.left - PADDING_FULL.right),
      h: Math.max(40, chartHeight - top - bottom),
    };
  }, [chartWidth, chartHeight, fullscreen, insets.top, insets.bottom]);

  // Исходная видимая область с запасом по краям. Считается по всем кривым
  // сразу: кривая соседней скважины, не влезшая в масштаб основной,
  // обрезалась бы краем полотна
  const base = useMemo(() => fitViewport(chartSeries), [chartSeries]);

  /**
   * Прямая по замерам: через две отмеченные точки либо по всем сразу
   *
   * Считается и вне свободного режима: при переходе в него свободные точки
   * встают именно на эту прямую, чтобы переключение само по себе не меняло
   * результат.
   */
  const autoLine = useMemo(() => {
    if (selected.length === 2) {
      const first = fitPoints.find((p) => p.index === selected[0]);
      const second = fitPoints.find((p) => p.index === selected[1]);
      return lineThroughPoints(first, second);
    }
    return linearRegression(fitPoints.map((p) => ({ x: p.x, y: p.y })));
  }, [fitPoints, selected]);

  const freedom = fitMode === FIT_MODES.FREEDOM;
  const free = useMemo(() => freeLine(anchors), [anchors]);

  // Прямая на полотне. В свободном режиме — через поставленные точки; в
  // обычном через две отмеченные, а если отмечены не две — по всем замерам.
  // Одновременно двух прямых не бывает
  const fit = freedom ? free : autoLine;

  const { view, gesture, zoomBy, reset } = useChartViewport({
    base,
    plot,
    viewKey,
    viewportStore,
    scrollRef,
    freedom,
    fitPoints,
    anchors,
    onAnchorsChange,
    onSelectPoint: onToggleSelect,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  });

  const scene = useMemo(
    () =>
      buildScene({
        series: chartSeries,
        view,
        base,
        plot,
        mode,
        fit,
        anchors: freedom ? anchors : null,
      }),
    [chartSeries, view, base, plot, mode, fit, freedom, anchors]
  );

  // Наклон прямой нужен экрану для расчёта T
  const fitSlope = fit?.slope;
  const fitIntercept = fit?.intercept;
  useEffect(() => {
    onFitChange?.({
      slope: fitSlope,
      intercept: fitIntercept,
      source: fitMode,
      selectedCount: selected.length,
    });
  }, [fitSlope, fitIntercept, fitMode, selected.length, onFitChange]);

  /**
   * Ставит свободные точки на прямую по всем замерам
   *
   * Используется и при первом включении свободного режима, и кнопкой «Прямую
   * заново»: точки можно развести по углам полотна, и тогда прямая идёт не
   * там, где нужно.
   */
  const placeAnchors = useCallback(() => {
    onAnchorsChange?.(
      anchorsOnLine({
        slope: autoLine.slope,
        intercept: autoLine.intercept,
        x0: view.x0,
        x1: view.x1,
        y0: view.y0,
        y1: view.y1,
      })
    );
  }, [autoLine, view, onAnchorsChange]);

  // Свободный режим только что включён — ставим точки на ту прямую, что была
  // на графике. Зависимость от базовой области, а не от видимой: от видимой
  // эффект пересчитывался бы на каждом кадре жеста
  useEffect(() => {
    if (!freedom || anchors?.length === 2) return;
    onAnchorsChange?.(
      anchorsOnLine({
        slope: autoLine.slope,
        intercept: autoLine.intercept,
        x0: base.x0,
        x1: base.x1,
        y0: base.y0,
        y1: base.y1,
      })
    );
  }, [freedom, anchors, autoLine, base, onAnchorsChange]);

  // Одна точка отмечена — прямая через неё не проходит, и на графике всё ещё
  // прямая по всем замерам. Без подсказки это выглядит как несработавший тап
  const needsSelection = fitMode === FIT_MODES.AUTO && selected.length === 1;

  // Точки свободной прямой встали на одну вертикаль: наклона у такой прямой
  // нет. Раньше она просто пропадала с полотна, а T молча пересчитывалось
  // методом наименьших квадратов
  const degenerate = freedom && anchors?.length === 2 && !free.ready;

  /**
   * Эскиз будущего графика для пустого состояния
   *
   * Показываем не абстрактную заглушку, а то, что здесь появится: замеры
   * ложатся на прямую Купера — Джейкоба, а первые точки приподняты над ней
   * ёмкостью ствола скважины. Геометрия фиксированная — это иллюстрация,
   * а не расчёт.
   */
  const ghost = useMemo(() => {
    // Эскиз занимает верхнюю половину поля: нижнюю закрывает плашка с текстом.
    // Понижение растёт вверх, поэтому прямая идёт снизу вверх, а ранние точки
    // приподняты над ней — ёмкость ствола завышает понижение в начале
    const x0 = plot.x + plot.w * 0.1;
    const x1 = plot.x + plot.w * 0.95;
    const y0 = plot.y + plot.h * 0.5;
    const y1 = plot.y + plot.h * 0.12;

    // Доли вдоль прямой и отклонение точек от неё (ёмкость ствола в начале)
    const samples = [0, 0.18, 0.36, 0.54, 0.72, 1];
    const bulge = [-0.07, -0.035, -0.012, 0, 0.008, 0];

    const dots = samples.map((s, i) => ({
      x: x0 + (x1 - x0) * s,
      y: y0 + (y1 - y0) * s - plot.h * bulge[i],
    }));

    return {
      line: `M${x0},${y0} L${x1},${y1}`,
      curve: dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x},${d.y}`).join(' '),
      dots,
    };
  }, [plot]);

  const toolbar = (
    <ChartToolbar
      caption={
        caption ??
        (mode === X_MODES.LOG ? 's — lg t' : mode === X_MODES.SQRT ? 's — √t' : 's — t')
      }
      fitMode={fitMode}
      onFitModeChange={onFitModeChange}
      onZoomIn={() => zoomBy(1.6)}
      onZoomOut={() => zoomBy(1 / 1.6)}
      onReset={reset}
      onResetLine={placeAnchors}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
      floating={fullscreen}
      topInset={insets.top}
      colors={c}
    />
  );

  const canvas = (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          fullscreen ? styles.canvasFull : styles.canvas,
          { backgroundColor: c.plotBg, borderColor: c.border },
        ]}
        // collapsable нужен только нативной сборке: он не даёт RN схлопнуть
        // контейнер, к которому привязан обработчик жестов
        {...(Platform.OS === 'web' ? {} : { collapsable: false })}
      >
        <ChartCanvas
          scene={scene}
          plot={plot}
          width={chartWidth}
          height={chartHeight}
          colors={c}
          selected={selected}
          picking={!!onSelectSeries}
          ghost={scene.hasData ? null : ghost}
        />

        {!scene.hasData && (
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {emptyTitle ??
                  I18n.t('chartEmptyTitle', {
                    defaultValue: 'График строится по двум замерам',
                  })}
              </Text>
              <Text style={[type.caption, styles.emptyText, { color: c.textSecondary }]}>
                {emptyHint ??
                  I18n.t('chartEmptyHint', {
                    defaultValue:
                      'Внесите время и понижение в журнале выше — прямая и T появятся сразу.',
                  })}
              </Text>
            </View>
          </View>
        )}
      </View>
    </GestureDetector>
  );

  /**
   * Строка легенды
   *
   * Кривая подбора отмечена: по ней идёт прямая, и по её расстоянию считается
   * пьезопроводность. Пока выбор кривой не задан, отметка не ставится — на
   * одиночной откачке вторая кривая это фаза восстановления, и «выбранной»
   * там ничего не бывает.
   *
   * @param {Object} one - серия, см. calc/chartSeries.js
   * @returns {React.ReactNode} содержимое элемента легенды
   */
  const legendMark = (one) => (
    <>
      <View
        style={[
          styles.legendMark,
          { backgroundColor: one.color },
          one.role === SERIES_ROLES.REFERENCE && styles.legendMarkReference,
        ]}
      />
      <Text
        style={[
          styles.legendText,
          {
            color:
              onSelectSeries && one.role !== SERIES_ROLES.REFERENCE
                ? c.text
                : c.textSecondary,
          },
        ]}
        numberOfLines={1}
      >
        {one.name}
      </Text>
    </>
  );

  const legendRow = scene.hasData && legend.length > 0 && (
    <View style={[styles.legend, fullscreen && styles.legendFloating,
      fullscreen && { backgroundColor: c.surface, top: insets.top + CONTROL_ROW_HEIGHT }]}>
      {legend.map((one) => {
        const chosen = one.role !== SERIES_ROLES.REFERENCE;

        if (!onSelectSeries) {
          return (
            <View key={one.id} style={styles.legendItem}>
              {legendMark(one)}
            </View>
          );
        }

        // Выбор кривой — переключатель, а не кнопка: выбранной остаётся одна,
        // и экранный диктор должен называть её выбранной, а не нажатой
        return (
          <TouchableOpacity
            key={one.id}
            onPress={() => onSelectSeries(one.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: chosen }}
            style={[
              styles.legendItem,
              styles.legendPick,
              {
                backgroundColor: chosen ? c.primaryWash : 'transparent',
                borderColor: chosen ? c.wineBorder : c.border,
              },
            ]}
          >
            {legendMark(one)}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Развёрнутый вид: полотно занимает экран целиком, управление висит поверх.
  // Цель разворота — работать с координатной плоскостью, а не смотреть на
  // строку кнопок, которая отняла у неё высоту
  if (fullscreen) {
    return (
      <View
        style={[styles.fullscreenRoot, { backgroundColor: c.plotBg }]}
        onLayout={handleLayout}
      >
        {canvas}
        {legendRow}
        {toolbar}
      </View>
    );
  }

  return (
    <View>
      {toolbar}
      {canvas}
      {legendRow}

      {/* Что отложено по осям. Стрелки, а не подписи вдоль самих осей: места
          на узком полотне телефона нет, поворот текста в react-native-svg на
          вебе съезжает, а числа у делений без величины не читаются — по одному
          «25» не понять, метры это, минуты или мин/м² */}
      {scene.hasData && (
        <View style={styles.axisRow}>
          <Text style={[styles.axisText, { color: c.textSecondary }]} numberOfLines={1}>
            {`↑ ${yAxisTitle ?? `s, ${drawdownUnit}`}`}
          </Text>
          <Text style={[styles.axisText, { color: c.textSecondary }]} numberOfLines={1}>
            {`→ ${
              xAxisTitle ?? (mode === X_MODES.SQRT ? `√t, √${timeUnit}` : `t, ${timeUnit}`)
            }`}
          </Text>
        </View>
      )}

      {/* Подсказки под графиком, а не поверх: перекрывать данные,
          по которым надо попасть пальцем, — плохая идея */}
      {/* По какой кривой идёт прямая. У куста кривых несколько, и от выбора
          зависит не только наклон: в пьезопроводность входит расстояние r,
          своё у каждой скважины */}
      {scene.hasData && !!onSelectSeries && legend.length > 1 && (
        <Text style={[styles.pickHint, { color: c.textSecondary }]} numberOfLines={2}>
          {I18n.t('pickSeriesHint', {
            defaultValue: 'Коснитесь названия кривой в легенде — прямая перейдёт на неё',
          })}
        </Text>
      )}

      {scene.hasData && needsSelection && (
        <View style={[styles.hint, { backgroundColor: c.primaryWash, borderColor: c.wineBorder }]}>
          <Text style={[styles.hintText, { color: c.primaryAccent }]}>
            {I18n.t('selectSecondPoint', {
              defaultValue: 'Отметьте вторую точку — пока прямая идёт по всем замерам',
            })}
          </Text>
        </View>
      )}

      {degenerate && (
        <View style={[styles.hint, { backgroundColor: c.primaryWash, borderColor: c.wineBorder }]}>
          <Text style={[styles.hintText, { color: c.primaryAccent }]}>
            {I18n.t('freedomDegenerate', {
              defaultValue:
                'Точки встали на одну вертикаль — такая прямая наклона не имеет. Разведите их по времени.',
            })}
          </Text>
        </View>
      )}

      {scene.hasData && freedom && !degenerate && (
        <View style={[styles.hint, { backgroundColor: c.primaryWash, borderColor: c.wineBorder }]}>
          <Text style={[styles.hintText, { color: c.primaryAccent }]}>
            {I18n.t('freedomHint', {
              defaultValue:
                'Тяните точки или коснитесь полотна — прямая идёт через них. Полосы осей растягивают свою ось',
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  // Развёрнутое полотно без скруглений и рамки: оно и есть экран
  canvasFull: {
    ...StyleSheet.absoluteFillObject,
  },
  fullscreenRoot: {
    flex: 1,
  },
  legendFloating: {
    position: 'absolute',
    left: spacing.md,
    marginTop: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    opacity: 0.92,
    zIndex: 2,
  },
  // Кривая сравнения помечена пунктиром: цвета мало, когда рядом две кривые
  // и обе тонкие
  legendMarkReference: {
    height: 0,
    width: 12,
    borderRadius: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  // Легенда: переносится по строкам — скважин может быть много
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // Выбираемая кривая обведена рамкой: без неё подпись не читается как то,
  // по чему можно попасть пальцем
  legendPick: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendMark: {
    width: 10,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    ...type.numeric,
    fontSize: 11.5,
    fontWeight: '600',
    maxWidth: 120,
  },
  pickHint: {
    ...type.caption,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  axisText: {
    ...type.numeric,
    fontSize: 11,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    // Текст внизу, эскиз сверху — так они не перекрывают друг друга
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  // Плашка поверх эскиза: текст на пунктирной кривой читался бы плохо
  emptyCard: {
    maxWidth: 300,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
  },
  emptyTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  hint: {
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hintText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    textAlign: 'center',
  },
});
