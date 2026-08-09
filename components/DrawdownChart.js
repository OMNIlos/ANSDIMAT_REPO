/**
 * График понижения — основной инструмент графоаналитической обработки
 *
 * По вертикали понижение s (м), по горизонтали время в одном из режимов:
 * lg t, t или √t. Каждый режим спрямляет свой тип кривой, поэтому геолог
 * переключает оси, пока точки не лягут на прямую.
 *
 * Как устроен масштаб. Видимая область хранится в четырёх значениях
 * (границы по осям) на UI-потоке reanimated, поэтому щипок и перетаскивание
 * идут без участия JS-потока и не ждут ре-рендера React. В React состояние
 * переносится с ограничением частоты — этого хватает, чтобы подписи осей
 * поспевали за жестом, и при этом JS-поток не захлёбывается.
 *
 * Почему координаты пересчитываются, а не масштабируется группа SVG.
 * Трансформация растянула бы вместе с данными и толщину линий, и радиусы
 * точек, и подписи. Здесь при зуме меняется только положение элементов:
 * линии остаются той же толщины, точки того же размера, оси стоят на месте.
 *
 * Прямую можно строить двумя способами: автоматически по всем замерам
 * (наименьшие квадраты) или вручную по двум выбранным точкам — начало
 * откачки и выход на границу пласта в прямую не ложатся, и там ручной
 * выбор участка даёт более достоверный наклон.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Path, Line, Circle, G, Rect, Defs, ClipPath } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { transformTime, linearRegression, lineThroughPoints, X_MODES } from '../calc/cooperJacob';
import {
  valueToPixelX,
  valueToPixelY,
  zoomView,
  panView,
  findNearestPoint,
  toggleSelection,
} from '../calc/chartGeometry';
import { spacing, radius, type, fontFamily } from '../theme';

const DEFAULT_HEIGHT = 230;
const PADDING = { left: 46, right: 14, top: 14, bottom: 38 };

/** Пределы масштаба относительно исходного вида */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 50;

/** Не чаще чем раз в 16 мс переносим видимую область в React */
const SYNC_INTERVAL_MS = 16;

/** Радиус захвата точки пальцем, px */
const TAP_RADIUS = 26;

export const FIT_MODES = { AUTO: 'auto', TWO_POINTS: 'twoPoints' };

/**
 * Подбирает «красивый» шаг сетки: 1, 2, 5 или 10, умноженное на степень десяти
 *
 * @param {number} range - охватываемый диапазон значений
 * @returns {number} шаг деления
 */
export function niceStep(range) {
  if (!(range > 0)) return 1;
  const raw = range / 4.5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return step * magnitude;
}

/**
 * Форматирует число для подписи оси
 *
 * @param {number} value - значение
 * @returns {string} подпись
 */
function formatTick(value) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs < 0.001 || abs >= 100000) return value.toExponential(1);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

