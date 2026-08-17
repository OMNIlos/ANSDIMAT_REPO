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
 * Прямую строят в двух режимах, см. FIT_MODES. В обычном она идёт по всем
 * замерам, а отметив две точки, геолог заменяет её прямой через них: начало
 * откачки и выход на границу пласта в прямую не ложатся, и там ручной выбор
 * участка даёт более достоверный наклон. В свободном прямую держат две точки,
 * поставленные где угодно на плоскости и перетаскиваемые пальцем.
 *
 * Масштаб меняется тремя способами: кнопками — равномерно, щипком — по каждой
 * оси в меру разброса пальцев вдоль неё, и перетаскиванием полосы оси — только
 * по этой оси. Последние два взяты у Desmos: чтобы вытянуть поздний участок
 * записи по времени, не теряя размаха по понижению.
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
  pixelToValue,
  anchorsOnLine,
  zoomView,
  panView,
  findNearestPoint,
  toggleSelection,
  groupPoints,
  logTicks,
  pickDragTarget,
  DRAG_TARGETS,
  shouldRefitView,
} from '../calc/chartGeometry';
import { niceStep, formatTick, formatLogTick } from '../calc/chartScene';
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

import { FIT_MODES } from './chart/fitModes';

export { FIT_MODES };

/** Радиус захвата свободной точки пальцем, px */
const ANCHOR_RADIUS = 30;

/**
 * Наименьший разброс пальцев, при котором ось ещё масштабируется, px
 *
 * Пальцы почти на одной линии — разброс вдоль неё случайный, и масштаб по этой
 * оси прыгал бы от дрожания руки.
 */
const MIN_PINCH_SPAN = 40;

/**
 * Цвета кривых соседних скважин
 *
 * Фиксированный набор, а не цвета темы: кривых на плоскости столько, сколько
 * в кусте наблюдательных скважин, и различать их надо между собой. Оттенки
 * подобраны так, чтобы читались и на светлом, и на тёмном фоне.
 */
const SERIES_COLORS = ['#2E86AB', '#E07A5F', '#3D9970', '#B5179E', '#F4A261', '#5C6BC0'];

