/**
 * Видимая область графика и жесты над ней
 *
 * Здесь три решения, каждое — починка отдельной поломки.
 *
 * **Один источник правды.** Область живёт в одном shared value на UI-потоке и
 * зеркалится в React с ограничением частоты. Раньше это были четыре отдельных
 * значения плюс состояние React, а перенос выбрасывал кадр без хвостового
 * вызова: последнее состояние доходило до React только через `onEnd` жеста, и
 * любой путь мимо него — отмена системой, перехват прокруткой — оставлял два
 * источника рассогласованными.
 *
 * **Жест собирается один раз.** Раньше `pan` пересобирался при изменении любой
 * из двух десятков зависимостей, а подмена обработчика прямо во время
 * распознавания рвёт жест: палец «отпускает» на первом же кадре. Теперь
 * изменяемые входы едут через shared value, а не через список зависимостей.
 *
 * Тонкость, на которой легко ошибиться: обычный ref внутри worklet не годится.
 * Reanimated копирует захваченное замыкание в свой рантайм при создании
 * worklet-а, и мутации `ref.current` до него не доходят — жест намертво
 * запомнил бы начальные `plot` и `base`. Поэтому геометрия идёт через shared
 * value, а колбэки — через стабильные диспетчеры, которые читают ref уже на
 * JS-потоке, где ref работает как обычно.
 *
 * **Масштаб помнится по ключу системы координат.** Хранилище живёт в экране и
 * приходит пропсом: развёрнутый и обычный график — две разные ветки рендера,
 * то есть два разных монтирования, и ref внутри графика их бы не пережил.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import {
  pixelToValue,
  findNearestPoint,
  pickDragTarget,
  clampAnchorToPlot,
  nearestAnchorIndex,
  valueToPixelX,
  valueToPixelY,
  DRAG_TARGETS,
} from '../../calc/chartGeometry';
import { zoomViewport, panViewport, clampViewport } from '../../calc/chartViewport';

/**
 * Порог активации перетаскивания, px
 *
 * Восемь пикселей ощущаются как залипание: палец уже поехал, а полотно ещё
 * стоит. В Desmos полотно трогается сразу. Два пикселя — это дрожание руки,
 * ниже опускать нельзя, иначе тап по замеру перестанет отличаться от сдвига.
 */
const PAN_THRESHOLD = 2;

/** Радиус захвата замера пальцем, px */
const TAP_RADIUS = 26;

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
 * Запас захвата полосы оси внутрь полотна, px
 *
 * Полоса под графиком высотой 38 px, левая шириной 46 px: попасть в них
 * пальцем, не задев данные, непросто, и попадание краем пальца доставалось
 * панораме — а геолог думал, что жест не работает.
 */
const AXIS_GRAB = 12;

/** Насколько сдвиг пальца по полосе оси меняет её масштаб */
const AXIS_STRETCH_BASE = 2;

/**
 * Доля скорости, остающаяся за кадр при выбеге
 *
 * Полотно, встающее колом в момент отрыва пальца, и есть то самое ощущение
 * деревянности: в Desmos и на любой карте оно проезжает по инерции. Значение
 * подобрано под шестьдесят кадров в секунду — примерно полсекунды выбега.
 */
const GLIDE_FRICTION = 0.94;

/** Скорость, ниже которой выбег незаметен и его пора гасить, px/с */
const GLIDE_MIN_SPEED = 24;

/**
 * Область просмотра и жесты над ней
 *
 * @param {Object} params
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.base - область по данным
 * @param {{x: number, y: number, w: number, h: number}} params.plot - область построения
 * @param {string} params.viewKey - чем задана система координат
 * @param {Map} [params.viewportStore] - хранилище областей по ключу
 * @param {Object} [params.scrollRef] - прокрутка, которую перекрывает жест
 * @param {boolean} params.freedom - включён ли свободный режим
 * @param {Array<{x: number, y: number, index: number}>} params.fitPoints - замеры для отметки
 * @param {Array<{x: number, y: number}>|null} params.anchors - свободные точки
 * @param {Function} params.onAnchorsChange - свободные точки сдвинулись
 * @param {Function} params.onSelectPoint - тап по замеру
 * @param {number} params.minZoom - предел отдаления
 * @param {number} params.maxZoom - предел приближения
 * @returns {{view: Object, gesture: Object, zoomBy: Function, reset: Function}}
 */