export default function DrawdownChart({
  measurements = [],
  mode = X_MODES.LOG,
  width = 340,
  onFitChange,
  // Прокручиваемый контейнер, внутри которого лежит график. Пока идёт жест
  // по графику, прокрутка блокируется штатным механизмом RNGH: раньше экран
  // выключал её через состояние, но перерисовка прямо во время распознавания
  // жеста рвала перетаскивание — палец «отпускало» на первом же кадре
  scrollRef,
  // Способ построения прямой и выбранные точки хранит экран: те же точки
  // можно отмечать и в таблице замеров, поэтому состояние должно быть общим
  fitMode = FIT_MODES.AUTO,
  onFitModeChange,
  selected = [],
  onToggleSelect,
  // Подпись осей. По умолчанию выводится из режима, но на восстановлении
  // по оси X отложено отношение t/t′, а не время — там подпись своя
  caption,
  // Развёрнут ли график на весь экран. В обычном виде он лежит внутри
  // прокручиваемого списка, и вертикальное перетаскивание достаётся списку —
  // развёрнутый график получает жесты целиком, как карта в дневнике
  fullscreen = false,
  onToggleFullscreen,
  // Высота графика: в развёрнутом виде её задаёт экран
  height,
}) {
  const theme = useTheme();
  const c = theme.colors;

  const chartHeight = height ?? DEFAULT_HEIGHT;

  const plot = useMemo(
    () => ({
      x: PADDING.left,
      y: PADDING.top,
      w: Math.max(40, width - PADDING.left - PADDING.right),
      h: chartHeight - PADDING.top - PADDING.bottom,
    }),
    [width, chartHeight]
  );

  // Точки в координатах данных: от масштаба не зависят, считаются один раз
  const dataPoints = useMemo(
    () =>
      measurements
        .map((m, index) => ({
          index,
          x: transformTime(m.t, mode),
          y: m.s,
          t: m.t,
        }))
        .filter((p) => p.x != null && isFinite(p.x) && isFinite(p.y)),
    [measurements, mode]
  );

  // Исходная видимая область с небольшим запасом по краям
  const baseView = useMemo(() => {
    if (dataPoints.length === 0) {
      return { x0: 0, x1: 1, y0: 0, y1: 1 };
    }

    const xs = dataPoints.map((p) => p.x);
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    if (x1 - x0 < 1e-9) {
      x0 -= 0.5;
      x1 += 0.5;
    }
    const padX = (x1 - x0) * 0.08;

    const maxY = Math.max(...dataPoints.map((p) => p.y));
    return {
      x0: x0 - padX,
      x1: x1 + padX,
      y0: 0,
      y1: maxY > 0 ? maxY * 1.12 : 1,
    };
  }, [dataPoints]);

  // Видимая область: на UI-потоке — для жестов, в state — для отрисовки
  const vx0 = useSharedValue(baseView.x0);
  const vx1 = useSharedValue(baseView.x1);
  const vy0 = useSharedValue(baseView.y0);
  const vy1 = useSharedValue(baseView.y1);
  // Накопленный масштаб прошлого кадра щипка
  const prevScale = useSharedValue(1);
  const [view, setView] = useState(baseView);

  const lastSyncRef = useRef(0);

  /**
   * Переносит видимую область в React не чаще заданного интервала:
   * жест идёт на UI-потоке, а перерисовка подписей — на JS
   */
  const syncView = useCallback((next) => {
    const now = Date.now();
    if (now - lastSyncRef.current < SYNC_INTERVAL_MS) return;
    lastSyncRef.current = now;
    setView(next);
  }, []);

  /** Гарантированный перенос последнего состояния после жеста */
  const commitView = useCallback((next) => {
    lastSyncRef.current = 0;
    setView(next);
  }, []);

  // Данные изменились — возвращаемся к исходному виду
  useEffect(() => {
    vx0.value = baseView.x0;
    vx1.value = baseView.x1;
    vy0.value = baseView.y0;
    vy1.value = baseView.y1;
    setView(baseView);
  }, [baseView, vx0, vx1, vy0, vy1]);

  useAnimatedReaction(
    () => ({ x0: vx0.value, x1: vx1.value, y0: vy0.value, y1: vy1.value }),
    (current, previous) => {
      if (
        previous &&
        current.x0 === previous.x0 &&
        current.x1 === previous.x1 &&
        current.y0 === previous.y0 &&
        current.y1 === previous.y1
      ) {
        return;
      }
      runOnJS(syncView)(current);
    }
  );

  const baseRangeX = baseView.x1 - baseView.x0;
  const baseRangeY = baseView.y1 - baseView.y0;
  const plotX = plot.x;
  const plotY = plot.y;
  const plotW = plot.w;
  const plotH = plot.h;

  // Жест перекрывает прокрутку списка, в котором лежит график. Модификатор
  // вешается на каждый жест по отдельности: у составного его нет
  const blockScroll = useCallback(
    (gesture) => (scrollRef ? gesture.blocksExternalGesture(scrollRef) : gesture),
    [scrollRef]
  );

  const pinch = useMemo(
    () =>
      blockScroll(
        Gesture.Pinch()
          .onStart(() => {
            'worklet';
            prevScale.value = 1;
          })
          .onUpdate((event) => {
            'worklet';
            // event.scale накоплен с начала жеста, поэтому берём приращение
            // относительно прошлого кадра — иначе масштаб растёт лавинообразно
            const delta = event.scale / prevScale.value;
            prevScale.value = event.scale;
            if (!isFinite(delta) || delta <= 0) return;

            const next = zoomView({
              view: {
                x0: vx0.value,
                x1: vx1.value,
                y0: vy0.value,
                y1: vy1.value,
              },
              scale: delta,
              // Точка между пальцами остаётся на месте: зум идёт туда, куда смотрят
              focusX: Math.min(1, Math.max(0, (event.focalX - plotX) / plotW)),
              focusY: Math.min(1, Math.max(0, (event.focalY - plotY) / plotH)),
              baseRange: { x: baseRangeX, y: baseRangeY },
              minZoom: MIN_ZOOM,
              maxZoom: MAX_ZOOM,
            });

            vx0.value = next.x0;
            vx1.value = next.x1;
            vy0.value = next.y0;
            vy1.value = next.y1;
          })
          .onEnd(() => {
            'worklet';
            runOnJS(commitView)({
              x0: vx0.value,
              x1: vx1.value,
              y0: vy0.value,
              y1: vy1.value,
            });
          })
      ),
    [
      plotX,
      plotY,
      plotW,
      plotH,
      baseRangeX,
      baseRangeY,
      vx0,
      vx1,
      vy0,
      vy1,
      prevScale,
      commitView,
      blockScroll,
    ]
  );

  const pan = useMemo(
    () =>
      blockScroll(
        Gesture.Pan()
          .minPointers(1)
          .maxPointers(1)
          // Порог активации: без него перетаскивание перехватывает любое касание
          // и одиночный тап по точке никогда не срабатывает
          .activeOffsetX([-8, 8])
          .activeOffsetY([-8, 8])
          .onUpdate((event) => {
            'worklet';
            const next = panView({
              view: {
                x0: vx0.value,
                x1: vx1.value,
                y0: vy0.value,
                y1: vy1.value,
              },
              dx: event.changeX,
              dy: event.changeY,
              plot: { w: plotW, h: plotH },
            });

            vx0.value = next.x0;
            vx1.value = next.x1;
            vy0.value = next.y0;
            vy1.value = next.y1;
          })
          .onEnd(() => {
            'worklet';
            runOnJS(commitView)({
              x0: vx0.value,
              x1: vx1.value,
              y0: vy0.value,
              y1: vy1.value,
            });
          })
      ),
    [plotW, plotH, vx0, vx1, vy0, vy1, commitView, blockScroll]
  );

  /**
   * Переключает выбор точки для построения прямой вручную
   *
   * @param {number} index - индекс замера
   */
  const togglePoint = useCallback(
    (index) => {
      if (fitMode !== FIT_MODES.TWO_POINTS) return;
      onToggleSelect?.(index);
    },
    [fitMode, onToggleSelect]
  );

  /**
   * Выбирает замер под пальцем
   *
   * Обычные кнопки поверх графика здесь не работают: GestureDetector
   * забирает касания у всего своего поддерева. Поэтому попадание считается
   * вручную по координатам касания.
   */
  // Актуальные данные держим в ссылке, а не в замыкании обработчика.
  // Иначе selectNearest пересоздаётся при каждом сдвиге области просмотра,
  // вместе с ним пересобирается жест тапа — и касания перестают доходить:
  // обработчик подменяется прямо во время распознавания жеста
  const tapStateRef = useRef({ fitMode, dataPoints, view, plot });
  tapStateRef.current = { fitMode, dataPoints, view, plot };

  const togglePointRef = useRef(togglePoint);
  togglePointRef.current = togglePoint;

  const selectNearest = useCallback((touchX, touchY) => {
    const state = tapStateRef.current;
    if (state.fitMode !== FIT_MODES.TWO_POINTS || state.dataPoints.length === 0) return;

    const nearest = findNearestPoint({
      points: state.dataPoints,
      touchX,
      touchY,
      view: state.view,
      plot: state.plot,
      radius: TAP_RADIUS,
    });
    if (nearest) togglePointRef.current(nearest.index);
  }, []);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(400)
        // Сместился палец — это перетаскивание, а не выбор точки
        .maxDistance(14)
        .onEnd((event, success) => {
          'worklet';
          if (success) runOnJS(selectNearest)(event.x, event.y);
        }),
    [selectNearest]
  );

  // Перетаскивание включается только после смещения на 8 px, поэтому
  // короткое касание без движения достаётся тапу
  const gesture = useMemo(() => Gesture.Simultaneous(pinch, pan, tap), [pinch, pan, tap]);

  const reset = () => {
    vx0.value = baseView.x0;
    vx1.value = baseView.x1;
    vy0.value = baseView.y0;
    vy1.value = baseView.y1;
    commitView(baseView);
  };

  /**
   * Меняет масштаб кнопкой — от центра области
   *
   * Кнопки оставлены рядом с жестами намеренно: щипок двумя пальцами неудобен
   * в перчатках, а зимой в поле работают именно в них.
   *
   * @param {number} scale - во сколько раз приблизить (>1) или отдалить (<1)
   */
  const zoomBy = (scale) => {
    const next = zoomView({
      view: { x0: vx0.value, x1: vx1.value, y0: vy0.value, y1: vy1.value },
      scale,
      focusX: 0.5,
      focusY: 0.5,
      baseRange: { x: baseRangeX, y: baseRangeY },
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    vx0.value = next.x0;
    vx1.value = next.x1;
    vy0.value = next.y0;
    vy1.value = next.y1;
    commitView(next);
  };

  // Всё, что зависит от видимой области: положения точек, сетка, подписи
  const scene = useMemo(() => {
    // Замеров нет — рисовать нечего, показывается подсказка
    if (dataPoints.length === 0) {
      return { hasData: false, dots: [], xTicks: [], yTicks: [] };
    }

    // Область просмотра могла выродиться посреди жеста: щипок двумя пальцами
    // на мгновение даёт нулевой или отрицательный размах. Раньше это роняло
    // график в пустое состояние с надписью «внесите замеры» — прямо во время
    // масштабирования. Замеры при этом никуда не девались, поэтому берём
    // исходный вид вместо испорченного
    const safeView =
      view.x1 - view.x0 > 0 && view.y1 - view.y0 > 0 && isFinite(view.x0) && isFinite(view.y0)
        ? view
        : baseView;

    const rangeX = safeView.x1 - safeView.x0;
    const rangeY = safeView.y1 - safeView.y0;

    const toX = (value) => valueToPixelX(value, safeView, plot);
    const toY = (value) => valueToPixelY(value, safeView, plot);

    const dots = dataPoints.map((point) => ({
      index: point.index,
      cx: toX(point.x),
      cy: toY(point.y),
    }));

    const polyline =
      dots.length > 1
        ? 'M' + dots.map((d) => `${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(' L')
        : '';

    // Прямая: по всем точкам или по двум выбранным
    let fit = { slope: NaN, intercept: NaN };
    let fitSource = fitMode;

    if (fitMode === FIT_MODES.TWO_POINTS && selected.length === 2) {
      const first = dataPoints.find((p) => p.index === selected[0]);
      const second = dataPoints.find((p) => p.index === selected[1]);
      fit = lineThroughPoints(first, second);
    } else if (fitMode === FIT_MODES.AUTO) {
      fit = linearRegression(dataPoints.map((p) => ({ x: p.x, y: p.y })));
    }

    let fitPath = '';
    if (isFinite(fit.slope) && isFinite(fit.intercept)) {
      const yAtLeft = fit.slope * safeView.x0 + fit.intercept;
      const yAtRight = fit.slope * safeView.x1 + fit.intercept;
      fitPath = `M${toX(safeView.x0).toFixed(1)},${toY(yAtLeft).toFixed(1)} L${toX(
        safeView.x1
      ).toFixed(1)},${toY(yAtRight).toFixed(1)}`;
    }

    // Деления: шаг «красивый», подписи не наезжают друг на друга
    const stepX = niceStep(rangeX);
    const xTicks = [];
    for (let v = Math.ceil(safeView.x0 / stepX) * stepX; v <= safeView.x1 + 1e-9; v += stepX) {
      const px = toX(v);
      if (px < plotX - 0.5 || px > plotX + plotW + 0.5) continue;
      xTicks.push({
        x: px,
        label: mode === X_MODES.LOG ? formatTick(Math.pow(10, v)) : formatTick(v),
      });
      if (xTicks.length > 8) break;
    }

    const stepY = niceStep(rangeY);
    const yTicks = [];
    for (let v = Math.ceil(safeView.y0 / stepY) * stepY; v <= safeView.y1 + 1e-9; v += stepY) {
      const py = toY(v);
      if (py < plotY - 0.5 || py > plotY + plotH + 0.5) continue;
      yTicks.push({ y: py, label: formatTick(v) });
      if (yTicks.length > 8) break;
    }

    return {
      hasData: true,
      dots,
      polyline,
      fitPath,
      fit,
      fitSource,
      xTicks,
      yTicks,
      stepXLabel:
        mode === X_MODES.LOG
          ? `Δlg = ${formatTick(stepX)}`
          : `${formatTick(stepX)} ${mode === X_MODES.SQRT ? '√мин' : 'мин'}`,
      stepYLabel: `${formatTick(stepY)} м`,
    };
  }, [view, baseView, dataPoints, plot, plotX, plotY, plotW, plotH, mode, fitMode, selected]);

  // Наклон прямой нужен экрану для расчёта T
  const fitSlope = scene.fit?.slope;
  const fitIntercept = scene.fit?.intercept;
  useEffect(() => {
    onFitChange?.({
      slope: fitSlope,
      intercept: fitIntercept,
      source: fitMode,
      selectedCount: selected.length,
    });
  }, [fitSlope, fitIntercept, fitMode, selected.length, onFitChange]);

  const needsSelection = fitMode === FIT_MODES.TWO_POINTS && selected.length < 2;

  /**
   * Эскиз будущего графика для пустого состояния
   *
   * Показываем не абстрактную заглушку, а то, что здесь появится: замеры
   * ложатся на прямую Купера — Джейкоба, а первые точки приподняты над ней
   * ёмкостью ствола скважины. Геометрия фиксированная — это иллюстрация,
   * а не расчёт.
   */
  const ghost = useMemo(() => {
    // Эскиз занимает верхнюю половину поля: нижнюю закрывает плашка с текстом
    const x0 = plotX + plotW * 0.1;
    const x1 = plotX + plotW * 0.95;
    const y0 = plotY + plotH * 0.12;
    const y1 = plotY + plotH * 0.5;

    // Доли вдоль прямой и отклонение точек от неё (ёмкость ствола в начале)
    const samples = [0, 0.18, 0.36, 0.54, 0.72, 1];
    const bulge = [-0.07, -0.035, -0.012, 0, 0.008, 0];

    const dots = samples.map((s, i) => ({
      x: x0 + (x1 - x0) * s,
      y: y0 + (y1 - y0) * s + plotH * bulge[i],
    }));

    return {
      line: `M${x0},${y0} L${x1},${y1}`,
      curve: dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x},${d.y}`).join(' '),
      dots,
    };
  }, [plotX, plotY, plotW, plotH]);

  return (
    <View>
      <View style={styles.header}>
        <Text style={[type.eyebrow, { color: c.textSecondary }]}>
          {caption ??
            (mode === X_MODES.LOG ? 's — lg t' : mode === X_MODES.SQRT ? 's — √t' : 's — t')}
        </Text>
        {/* Управление масштабом бессмысленно, пока масштабировать нечего */}
        {scene.hasData && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => zoomBy(1 / 1.6)}
              style={[styles.zoomButton, { borderColor: c.border, backgroundColor: c.surface }]}
              accessibilityRole="button"
              accessibilityLabel={I18n.t('zoomOut', {
                defaultValue: 'Отдалить',
              })}
              hitSlop={6}
            >
              <MaterialIcons name="remove" size={16} color={c.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => zoomBy(1.6)}
              style={[styles.zoomButton, { borderColor: c.border, backgroundColor: c.surface }]}
              accessibilityRole="button"
              accessibilityLabel={I18n.t('zoomIn', {
                defaultValue: 'Приблизить',
              })}
              hitSlop={6}
            >
              <MaterialIcons name="add" size={16} color={c.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={reset} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.resetLink, { color: c.primaryAccent }]}>
                {I18n.t('reset', { defaultValue: 'Сброс' })}
              </Text>
            </TouchableOpacity>
            {/* Разворот на весь экран. Внутри списка вертикальное перетаскивание
              достаётся прокрутке, и график под пальцем стоит на месте.
              Развёрнутый лежит вне прокрутки и получает жесты целиком */}
            {onToggleFullscreen && (
              <TouchableOpacity
                onPress={onToggleFullscreen}
                style={[styles.zoomButton, { borderColor: c.border, backgroundColor: c.surface }]}
                accessibilityRole="button"
                accessibilityState={{ expanded: fullscreen }}
                accessibilityLabel={
                  fullscreen
                    ? I18n.t('chartCollapse', {
                        defaultValue: 'Свернуть график',
                      })
                    : I18n.t('chartExpand', {
                        defaultValue: 'Развернуть график на весь экран',
                      })
                }
                hitSlop={6}
              >
                <MaterialIcons
                  name={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
                  size={16}
                  color={c.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Способ построения прямой. Без замеров выбирать не из чего */}
      {scene.hasData && (
        <View style={[styles.fitRow, { backgroundColor: c.surfaceSunken }]}>
          {[
            {
              key: FIT_MODES.AUTO,
              label: I18n.t('fitAuto', { defaultValue: 'По всем точкам' }),
            },
            {
              key: FIT_MODES.TWO_POINTS,
              label: I18n.t('fitTwoPoints', { defaultValue: 'По двум точкам' }),
            },
          ].map((option) => {
            const active = option.key === fitMode;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => onFitModeChange?.(option.key)}
                style={[styles.fitChip, active && { backgroundColor: c.surface }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.fitChipText,
                    {
                      color: active ? c.primaryAccent : c.textSecondary,
                      fontWeight: active ? '700' : '600',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <GestureDetector gesture={gesture}>
        <View
          style={[styles.canvas, { backgroundColor: c.plotBg, borderColor: c.border }]}
          // collapsable нужен только нативной сборке: он не даёт RN схлопнуть
          // контейнер, к которому привязан обработчик жестов
          {...(Platform.OS === 'web' ? {} : { collapsable: false })}
        >
          <Svg width={width} height={chartHeight}>
            <Defs>
              {/* Данные не вылезают за область графика и не наезжают на оси */}
              <ClipPath id="plotClip">
                <Rect x={plotX} y={plotY} width={plotW} height={plotH} />
              </ClipPath>
            </Defs>

            {/* Пустой график: вместо голых осей — эскиз того, что здесь
                появится. Ломаная в начале задрана ёмкостью ствола, дальше
                выходит на прямую Купера — Джейкоба */}
            {!scene.hasData && (
              <G opacity={0.28}>
                <Path
                  d={ghost.curve}
                  stroke={c.secondary}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d={ghost.line}
                  stroke={c.primaryAccent}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  fill="none"
                />
                {ghost.dots.map((dot, i) => (
                  <Circle
                    key={`g${i}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={3.6}
                    fill={c.plotBg}
                    stroke={c.secondary}
                    strokeWidth={2}
                  />
                ))}
              </G>
            )}

            <G clipPath="url(#plotClip)">
              {scene.xTicks.map((tick, i) => (
                <Line
                  key={`gx${i}`}
                  x1={tick.x}
                  y1={plotY}
                  x2={tick.x}
                  y2={plotY + plotH}
                  stroke={c.border}
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                />
              ))}
              {scene.yTicks.map((tick, i) => (
                <Line
                  key={`gy${i}`}
                  x1={plotX}
                  y1={tick.y}
                  x2={plotX + plotW}
                  y2={tick.y}
                  stroke={c.border}
                  strokeWidth={0.5}
                />
              ))}

              {scene.fitPath ? (
                <Path
                  d={scene.fitPath}
                  stroke={c.primaryAccent}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  fill="none"
                />
              ) : null}

              {scene.polyline ? (
                <Path
                  d={scene.polyline}
                  stroke={c.secondary}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
              ) : null}

              {scene.dots.map((dot) => {
                const isSelected = selected.includes(dot.index);
                return (
                  <Circle
                    key={`p${dot.index}`}
                    cx={dot.cx}
                    cy={dot.cy}
                    r={isSelected ? 5.5 : 3.6}
                    fill={isSelected ? c.primaryAccent : c.surface}
                    stroke={isSelected ? c.primaryAccent : c.secondary}
                    strokeWidth={2}
                  />
                );
              })}
            </G>

            {/* Оси рисуются поверх клипа: они не двигаются и не масштабируются */}
            <Line
              x1={plotX}
              y1={plotY}
              x2={plotX}
              y2={plotY + plotH}
              stroke={c.textSecondary}
              strokeWidth={1}
            />
            <Line
              x1={plotX}
              y1={plotY}
              x2={plotX + plotW}
              y2={plotY}
              stroke={c.textSecondary}
              strokeWidth={1}
            />
          </Svg>

          {/* Подписи делений — обычным текстом, чтобы работали табличные цифры */}
          {scene.hasData && (
            <>
              {scene.xTicks.map((tick, i) => (
                <Text
                  key={`xl${i}`}
                  style={[
                    styles.tickLabel,
                    styles.tickLabelX,
                    { left: tick.x - 26, color: c.faint },
                  ]}
                  numberOfLines={1}
                >
                  {tick.label}
                </Text>
              ))}
              {scene.yTicks.map((tick, i) => (
                <Text
                  key={`yl${i}`}
                  style={[styles.tickLabel, styles.tickLabelY, { top: tick.y - 7, color: c.faint }]}
                  numberOfLines={1}
                >
                  {tick.label}
                </Text>
              ))}
            </>
          )}

          {!scene.hasData && (
            <View style={styles.overlay} pointerEvents="none">
              <View
                style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <Text style={[styles.emptyTitle, { color: c.text }]}>
                  {I18n.t('chartEmptyTitle', {
                    defaultValue: 'График строится по двум замерам',
                  })}
                </Text>
                <Text style={[type.caption, styles.emptyText, { color: c.textSecondary }]}>
                  {I18n.t('chartEmptyHint', {
                    defaultValue:
                      'Внесите время и понижение в журнале выше — прямая и T появятся сразу.',
                  })}
                </Text>
              </View>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Подсказка под графиком, а не поверх: перекрывать данные,
          по которым надо попасть пальцем, — плохая идея */}
      {scene.hasData && needsSelection && (
        <View style={[styles.hint, { backgroundColor: c.primaryWash, borderColor: c.wineBorder }]}>
          <Text style={[styles.hintText, { color: c.primaryAccent }]}>
            {I18n.t('selectTwoPoints', {
              defaultValue: 'Коснитесь двух точек, через которые провести прямую',
            })}
          </Text>
        </View>
      )}

      {scene.hasData && (
        <View style={styles.stepRow}>
          <Text style={[styles.stepText, { color: c.textSecondary }]}>
            {I18n.t('stepX', { defaultValue: 'Цена деления X' })}: {scene.stepXLabel}
          </Text>
          <Text style={[styles.stepText, { color: c.textSecondary }]}>Y: {scene.stepYLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomButton: {
    width: 30,
    height: 26,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLink: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  fitRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  fitChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 9,
  },
  fitChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12.5,
  },
  canvas: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tickLabel: {
    position: 'absolute',
    ...type.numeric,
    fontSize: 10,
    lineHeight: 14,
  },
  tickLabelX: {
    bottom: 10,
    width: 52,
    textAlign: 'center',
  },
  tickLabelY: {
    left: 2,
    width: 40,
    textAlign: 'right',
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
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  stepText: {
    ...type.numeric,
    fontSize: 11,
  },
});