export default function DrawdownChart({
  /**
   * Замеры ряда: [{ t, s }]
   *
   * У точки могут стоять `group` и `groupName` — тогда серия красится по
   * группе и попадает в легенду, а ломаная ведётся внутри каждой группы
   * отдельно. Так устроено комбинированное прослеживание: на плоскости лежат
   * замеры всех скважин куста, и прямая ведётся по ним по всем сразу, а цвет
   * показывает, чья точка. Подбор прямой и отметка точек от группировки не
   * зависят: они идут по всему ряду.
   */
  measurements = [],
  /**
   * Кривые остальных скважин куста: [{ id, name, measurements }]
   *
   * Прямая ведётся по одной скважине — той, что открыта в журнале, — поэтому
   * подбор и отметки точек остаются за `measurements`. Соседние кривые нужны
   * для сравнения: по кусту сразу видно, какая скважина выбивается из общей
   * картины. В масштаб они входят наравне с основной, иначе часть графика
   * уезжала бы за край.
   */
  extraSeries = [],
  // Название открытой скважины: нужно только легенде, и только когда кривых
  // больше одной
  activeSeriesName,
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
  /**
   * Свободные точки: [{ x, y }] в координатах графика
   *
   * Живут в состоянии экрана, а не графика: через них считается прямая, а
   * через прямую — водопроводимость. Пусто — значит режим только что включён,
   * и точки надо поставить на текущую прямую; график сам сообщит куда
   */
  anchors,
  onAnchorsChange,
  /**
   * Чем задана нынешняя система координат
   *
   * Меняется при смене вида графика, фазы опыта, момента площадного среза и
   * выбранных размерностей — то есть тогда, когда прежнее окно показывало бы
   * не то. От правки замеров не меняется: масштаб геолог ставит руками, и
   * терять его посреди работы с журналом нельзя. Собирает ключ экран: график
   * не знает ни про фазы, ни про виды прослеживания
   */
  viewKey = '',
  // Подпись осей. По умолчанию выводится из режима, но на восстановлении
  // по оси X отложено отношение t/t′, а не время — там подпись своя
  caption,
  /**
   * Подпись величины у оси абсцисс: «t, мин», «r, м», «t/r², мин/м²»
   *
   * Заголовок над полотном называет график целиком (`s — lg r`), а это —
   * что именно отложено по оси. Без неё на площадном и комбинированном
   * графике числа на оси не с чем связать.
   */
  xAxisTitle,
  /**
   * Почему на полотне пусто
   *
   * Причин у пустого графика несколько, и общая подсказка «внесите замеры»
   * врёт, когда замеры внесены, а не хватает расстояний или общего момента.
   * Экран знает настоящую причину и передаёт её сюда.
   */
  emptyTitle,
  emptyHint,
  // Размерности осей для подписей. Приходят снаружи: экран знает выбор
  // пользователя, график получает уже пересчитанные точки. Значения по
  // умолчанию — базовые единицы приложения
  timeUnit = 'мин',
  drawdownUnit = 'м',
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
          group: m.group,
          groupName: m.groupName,
        }))
        .filter((p) => p.x != null && isFinite(p.x) && isFinite(p.y)),
    [measurements, mode]
  );

  // Разбивка ряда по скважинам. Пустая, пока признак группы не задан, —
  // тогда ряд рисуется одним цветом, как раньше
  const groups = useMemo(() => groupPoints(dataPoints, SERIES_COLORS), [dataPoints]);

  /**
   * Прямая по замерам: через две отмеченные точки либо по всем сразу
   *
   * Считается и вне свободного режима: при переходе в него свободные точки
   * встают именно на эту прямую, чтобы переключение само по себе не меняло
   * результат.
   */
  const autoLine = useMemo(() => {
    if (selected.length === 2) {
      const first = dataPoints.find((p) => p.index === selected[0]);
      const second = dataPoints.find((p) => p.index === selected[1]);
      return lineThroughPoints(first, second);
    }
    return linearRegression(dataPoints.map((p) => ({ x: p.x, y: p.y })));
  }, [dataPoints, selected]);

  // Цвет каждой точки — рядом с dataPoints, а не по индексу замера:
  // из ряда выброшены точки с непригодным временем, и нумерация разошлась
  const pointColors = useMemo(() => {
    const colors = new Array(dataPoints.length).fill(null);
    groups.forEach((series) => {
      series.indices.forEach((i) => {
        colors[i] = series.color;
      });
    });
    return colors;
  }, [groups, dataPoints.length]);

  // То же самое для соседних скважин, но без индексов: отмечать точки на них
  // нельзя — прямая строится по одной скважине
  const extraPoints = useMemo(
    () =>
      extraSeries.map((series, seriesIndex) => ({
        id: series.id,
        name: series.name,
        color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length],
        points: (series.measurements ?? [])
          .map((m) => ({ x: transformTime(m.t, mode), y: m.s }))
          .filter((p) => p.x != null && isFinite(p.x) && isFinite(p.y)),
      })),
    [extraSeries, mode]
  );

  // Исходная видимая область с небольшим запасом по краям.
  // Считается по всем кривым сразу: кривая соседней скважины, не влезшая
  // в масштаб основной, обрезалась бы краем полотна
  const baseView = useMemo(() => {
    const all = [...dataPoints, ...extraPoints.flatMap((series) => series.points)];
    if (all.length === 0) {
      return { x0: 0, x1: 1, y0: 0, y1: 1 };
    }

    const xs = all.map((p) => p.x);
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    if (x1 - x0 < 1e-9) {
      x0 -= 0.5;
      x1 += 0.5;
    }
    const padX = (x1 - x0) * 0.08;

    const maxY = Math.max(...all.map((p) => p.y));
    return {
      x0: x0 - padX,
      x1: x1 + padX,
      y0: 0,
      y1: maxY > 0 ? maxY * 1.12 : 1,
    };
  }, [dataPoints, extraPoints]);

  // Видимая область: на UI-потоке — для жестов, в state — для отрисовки
  const vx0 = useSharedValue(baseView.x0);
  const vx1 = useSharedValue(baseView.x1);
  const vy0 = useSharedValue(baseView.y0);
  const vy1 = useSharedValue(baseView.y1);
  // Накопленный масштаб прошлого кадра щипка
  const prevScale = useSharedValue(1);
  // Разброс пальцев по осям на прошлом кадре: по нему считается масштаб
  // каждой оси в отдельности
  const spanX = useSharedValue(0);
  const spanY = useSharedValue(0);
  const [view, setView] = useState(baseView);

  const lastSyncRef = useRef(0);

  const freedom = fitMode === FIT_MODES.FREEDOM;

  // Положение свободных точек в пикселях — для жеста на UI-потоке. Массив
  // объектов в shared value держать неудобно, поэтому по значению на координату
  const a0x = useSharedValue(0);
  const a0y = useSharedValue(0);
  const a1x = useSharedValue(0);
  const a1y = useSharedValue(0);
  // Что тащит текущий жест: индекс свободной точки, полоса оси или область.
  // Значения — DRAG_*, AXIS_*
  const dragAnchor = useSharedValue(DRAG_TARGETS.UNDECIDED);
  // Смещение точки от пальца в момент захвата: без него точка прыгала бы
  // центром под палец
  const grabDX = useSharedValue(0);
  const grabDY = useSharedValue(0);

  // Область и полотно нужны переводу пикселей в значения на JS-потоке. Ссылка,
  // а не замыкание: обработчик не должен пересобираться на каждый кадр жеста
  const anchorStateRef = useRef({ view, plot, anchors });
  anchorStateRef.current = { view, plot, anchors };

  /**
   * Переносит свободную точку туда, куда её утащил палец
   *
   * @param {number} index - какая из двух точек
   * @param {number} px - новое положение, px
   * @param {number} py - новое положение, px
   */
  const moveAnchor = useCallback(
    (index, px, py) => {
      const state = anchorStateRef.current;
      if (state.anchors?.length !== 2) return;
      const next = state.anchors.slice();
      next[index] = pixelToValue({ px, py, view: state.view, plot: state.plot });
      onAnchorsChange?.(next);
    },
    [onAnchorsChange]
  );

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

  // Под какой ключ область уже подогнана, см. shouldRefitView
  const appliedKeyRef = useRef(null);

  // Сменилась система координат — подгоняем область под данные. Правка замера
  // её не трогает: масштаб поставлен руками, и терять его посреди работы с
  // журналом нельзя
  useEffect(() => {
    if (
      !shouldRefitView({
        key: viewKey,
        appliedKey: appliedKeyRef.current,
        hasData: dataPoints.length > 0,
      })
    ) {
      return;
    }
    appliedKeyRef.current = viewKey;
    vx0.value = baseView.x0;
    vx1.value = baseView.x1;
    vy0.value = baseView.y0;
    vy1.value = baseView.y1;
    setView(baseView);
  }, [viewKey, dataPoints.length, baseView, vx0, vx1, vy0, vy1]);

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
            spanX.value = 0;
            spanY.value = 0;
          })
          // Оси растягиваются по отдельности, как в Desmos, поэтому щипок
          // разбирается по касаниям, а не по общему event.scale: горизонтальный
          // щипок тянет время, вертикальный — понижение, косой берёт обе оси и
          // даёт привычное равномерное масштабирование
          .onTouchesMove((event) => {
            'worklet';
            if (event.allTouches.length < 2) return;
            const [first, second] = event.allTouches;
            const nextSpanX = Math.abs(second.x - first.x);
            const nextSpanY = Math.abs(second.y - first.y);

            const hadX = spanX.value > MIN_PINCH_SPAN;
            const hadY = spanY.value > MIN_PINCH_SPAN;
            // Пальцы почти на одной линии — разброс вдоль неё случайный, и
            // масштаб по этой оси прыгал бы от дрожания руки
            const scaleX = hadX && nextSpanX > MIN_PINCH_SPAN ? nextSpanX / spanX.value : 1;
            const scaleY = hadY && nextSpanY > MIN_PINCH_SPAN ? nextSpanY / spanY.value : 1;

            spanX.value = nextSpanX;
            spanY.value = nextSpanY;
            if (scaleX === 1 && scaleY === 1) return;

            const focalX = (first.x + second.x) / 2;
            const focalY = (first.y + second.y) / 2;

            const next = zoomView({
              view: {
                x0: vx0.value,
                x1: vx1.value,
                y0: vy0.value,
                y1: vy1.value,
              },
              scaleX,
              scaleY,
              // Точка между пальцами остаётся на месте: зум идёт туда, куда смотрят
              focusX: Math.min(1, Math.max(0, (focalX - plotX) / plotW)),
              focusY: Math.min(1, Math.max(0, (focalY - plotY) / plotH)),
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
      spanX,
      spanY,
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
          .onBegin(() => {
            'worklet';
            dragAnchor.value = DRAG_TARGETS.UNDECIDED;
          })
          .onUpdate((event) => {
            'worklet';
            // Что именно тащим, решается на первом же кадре движения, а не при
            // касании: жест начинается раньше активации, и между этими моментами
            // касание может уйти соседнему обработчику. Точка начала
            // восстанавливается из смещения — она надёжнее, чем состояние,
            // выставленное в другом обработчике
            if (dragAnchor.value === DRAG_TARGETS.UNDECIDED) {
              const picked = pickDragTarget({
                startX: event.x - event.translationX,
                startY: event.y - event.translationY,
                ax0: a0x.value,
                ay0: a0y.value,
                ax1: a1x.value,
                ay1: a1y.value,
                freedom,
                plot: { x: plotX, y: plotY, h: plotH },
                radius: ANCHOR_RADIUS,
              });
              dragAnchor.value = picked.target;
              grabDX.value = picked.grabDX;
              grabDY.value = picked.grabDY;
            }

            if (dragAnchor.value === 0 || dragAnchor.value === 1) {
              // Положение берётся от пальца целиком, а не копится приращениями:
              // React возвращает точку с задержкой в кадр, и накопленное
              // смещение такой возврат откатывал бы. От абсолютного положения
              // отставший кадр исправляется следующим же
              const px = event.x + grabDX.value;
              const py = event.y + grabDY.value;
              if (dragAnchor.value === 0) {
                a0x.value = px;
                a0y.value = py;
              } else {
                a1x.value = px;
                a1y.value = py;
              }
              runOnJS(moveAnchor)(dragAnchor.value, px, py);
              return;
            }

            const view = {
              x0: vx0.value,
              x1: vx1.value,
              y0: vy0.value,
              y1: vy1.value,
            };

            // Растяжение одной оси: сдвиг вдоль полосы на её длину меняет
            // масштаб вдвое — столько же даёт кнопка приближения
            if (
              dragAnchor.value === DRAG_TARGETS.AXIS_X ||
              dragAnchor.value === DRAG_TARGETS.AXIS_Y
            ) {
              const alongX = dragAnchor.value === DRAG_TARGETS.AXIS_X;
              const share = alongX ? event.changeX / plotW : event.changeY / plotH;
              const factor = Math.pow(2, share);
              const next = zoomView({
                view,
                scaleX: alongX ? factor : 1,
                scaleY: alongX ? 1 : factor,
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
              return;
            }

            const next = panView({
              view,
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
          // Приходит и когда жест завершился, и когда провалился: иначе после
          // неудачного касания решение о захвате осталось бы от прошлого раза
          .onFinalize(() => {
            'worklet';
            dragAnchor.value = DRAG_TARGETS.UNDECIDED;
          })
      ),
    [
      plotX, plotY, plotW, plotH, baseRangeX, baseRangeY, freedom,
      vx0, vx1, vy0, vy1, a0x, a0y, a1x, a1y, dragAnchor, grabDX, grabDY,
      moveAnchor, commitView, blockScroll,
    ]
  );

  /**
   * Переключает выбор точки для построения прямой вручную
   *
   * @param {number} index - индекс замера
   */
  const togglePoint = useCallback(
    (index) => {
      if (fitMode !== FIT_MODES.AUTO) return;
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
    if (state.fitMode !== FIT_MODES.AUTO || state.dataPoints.length === 0) return;

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
    // Замеров нет — рисовать нечего, показывается подсказка. Кривая соседней
    // скважины сама по себе графика не делает: прямая и расчёт идут по
    // открытой скважине, а без её замеров считать нечего
    if (dataPoints.length === 0) {
      return {
        hasData: false,
        dots: [],
        polylines: [],
        extraPaths: [],
        anchorDots: [],
        xTicks: [],
        yTicks: [],
      };
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

    const dots = dataPoints.map((point, i) => ({
      index: point.index,
      cx: toX(point.x),
      cy: toY(point.y),
      color: pointColors[i],
    }));

    /**
     * Собирает ломаную по набору точек
     *
     * @param {Array<{cx: number, cy: number}>} chain - точки в порядке ряда
     * @returns {string} путь SVG; пустая строка, если соединять нечего
     */
    const polylineOf = (chain) =>
      chain.length > 1
        ? 'M' + chain.map((d) => `${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(' L')
        : '';

    // Ломаная своя у каждой скважины: через точки разных скважин её вести
    // нельзя — на комбинированном графике получилась бы пила
    const polylines = groups.length
      ? groups.map((series) => ({
          key: series.key ?? '',
          color: series.color,
          path: polylineOf(series.indices.map((i) => dots[i])),
        }))
      : [{ key: '', color: c.secondary, path: polylineOf(dots) }];

    const extraPaths = extraPoints.map((series) => {
      const seriesDots = series.points.map((point) => ({
        cx: toX(point.x),
        cy: toY(point.y),
      }));
      return {
        id: series.id,
        name: series.name,
        color: series.color,
        dots: seriesDots,
        path:
          seriesDots.length > 1
            ? 'M' + seriesDots.map((d) => `${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(' L')
            : '',
      };
    });

    // Прямая. В свободном режиме — через поставленные точки; в обычном через
    // две отмеченные, а если отмечены не две — по всем замерам сразу.
    // Одновременно двух прямых не бывает: подобранная исчезает, как только
    // отмечена вторая точка, и возвращается, как только отметки сняты
    let fit = { slope: NaN, intercept: NaN };
    let fitSource = fitMode;

    if (fitMode === FIT_MODES.FREEDOM) {
      if (anchors?.length === 2) fit = lineThroughPoints(anchors[0], anchors[1]);
    } else {
      fit = autoLine;
    }

    // Свободные точки в пикселях: их рисуют и по ним же ловят палец
    const anchorDots =
      fitMode === FIT_MODES.FREEDOM && anchors?.length === 2
        ? anchors.map((anchor) => ({ cx: toX(anchor.x), cy: toY(anchor.y) }))
        : [];

    let fitPath = '';
    if (isFinite(fit.slope) && isFinite(fit.intercept)) {
      const yAtLeft = fit.slope * safeView.x0 + fit.intercept;
      const yAtRight = fit.slope * safeView.x1 + fit.intercept;
      fitPath = `M${toX(safeView.x0).toFixed(1)},${toY(yAtLeft).toFixed(1)} L${toX(
        safeView.x1
      ).toFixed(1)},${toY(yAtRight).toFixed(1)}`;
    }

    // Деления оси абсцисс. На логарифмической оси — как на логарифмической
    // бумаге: подписи на степенях десяти, между ними мелкая сетка. Равномерный
    // шаг по логарифму давал подписи 0.316 и 3.16 — числа, по которым не
    // прикинуть значение на глаз
    const xTicks = [];
    if (mode === X_MODES.LOG) {
      // Сколько подписей помещается по ширине: под каждой стоит число,
      // и меньше пятидесяти пикселей на него давать нельзя
      const room = Math.max(2, Math.floor(plotW / 56));
      for (const tick of logTicks({ from: safeView.x0, to: safeView.x1, maxLabels: room })) {
        xTicks.push({
          x: toX(tick.log),
          label: tick.labelled ? formatLogTick(tick.value) : null,
        });
      }
    } else {
      const stepX = niceStep(rangeX);
      for (let v = Math.ceil(safeView.x0 / stepX) * stepX; v <= safeView.x1 + 1e-9; v += stepX) {
        const px = toX(v);
        if (px < plotX - 0.5 || px > plotX + plotW + 0.5) continue;
        xTicks.push({ x: px, label: formatTick(v) });
        if (xTicks.length > 8) break;
      }
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
      polylines,
      extraPaths,
      fitPath,
      fit,
      fitSource,
      anchorDots,
      xTicks,
      yTicks,
    };
  }, [
    view, baseView, dataPoints, extraPoints, plot, plotX, plotY, plotW, plotH,
    mode, fitMode, selected, anchors, autoLine, groups, pointColors, c.secondary,
  ]);

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

  // Свободный режим только что включён — ставим точки на ту прямую, что
  // была на графике. Повторно не срабатывает: точки уже стоят
  useEffect(() => {
    if (fitMode !== FIT_MODES.FREEDOM || anchors?.length === 2) return;
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
  }, [fitMode, anchors, autoLine, view, onAnchorsChange]);

  // Пиксельное положение точек — только для того, чтобы поймать их пальцем.
  // Пока точку тащат, обратно не пишем: React отдаёт положение с задержкой в
  // кадр, и такая запись возвращала бы точку назад
  const anchorDots = scene.anchorDots;
  useEffect(() => {
    if (anchorDots?.length !== 2) return;
    if (dragAnchor.value === 0 || dragAnchor.value === 1) return;
    a0x.value = anchorDots[0].cx;
    a0y.value = anchorDots[0].cy;
    a1x.value = anchorDots[1].cx;
    a1y.value = anchorDots[1].cy;
  }, [anchorDots, a0x, a0y, a1x, a1y, dragAnchor]);

  // Одна точка отмечена — прямая через неё не проходит, и на графике всё ещё
  // прямая по всем замерам. Без подсказки это выглядит как несработавший тап
  const needsSelection = fitMode === FIT_MODES.AUTO && selected.length === 1;

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
    const x0 = plotX + plotW * 0.1;
    const x1 = plotX + plotW * 0.95;
    const y0 = plotY + plotH * 0.5;
    const y1 = plotY + plotH * 0.12;

    // Доли вдоль прямой и отклонение точек от неё (ёмкость ствола в начале)
    const samples = [0, 0.18, 0.36, 0.54, 0.72, 1];
    const bulge = [-0.07, -0.035, -0.012, 0, 0.008, 0];

    const dots = samples.map((s, i) => ({
      x: x0 + (x1 - x0) * s,
      y: y0 + (y1 - y0) * s - plotH * bulge[i],
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
              key: FIT_MODES.FREEDOM,
              label: I18n.t('fitFreedom', { defaultValue: 'Свободная прямая' }),
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
              {/* Подписанные деления держат сетку, мелкие — только намекают
                  на кратности внутри декады и не должны спорить с данными */}
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
                  opacity={tick.label ? 1 : 0.45}
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

              {/* Соседние скважины рисуются под основной и тоньше: открытая
                  в журнале кривая должна читаться первой */}
              {scene.extraPaths?.map((series) => (
                <React.Fragment key={series.id}>
                  {series.path ? (
                    <Path
                      d={series.path}
                      stroke={series.color}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.85}
                    />
                  ) : null}
                  {series.dots.map((dot, i) => (
                    <Circle
                      key={`${series.id}-${i}`}
                      cx={dot.cx}
                      cy={dot.cy}
                      r={2.6}
                      fill={series.color}
                      opacity={0.85}
                    />
                  ))}
                </React.Fragment>
              ))}

              {scene.polylines?.map((line) =>
                line.path ? (
                  <Path
                    key={`pl${line.key}`}
                    d={line.path}
                    stroke={line.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fill="none"
                  />
                ) : null
              )}

              {scene.dots.map((dot) => {
                const isSelected = selected.includes(dot.index);
                // Отмеченная точка красится акцентом всегда: её надо видеть
                // среди прочих, даже если у скважины свой цвет
                const outline = dot.color ?? c.secondary;
                return (
                  <Circle
                    key={`p${dot.index}`}
                    cx={dot.cx}
                    cy={dot.cy}
                    r={isSelected ? 5.5 : 3.6}
                    fill={isSelected ? c.primaryAccent : c.surface}
                    stroke={isSelected ? c.primaryAccent : outline}
                    strokeWidth={2}
                  />
                );
              })}

              {/* Свободные точки крупнее замеров: их тащат пальцем, и попасть
                  по ним надо с первого раза */}
              {scene.anchorDots?.map((dot, i) => (
                <React.Fragment key={`a${i}`}>
                  <Circle
                    cx={dot.cx}
                    cy={dot.cy}
                    r={11}
                    fill={c.primaryAccent}
                    opacity={0.18}
                  />
                  <Circle
                    cx={dot.cx}
                    cy={dot.cy}
                    r={6.5}
                    fill={c.plotBg}
                    stroke={c.primaryAccent}
                    strokeWidth={2.5}
                  />
                </React.Fragment>
              ))}
            </G>

            {/* Оси рисуются поверх клипа: они не двигаются и не масштабируются.
                Начало отсчёта — в левом нижнем углу, поэтому ось абсцисс идёт
                понизу, а не поверху */}
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
              y1={plotY + plotH}
              x2={plotX + plotW}
              y2={plotY + plotH}
              stroke={c.textSecondary}
              strokeWidth={1}
            />
          </Svg>

          {/* Подписи делений — обычным текстом, чтобы работали табличные цифры.
              У мелкой сетки подписи нет: она показывает кратности внутри
              декады, и числа на ней стояли бы сплошной строкой */}
          {scene.hasData && (
            <>
              {scene.xTicks.map((tick, i) =>
                tick.label == null ? null : (
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

      {/* Легенда куста: какая кривая какой скважине принадлежит. Без неё
          три линии на плоскости неразличимы.

          Кривые бывают двух родов, и одновременно они не встречаются: либо
          соседние скважины идут рядом с открытой (временнóе прослеживание),
          либо весь ряд разбит по скважинам (комбинированное) */}
      {scene.hasData && groups.length > 1 && (
        <View style={styles.legend}>
          {groups.map((series) => (
            <View key={series.key ?? ''} style={styles.legendItem}>
              <View style={[styles.legendMark, { backgroundColor: series.color }]} />
              <Text style={[styles.legendText, { color: c.textSecondary }]} numberOfLines={1}>
                {series.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {scene.hasData && groups.length === 0 && extraSeries.length > 0 && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendMark, { backgroundColor: c.secondary }]} />
            <Text style={[styles.legendText, { color: c.text }]} numberOfLines={1}>
              {activeSeriesName}
            </Text>
          </View>
          {scene.extraPaths.map((series) => (
            <View key={series.id} style={styles.legendItem}>
              <View style={[styles.legendMark, { backgroundColor: series.color }]} />
              <Text style={[styles.legendText, { color: c.textSecondary }]} numberOfLines={1}>
                {series.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Что отложено по осям. Стрелки, а не подписи вдоль самих осей: места
          на узком полотне телефона нет, поворот текста в react-native-svg на
          вебе съезжает, а числа у делений без величины не читаются — по одному
          «25» не понять, метры это, минуты или мин/м² */}
      {scene.hasData && (
        <View style={styles.axisRow}>
          <Text style={[styles.axisText, { color: c.textSecondary }]} numberOfLines={1}>
            {`↑ s, ${drawdownUnit}`}
          </Text>
          <Text style={[styles.axisText, { color: c.textSecondary }]} numberOfLines={1}>
            {`→ ${
              xAxisTitle ??
              (mode === X_MODES.SQRT ? `√t, √${timeUnit}` : `t, ${timeUnit}`)
            }`}
          </Text>
        </View>
      )}

      {/* Подсказка под графиком, а не поверх: перекрывать данные,
          по которым надо попасть пальцем, — плохая идея */}
      {scene.hasData && needsSelection && (
        <View style={[styles.hint, { backgroundColor: c.primaryWash, borderColor: c.wineBorder }]}>
          <Text style={[styles.hintText, { color: c.primaryAccent }]}>
            {I18n.t('selectSecondPoint', {
              defaultValue:
                'Отметьте вторую точку — пока прямая идёт по всем замерам',
            })}
          </Text>
        </View>
      )}

      {scene.hasData && freedom && (
        <View style={[styles.hint, { backgroundColor: c.primaryWash, borderColor: c.wineBorder }]}>
          <Text style={[styles.hintText, { color: c.primaryAccent }]}>
            {I18n.t('freedomHint', {
              defaultValue:
                'Тяните точки — прямая идёт через них. Полосы осей растягивают свою ось',
            })}
          </Text>
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
  // Легенда куста: переносится по строкам — скважин может быть много
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