export default function useChartViewport({
  base,
  plot,
  viewKey,
  viewportStore,
  scrollRef,
  freedom,
  fitPoints,
  anchors,
  onAnchorsChange,
  onSelectPoint,
  minZoom,
  maxZoom,
}) {
  const viewport = useSharedValue(base);
  const [view, setView] = useState(base);

  // Изменяемая геометрия для worklet-ов. Именно shared value, а не ref: worklet
  // копирует захваченное замыкание в свой рантайм при создании, и мутации
  // обычного ref до него не доходят
  const live = useSharedValue({ base, plot, freedom, minZoom, maxZoom });
  useEffect(() => {
    live.value = { base, plot, freedom, minZoom, maxZoom };
  }, [live, base, plot, freedom, minZoom, maxZoom]);

  // То же самое для обработчиков на JS-потоке: там ref работает как обычно
  const jsRef = useRef({});
  jsRef.current = {
    view,
    plot,
    base,
    freedom,
    anchors,
    fitPoints,
    viewKey,
    onAnchorsChange,
    onSelectPoint,
  };

  // Разброс пальцев по осям на прошлом кадре щипка: по нему считается масштаб
  // каждой оси в отдельности
  const spanX = useSharedValue(0);
  const spanY = useSharedValue(0);

  // Положение свободных точек в пикселях — для жеста на UI-потоке
  const a0x = useSharedValue(NaN);
  const a0y = useSharedValue(NaN);
  const a1x = useSharedValue(NaN);
  const a1y = useSharedValue(NaN);

  // Что тащит текущий жест: индекс свободной точки, полоса оси или полотно
  const dragTarget = useSharedValue(DRAG_TARGETS.UNDECIDED);
  // Смещение точки от пальца в момент захвата: без него точка прыгала бы
  // центром под палец
  const grabDX = useSharedValue(0);
  const grabDY = useSharedValue(0);

  /**
   * Смещение пальца на прошлом кадре
   *
   * Приращение считается вычитанием, а не берётся из `event.changeX`: этого
   * поля в жесте нет на всех платформах, и там, где его нет, оно приходит
   * `undefined`. Дальше вычитание давало NaN, окно портилось, а защита от
   * испорченного окна возвращала вид по данным — перетаскивание выглядело
   * как сброс масштаба, а не как сдвиг.
   */
  const prevTX = useSharedValue(0);
  const prevTY = useSharedValue(0);


  /**
   * Переносит область из потока жеста в React
   *
   * Без ограничения частоты: раньше кадр придерживался на 16 мс, и полотно
   * заметно отставало от пальца — жест ощущался деревянным. Сцена считается
   * по десяткам точек, этой работы на кадр немного, а лишний кадр задержки
   * виден сразу.
   */
  const syncView = useCallback((next) => {
    setView(next);
  }, []);

  // Идёт ли сейчас выбег: кадр анимации, который надо уметь оборвать новым
  // касанием, иначе полотно продолжит ехать из-под пальца
  const glideRef = useRef(0);
  const stopGlide = useCallback(() => {
    if (glideRef.current) {
      cancelAnimationFrame(glideRef.current);
      glideRef.current = 0;
    }
  }, []);

  useEffect(() => stopGlide, [stopGlide]);

  /** Гарантированный перенос после жеста, с записью в хранилище масштабов */
  const commitView = useCallback(
    (next) => {
      viewportStore?.set(jsRef.current.viewKey, next);
      setView(next);
    },
    [viewportStore]
  );

  /**
   * Выбег после отрыва пальца
   *
   * Скорость приходит от жеста в пикселях в секунду, дальше она гасится
   * трением и на каждом кадре превращается в обычный сдвиг области. Тот же
   * `panViewport`, что и при перетаскивании, поэтому и ограничение положения
   * работает на выбеге тоже: данные не улетят по инерции.
   *
   * @param {number} vx - скорость по X, px/с
   * @param {number} vy - скорость по Y, px/с
   */
  const glide = useCallback(
    (vx, vy) => {
      stopGlide();
      // Скорости может не быть: набор полей события у жеста разный на разных
      // платформах. Без неё просто закрепляем текущее положение
      if (!isFinite(vx) || !isFinite(vy) || Math.hypot(vx, vy) <= GLIDE_MIN_SPEED) {
        commitView(viewport.value);
        return;
      }

      let velX = vx;
      let velY = vy;
      let last = Date.now();

      const step = () => {
        const now = Date.now();
        // Кадр мог задержаться: без ограничения долгая пауза давала бы
        // один огромный скачок вместо плавного движения
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        const decay = Math.pow(GLIDE_FRICTION, dt * 60);
        velX *= decay;
        velY *= decay;

        const state = jsRef.current;
        const next = panViewport({
          view: viewport.value,
          dx: velX * dt,
          dy: velY * dt,
          plot: state.plot,
          base: state.base,
        });
        viewport.value = next;
        setView(next);

        if (Math.hypot(velX, velY) > GLIDE_MIN_SPEED) {
          glideRef.current = requestAnimationFrame(step);
        } else {
          glideRef.current = 0;
          commitView(next);
        }
      };

      glideRef.current = requestAnimationFrame(step);
    },
    [commitView, stopGlide, viewport]
  );

  // Сменилась система координат: берём масштаб из хранилища, если геолог уже
  // ставил его для этого вида, и подгоняем под данные только если нет.
  // Правка замера сюда не попадает — ключ от значений замеров не зависит
  useEffect(() => {
    const stored = viewportStore?.get(viewKey);
    const next = stored ? clampViewport(stored, { base }) : base;
    // Сравнение по значению, а не по ссылке: `base` пересобирается вместе с
    // сериями, и безусловный setState здесь сам вызывал бы следующий рендер.
    // Одного нестабильного пропса выше по цепочке хватало, чтобы экран ушёл
    // в бесконечную перерисовку
    const now = viewport.value;
    if (
      now.x0 === next.x0 &&
      now.x1 === next.x1 &&
      now.y0 === next.y0 &&
      now.y1 === next.y1
    ) {
      return;
    }
    viewport.value = next;
    setView(next);
  }, [viewKey, base, viewport, viewportStore]);

  useAnimatedReaction(
    () => viewport.value,
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

  /**
   * Переносит свободную точку туда, куда её утащил палец
   *
   * @param {number} index - какая из двух точек
   * @param {number} px - новое положение, px
   * @param {number} py - новое положение, px
   */
  const moveAnchor = useCallback((index, px, py) => {
    const now = jsRef.current;
    if (now.anchors?.length !== 2) return;
    const next = now.anchors.slice();
    next[index] = pixelToValue({ px, py, view: now.view, plot: now.plot });
    now.onAnchorsChange?.(next);
  }, []);

  /**
   * Касание полотна: отметка замера либо перенос свободной точки
   *
   * В свободном режиме тап ставит ближайшую точку под палец. Это же
   * единственный способ вернуть прямую, если точки разъехались по краям:
   * перетаскивать там уже нечего.
   */
  const handleTap = useCallback((touchX, touchY) => {
    const now = jsRef.current;

    if (now.freedom) {
      if (now.anchors?.length !== 2) return;
      const dots = now.anchors.map((anchor) => ({
        cx: valueToPixelX(anchor.x, now.view, now.plot),
        cy: valueToPixelY(anchor.y, now.view, now.plot),
      }));
      const index = nearestAnchorIndex({
        px: touchX,
        py: touchY,
        ax0: dots[0].cx,
        ay0: dots[0].cy,
        ax1: dots[1].cx,
        ay1: dots[1].cy,
      });
      const spot = clampAnchorToPlot({ px: touchX, py: touchY, plot: now.plot });
      const next = now.anchors.slice();
      next[index] = pixelToValue({
        px: spot.px,
        py: spot.py,
        view: now.view,
        plot: now.plot,
      });
      now.onAnchorsChange?.(next);
      return;
    }

    if (!now.fitPoints?.length) return;
    const nearest = findNearestPoint({
      points: now.fitPoints,
      touchX,
      touchY,
      view: now.view,
      plot: now.plot,
      radius: TAP_RADIUS,
    });
    if (nearest) now.onSelectPoint?.(nearest.index);
  }, []);

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

            const { plot: p, base: b, minZoom: lo, maxZoom: hi } = live.value;
            const focalX = (first.x + second.x) / 2;
            const focalY = (first.y + second.y) / 2;

            viewport.value = zoomViewport({
              view: viewport.value,
              scaleX,
              scaleY,
              // Точка между пальцами остаётся на месте: зум идёт туда, куда смотрят
              focusX: Math.min(1, Math.max(0, (focalX - p.x) / p.w)),
              focusY: Math.min(1, Math.max(0, (focalY - p.y) / p.h)),
              base: b,
              minZoom: lo,
              maxZoom: hi,
            });
          })
          .onEnd(() => {
            'worklet';
            runOnJS(commitView)(viewport.value);
          })
      ),
    [blockScroll, commitView, live, spanX, spanY, viewport]
  );

  const pan = useMemo(
    () =>
      blockScroll(
        Gesture.Pan()
          .minPointers(1)
          .maxPointers(1)
          // Порог активации: без него перетаскивание перехватывает любое касание
          // и одиночный тап по точке никогда не срабатывает
          .activeOffsetX([-PAN_THRESHOLD, PAN_THRESHOLD])
          .activeOffsetY([-PAN_THRESHOLD, PAN_THRESHOLD])
          .onBegin(() => {
            'worklet';
            dragTarget.value = DRAG_TARGETS.UNDECIDED;
            prevTX.value = 0;
            prevTY.value = 0;
            // Новое касание останавливает выбег: иначе полотно продолжает
            // ехать из-под пальца, и поймать нужную точку невозможно
            runOnJS(stopGlide)();
          })
          .onUpdate((event) => {
            'worklet';
            const { plot: p, base: b, freedom: free, minZoom: lo, maxZoom: hi } = live.value;

            const changeX = event.translationX - prevTX.value;
            const changeY = event.translationY - prevTY.value;
            prevTX.value = event.translationX;
            prevTY.value = event.translationY;

            // Что именно тащим, решается на первом же кадре движения, а не при
            // касании: жест начинается раньше активации, и между этими моментами
            // касание может уйти соседнему обработчику. Точка начала
            // восстанавливается из смещения — она надёжнее, чем состояние,
            // выставленное в другом обработчике
            if (dragTarget.value === DRAG_TARGETS.UNDECIDED) {
              const picked = pickDragTarget({
                startX: event.x - event.translationX,
                startY: event.y - event.translationY,
                ax0: a0x.value,
                ay0: a0y.value,
                ax1: a1x.value,
                ay1: a1y.value,
                freedom: free,
                // Запас внутрь полотна: полоса оси узкая, и попадание по ней
                // краем пальца иначе доставалось панораме
                plot: { x: p.x + AXIS_GRAB, y: p.y, h: p.h - AXIS_GRAB },
                radius: ANCHOR_RADIUS,
              });
              dragTarget.value = picked.target;
              grabDX.value = picked.grabDX;
              grabDY.value = picked.grabDY;
            }

            if (dragTarget.value === 0 || dragTarget.value === 1) {
              // Положение берётся от пальца целиком, а не копится приращениями:
              // React возвращает точку с задержкой в кадр, и накопленное
              // смещение такой возврат откатывал бы
              const spot = clampAnchorToPlot({
                px: event.x + grabDX.value,
                py: event.y + grabDY.value,
                plot: p,
              });
              if (dragTarget.value === 0) {
                a0x.value = spot.px;
                a0y.value = spot.py;
              } else {
                a1x.value = spot.px;
                a1y.value = spot.py;
              }
              runOnJS(moveAnchor)(dragTarget.value, spot.px, spot.py);
              return;
            }

            // Растяжение одной оси: сдвиг вдоль полосы на её длину меняет
            // масштаб вдвое — столько же даёт кнопка приближения
            if (
              dragTarget.value === DRAG_TARGETS.AXIS_X ||
              dragTarget.value === DRAG_TARGETS.AXIS_Y
            ) {
              const alongX = dragTarget.value === DRAG_TARGETS.AXIS_X;
              const share = alongX ? changeX / p.w : changeY / p.h;
              const factor = Math.pow(AXIS_STRETCH_BASE, share);
              viewport.value = zoomViewport({
                view: viewport.value,
                scaleX: alongX ? factor : 1,
                scaleY: alongX ? 1 : factor,
                focusX: 0.5,
                focusY: 0.5,
                base: b,
                minZoom: lo,
                maxZoom: hi,
              });
              return;
            }

            viewport.value = panViewport({
              view: viewport.value,
              dx: changeX,
              dy: changeY,
              plot: p,
              base: b,
            });
          })
          .onEnd((event) => {
            'worklet';
            // Выбег только у полотна: растянутая ось и утащенная точка стоят
            // ровно там, где их оставил палец
            if (dragTarget.value === DRAG_TARGETS.VIEW) {
              runOnJS(glide)(event.velocityX, event.velocityY);
            } else {
              runOnJS(commitView)(viewport.value);
            }
          })
          // Приходит и когда жест завершился, и когда провалился: иначе после
          // неудачного касания решение о захвате осталось бы от прошлого раза
          .onFinalize(() => {
            'worklet';
            dragTarget.value = DRAG_TARGETS.UNDECIDED;
          })
      ),
    [
      blockScroll, commitView, glide, stopGlide, live, viewport, dragTarget,
      grabDX, grabDY, prevTX, prevTY, a0x, a0y, a1x, a1y, moveAnchor,
    ]
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        // Ограничения по времени нет: в перчатке касание легко длится дольше
        // четырёх десятых секунды, и такой тап просто не срабатывал
        .maxDistance(24)
        .onEnd((event, success) => {
          'worklet';
          if (success) runOnJS(handleTap)(event.x, event.y);
        }),
    [handleTap]
  );

  // Потащил — панорама, коснулся — выбор. Simultaneous давал оба сразу: сдвиг
  // на 8–14 px и двигал полотно, и переключал отметку замера
  const gesture = useMemo(
    () => Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, tap)),
    [pinch, pan, tap]
  );

  /**
   * Пиксельное положение свободных точек — только чтобы поймать их пальцем
   *
   * Пока точку тащат, обратно не пишем: React отдаёт положение с задержкой в
   * кадр, и такая запись возвращала бы точку назад.
   */
  useEffect(() => {
    if (anchors?.length !== 2) return;
    if (dragTarget.value === 0 || dragTarget.value === 1) return;
    a0x.value = valueToPixelX(anchors[0].x, view, plot);
    a0y.value = valueToPixelY(anchors[0].y, view, plot);
    a1x.value = valueToPixelX(anchors[1].x, view, plot);
    a1y.value = valueToPixelY(anchors[1].y, view, plot);
  }, [anchors, view, plot, a0x, a0y, a1x, a1y, dragTarget]);

  const reset = useCallback(() => {
    viewport.value = base;
    commitView(base);
  }, [base, commitView, viewport]);

  /**
   * Меняет масштаб кнопкой — от центра области
   *
   * @param {number} scale - во сколько раз приблизить (>1) или отдалить (<1)
   */
  const zoomBy = useCallback(
    (scale) => {
      const next = zoomViewport({
        view: viewport.value,
        scale,
        focusX: 0.5,
        focusY: 0.5,
        base,
        minZoom,
        maxZoom,
      });
      viewport.value = next;
      commitView(next);
    },
    [base, commitView, maxZoom, minZoom, viewport]
  );

  return { view, gesture, zoomBy, reset };
}
