/**
 * Геометрия графика понижения
 *
 * Пересчёт между координатами данных и пикселями, масштабирование с
 * привязкой к точке фокуса и поиск ближайшего замера под пальцем.
 *
 * Вынесено из компонента отдельно: это чистые вычисления, от которых
 * зависит и попадание пальцем по точке, и то, останутся ли оси на месте
 * при зуме. Такие вещи должны проверяться тестами, а не глазами.
 */

import { lineThroughPoints } from './cooperJacob';

/**
 * Переводит значение по оси X в пиксель
 *
 * @param {number} value - значение в координатах данных
 * @param {{x0: number, x1: number}} view - видимая область
 * @param {{x: number, w: number}} plot - область построения
 * @returns {number} координата в пикселях
 */
export function valueToPixelX(value, view, plot) {
  const range = view.x1 - view.x0;
  if (!(range > 0)) return plot.x;
  return plot.x + ((value - view.x0) / range) * plot.w;
}

/**
 * Переводит значение по оси Y в пиксель
 *
 * Начало отсчёта — в левом нижнем углу, понижение откладывается вверх. Так
 * построены графики способа прямой линии в АНСДИМАТ и так же устроена
 * диагностика ([`DiagnosticPlot`](../components/DiagnosticPlot.js)): вниз ось
 * понижения направляют на разрезе депрессионной воронки, а не на графике,
 * по которому снимают наклон.
 *
 * @param {number} value - значение в координатах данных
 * @param {{y0: number, y1: number}} view - видимая область
 * @param {{y: number, h: number}} plot - область построения
 * @returns {number} координата в пикселях
 */
export function valueToPixelY(value, view, plot) {
  const range = view.y1 - view.y0;
  if (!(range > 0)) return plot.y + plot.h;
  return plot.y + plot.h - ((value - view.y0) / range) * plot.h;
}

/**
 * Масштабирует видимую область относительно точки фокуса
 *
 * Значение под пальцами остаётся на прежнем месте экрана — иначе при щипке
 * график уезжает из-под рук. Диапазон ограничен пределами масштаба, чтобы
 * нельзя было зумом вывести данные за пределы видимости.
 *
 * Оси растягиваются по отдельности: `scaleX` и `scaleY` независимы, и равными
 * их делает только общий `scale`. Раздельное растяжение нужно затем же, зачем
 * оно в Desmos, — вытянуть поздний участок записи по времени, не теряя размаха
 * по понижению, и наоборот.
 *
 * @param {Object} params
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.view - текущая область
 * @param {number} [params.scale] - во сколько раз приблизить обе оси сразу
 * @param {number} [params.scaleX] - масштаб только по X; отменяет общий
 * @param {number} [params.scaleY] - масштаб только по Y; отменяет общий
 * @param {number} params.focusX - фокус по X в долях полотна, 0..1
 * @param {number} params.focusY - фокус по Y в долях полотна, 0..1, сверху вниз:
 *   так его отдаёт жест. Понижение отложено вверх, и в значения он переводится
 *   дополнением до единицы
 * @param {{x: number, y: number}} params.baseRange - исходные диапазоны осей
 * @param {number} params.minZoom - минимальное приближение
 * @param {number} params.maxZoom - максимальное приближение
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новая область
 */
export function zoomView({
  view,
  scale,
  scaleX,
  scaleY,
  focusX,
  focusY,
  baseRange,
  minZoom,
  maxZoom,
}) {
  'worklet';
  const rangeX = view.x1 - view.x0;
  const rangeY = view.y1 - view.y0;

  const byX = scaleX ?? scale;
  const byY = scaleY ?? scale;

  if (
    !(rangeX > 0) ||
    !(rangeY > 0) ||
    !(byX > 0) ||
    !isFinite(byX) ||
    !(byY > 0) ||
    !isFinite(byY)
  ) {
    return view;
  }

  const clampRange = (next, base) =>
    Math.min(base / minZoom, Math.max(base / maxZoom, next));

  const nextRangeX = clampRange(rangeX / byX, baseRange.x);
  const nextRangeY = clampRange(rangeY / byY, baseRange.y);

  // Доля по Y приходит от жеста и отсчитывается сверху, а значения растут
  // вверх: точка под пальцами лежит на дополнении до единицы
  const shareY = 1 - focusY;
  const anchorX = view.x0 + focusX * rangeX;
  const anchorY = view.y0 + shareY * rangeY;

  const x0 = anchorX - focusX * nextRangeX;
  const y0 = anchorY - shareY * nextRangeY;

  return { x0, x1: x0 + nextRangeX, y0, y1: y0 + nextRangeY };
}

/**
 * Сдвигает видимую область на смещение в пикселях
 *
 * Перевод в единицы данных зависит от текущего масштаба, поэтому жест
 * ощущается одинаково и при сильном приближении, и при общем виде.
 *
 * @param {Object} params
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.view - текущая область
 * @param {number} params.dx - смещение пальца по X, px
 * @param {number} params.dy - смещение пальца по Y, px, вниз по экрану
 * @param {{w: number, h: number}} params.plot - область построения
 * @returns {{x0: number, x1: number, y0: number, y1: number}} новая область
 */
export function panView({ view, dx, dy, plot }) {
  'worklet';
  const rangeX = view.x1 - view.x0;
  const rangeY = view.y1 - view.y0;

  const shiftX = -(dx / plot.w) * rangeX;
  // Понижение отложено вверх, поэтому палец вниз уводит окно к бо́льшим
  // значениям: знак обратен горизонтальному
  const shiftY = (dy / plot.h) * rangeY;

  return {
    x0: view.x0 + shiftX,
    x1: view.x1 + shiftX,
    y0: view.y0 + shiftY,
    y1: view.y1 + shiftY,
  };
}

/**
 * Находит ближайший к касанию замер
 *
 * @param {Object} params
 * @param {Array<{index: number, x: number, y: number}>} params.points - замеры
 * @param {number} params.touchX - координата касания, px
 * @param {number} params.touchY - координата касания, px
 * @param {Object} params.view - видимая область
 * @param {Object} params.plot - область построения
 * @param {number} params.radius - радиус захвата, px
 * @returns {Object|null} ближайший замер или null, если палец далеко
 */
export function findNearestPoint({ points, touchX, touchY, view, plot, radius }) {
  let best = null;
  let bestDistance = Infinity;

  for (const point of points) {
    const px = valueToPixelX(point.x, view, plot);
    const py = valueToPixelY(point.y, view, plot);
    const distance = Math.hypot(px - touchX, py - touchY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }

  return bestDistance <= radius ? best : null;
}

/**
 * Обновляет набор выбранных точек
 *
 * Держим не больше двух: повторный тап снимает выбор, третий заменяет
 * самую старую — иначе пришлось бы отдельно объяснять, как сбросить выбор.
 *
 * @param {Array<number>} selected - текущие индексы
 * @param {number} index - индекс точки, по которой тапнули
 * @returns {Array<number>} новый набор
 */
export function toggleSelection(selected, index) {
  if (selected.includes(index)) {
    return selected.filter((i) => i !== index);
  }
  return selected.length < 2 ? [...selected, index] : [selected[1], index];
}

/**
 * Разбивает точки на серии по признаку группы
 *
 * Нужно комбинированному прослеживанию: на одной плоскости лежат замеры всех
 * скважин куста, прямая ведётся по всем сразу, а цвет должен показывать, чья
 * точка. Существующий механизм соседних кривых для этого не годится — его
 * точки в подбор прямой не входят.
 *
 * Серии идут в порядке первого появления, а не по алфавиту: порядок задаёт
 * список скважин, и цвет скважины не должен меняться от переименования
 * соседней. Точки помнят своё место в исходном ряду — по этим же индексам
 * идут отметка точек и подбор прямой по двум выбранным.
 *
 * @param {Array<{group?: string, groupName?: string}>} points - точки ряда
 * @param {Array<string>} palette - цвета серий; повторяются по кругу
 * @returns {Array<{key: string, name: string, color: string, indices: Array<number>}>}
 *   серии; пустой список, если признак группы не задан ни у одной точки
 */
export function groupPoints(points, palette) {
  if (!points.some((point) => point?.group != null)) return [];

  const byKey = new Map();
  points.forEach((point, index) => {
    const key = point?.group ?? null;
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        name: point?.groupName,
        color: palette[byKey.size % palette.length],
        indices: [],
      });
    }
    byKey.get(key).indices.push(index);
  });

  return [...byKey.values()];
}

/** Кратности внутри декады: мелкая сетка логарифмической бумаги */
const DECADE_STEPS = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Наибольшее число декад, при котором ещё рисуется мелкая сетка
 *
 * Дальше линии 2…9 сливаются в заливку и мешают читать точки.
 */
const MINOR_GRID_DECADES = 2.2;

/**
 * Деления логарифмической оси
 *
 * Логарифмическая ось размечается не «красивым шагом», а как логарифмическая
 * бумага: подписи на степенях десяти, между ними мелкая сетка по кратностям
 * 2…9. Равномерный шаг по логарифму давал подписи 0.316, 3.16, 31.6 — числа,
 * которых на бланке не бывает и по которым не прикинуть значение на глаз.
 *
 * Возвращаются координаты в логарифмах: полотно работает в них же.
 *
 * @param {Object} params
 * @param {number} params.from - левый край области, в логарифмах
 * @param {number} params.to - правый край области, в логарифмах
 * @param {number} [params.maxLabels] - сколько подписей помещается по ширине
 * @returns {Array<{log: number, value: number, labelled: boolean}>} деления по
 *   возрастанию; labelled — нужна ли подпись, остальные идут мелкой сеткой
 */
export function logTicks({ from, to, maxLabels = 6 }) {
  if (!isFinite(from) || !isFinite(to) || !(to > from)) return [];

  const span = to - from;
  // Слагаемое 0 убирает минус-ноль, который Math.ceil даёт на границе:
  // на глаз он неотличим от нуля, а сравнение делений ломает
  const firstDecade = Math.ceil(from - 1e-9) + 0;
  const lastDecade = Math.floor(to + 1e-9);
  // На широком охвате подписывается не каждая декада: иначе числа налезают
  const decadeStep = Math.max(1, Math.ceil(span / Math.max(1, maxLabels)));

  const ticks = [];
  for (let decade = firstDecade; decade <= lastDecade; decade += 1) {
    ticks.push({
      log: decade,
      value: Math.pow(10, decade),
      labelled: ((decade % decadeStep) + decadeStep) % decadeStep === 0,
    });
  }

  // Мелкая сетка ставится только там, где её видно по отдельности
  if (span <= MINOR_GRID_DECADES) {
    for (let decade = firstDecade - 1; decade <= lastDecade; decade += 1) {
      for (const step of DECADE_STEPS) {
        const log = decade + Math.log10(step);
        if (log < from - 1e-9 || log > to + 1e-9) continue;
        ticks.push({ log, value: step * Math.pow(10, decade), labelled: false });
      }
    }
  }

  ticks.sort((a, b) => a.log - b.log);

  // Меньше двух подписей — целых степеней десяти в поле почти нет, и ось
  // осталась бы без чисел. Тогда подписываются деления мелкой сетки, но не
  // подряд и не через равное число штук, а по кратностям: на логарифмической
  // бумаге подписаны 1, 2, 5, и глаз ищет на оси именно их
  const labelledCount = ticks.filter((tick) => tick.labelled).length;
  if (labelledCount < 2 && ticks.length > 1) {
    // Перебор с конца: нужен самый частый набор, который ещё помещается.
    // Начав с начала, мы бы всегда останавливались на самом редком
    const chosen =
      LABEL_MANTISSAS.filter(
        (mantissas) => countLabels(ticks, mantissas) <= maxLabels
      ).pop() ?? LABEL_MANTISSAS[0];

    for (const tick of ticks) {
      tick.labelled = chosen.includes(mantissaOf(tick.value));
    }
  }

  return ticks;
}

/**
 * Кратности, которые подписывают на логарифмической оси
 *
 * От редкого набора к частому: берётся самый частый, чей набор подписей ещё
 * помещается по ширине. Так на полутора декадах выходит 20, 50, 100, 200, 500,
 * а на трети декады — 20, 30, 40, 50, 60.
 */
const LABEL_MANTISSAS = [
  [1, 2, 5],
  [1, 2, 3, 5],
  [1, 2, 3, 4, 5, 6, 8],
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
];

/**
 * Первая значащая цифра числа
 *
 * Значения делений собраны как m·10^k, но после умножения на степень десяти
 * дают хвосты вида 19.999999999999996 — отсюда округление.
 *
 * @param {number} value - значение деления
 * @returns {number} кратность 1..9
 */
function mantissaOf(value) {
  const decade = Math.floor(Math.log10(value) + 1e-9);
  return Math.round(value / Math.pow(10, decade));
}

/**
 * Сколько подписей даст набор кратностей
 *
 * @param {Array<{value: number}>} ticks - деления
 * @param {Array<number>} mantissas - подписываемые кратности
 * @returns {number} число подписей
 */
function countLabels(ticks, mantissas) {
  return ticks.filter((tick) => mantissas.includes(mantissaOf(tick.value))).length;
}

/**
 * Переводит точку полотна обратно в координаты данных
 *
 * Обратная сторона valueToPixelX/Y. Нужна свободным точкам: палец приходит в
 * пикселях, а прямая через них строится в координатах данных.
 *
 * @param {Object} params
 * @param {number} params.px - координата на полотне, px
 * @param {number} params.py - координата на полотне, px
 * @param {{x0: number, x1: number, y0: number, y1: number}} params.view - видимая область
 * @param {{x: number, y: number, w: number, h: number}} params.plot - область построения
 * @returns {{x: number, y: number}} значение в координатах данных
 */
export function pixelToValue({ px, py, view, plot }) {
  const rangeX = view.x1 - view.x0;
  const rangeY = view.y1 - view.y0;

  return {
    x: rangeX > 0 && plot.w > 0 ? view.x0 + ((px - plot.x) / plot.w) * rangeX : view.x0,
    // Начало отсчёта внизу: пиксель считается от нижнего края области
    y:
      rangeY > 0 && plot.h > 0
        ? view.y0 + ((plot.y + plot.h - py) / plot.h) * rangeY
        : view.y0,
  };
}

/** Где по ширине области встают свободные точки при первой постановке */
const ANCHOR_SHARES = [0.2, 0.8];

/**
 * Ставит две точки на уже построенную прямую
 *
 * Нужно при переходе в свободный режим: точки должны появиться именно на той
 * прямой, что была на графике, — и проведённой по всем замерам, и по двум
 * выбранным. Иначе переключение режима само по себе меняло бы результат.
 *
 * Прямой может и не быть — замеров мало или дебит не введён. Тогда точки
 * встают по середине области: свободный режим должен открываться в любом
 * случае, иначе кнопка выглядит сломанной.
 *
 * @param {Object} params
 * @param {number} params.slope - наклон прямой
 * @param {number} params.intercept - свободный член
 * @param {number} params.x0 - левый край видимой области
 * @param {number} params.x1 - правый край видимой области
 * @param {number} [params.y0] - нижний край: нужен только когда прямой нет
 * @param {number} [params.y1] - верхний край: нужен только когда прямой нет
 * @returns {Array<{x: number, y: number}>} две точки в координатах данных
 */
export function anchorsOnLine({ slope, intercept, x0, x1, y0 = 0, y1 = 1 }) {
  const hasLine = isFinite(slope) && isFinite(intercept);
  const middle = (y0 + y1) / 2;

  return ANCHOR_SHARES.map((share) => {
    const x = x0 + (x1 - x0) * share;
    return { x, y: hasLine ? slope * x + intercept : middle };
  });
}

/**
 * Нужно ли заново подогнать видимую область под данные
 *
 * Масштаб и сдвиг геолог ставит руками, и правка замера не повод их терять:
 * он приблизил поздний участок записи, поправил опечатку в журнале — и окно
 * должно остаться там же. Поэтому решает не изменение чисел, а смена самой
 * системы координат: вид графика, фаза опыта, момент площадного среза,
 * выбранные размерности. Всё это экран сводит в один ключ.
 *
 * Первая подгонка происходит сама: ключ ещё ни разу не применяли, и он не
 * совпадает ни с чем.
 *
 * @param {Object} params
 * @param {string} params.key - чем задана нынешняя система координат
 * @param {string|null} params.appliedKey - под какой ключ область уже подогнана
 * @param {boolean} params.hasData - есть ли что показывать
 * @returns {boolean} верно, если область надо вернуть к исходной
 */
export function shouldRefitView({ key, appliedKey, hasData }) {
  // Подгонять не по чему: точек нет, а исходная область вырождена
  if (!hasData) return false;
  return key !== appliedKey;
}

/**
 * Что тащит начавшийся жест
 *
 * Значения отрицательные: неотрицательные заняты индексами свободных точек,
 * и одна переменная состояния различает все случаи.
 */
export const DRAG_TARGETS = {
  VIEW: -1,
  AXIS_X: -2,
  AXIS_Y: -3,
  /** Жест начался, но решение ещё не принято */
  UNDECIDED: -9,
};

/**
 * Решает, что захватил палец в начале жеста
 *
 * Порядок разбора: сначала свободные точки, потом полосы осей, потом полотно.
 * Точка важнее полосы — её можно утащить к самому краю, и там иначе нечем
 * было бы взять её обратно.
 *
 * Смещение захвата возвращается отдельно: без него точка дёргалась бы центром
 * под палец в момент касания.
 *
 * @param {Object} params
 * @param {number} params.startX - где палец коснулся полотна, px
 * @param {number} params.startY - где палец коснулся полотна, px
 * @param {number} params.ax0 - первая свободная точка, px
 * @param {number} params.ay0 - первая свободная точка, px
 * @param {number} params.ax1 - вторая свободная точка, px
 * @param {number} params.ay1 - вторая свободная точка, px
 * @param {boolean} params.freedom - включён ли свободный режим
 * @param {{x: number, y: number, h: number}} params.plot - область построения
 * @param {number} params.radius - радиус захвата точки, px
 * @returns {{target: number, grabDX: number, grabDY: number}} цель жеста,
 *   см. DRAG_TARGETS, и смещение точки от пальца
 */
export function pickDragTarget({
  startX,
  startY,
  ax0,
  ay0,
  ax1,
  ay1,
  freedom,
  plot,
  radius,
}) {
  'worklet';
  if (freedom) {
    const d0 = Math.hypot(startX - ax0, startY - ay0);
    const d1 = Math.hypot(startX - ax1, startY - ay1);
    const nearest = d0 <= d1 ? 0 : 1;
    const distance = Math.min(d0, d1);
    // NaN пролезает, пока точки ещё не поставлены: сравнение его отсеивает
    if (distance <= radius) {
      return {
        target: nearest,
        grabDX: (nearest === 0 ? ax0 : ax1) - startX,
        grabDY: (nearest === 0 ? ay0 : ay1) - startY,
      };
    }
  }

  if (startX < plot.x) {
    return { target: DRAG_TARGETS.AXIS_Y, grabDX: 0, grabDY: 0 };
  }
  if (startY > plot.y + plot.h) {
    return { target: DRAG_TARGETS.AXIS_X, grabDX: 0, grabDY: 0 };
  }
  return { target: DRAG_TARGETS.VIEW, grabDX: 0, grabDY: 0 };
}

/**
 * Отступ свободной точки от края области построения, px
 *
 * Не ноль: точка, севшая ровно на край, наполовину уходит под ось, и попасть
 * по ней пальцем становится нечем.
 */
export const ANCHOR_INSET = 10;

/**
 * Не даёт свободной точке уйти за полотно
 *
 * RNGH продолжает отдавать координаты жеста и за пределами View, поэтому
 * точку можно было утащить в область, которой на экране нет. Поймать её там
 * пальцем было нечем, а «Сброс» возвращает видимую область, но не точки, —
 * прямая пропадала насовсем.
 *
 * @param {Object} params
 * @param {number} params.px - куда утащил палец, px
 * @param {number} params.py - куда утащил палец, px
 * @param {{x: number, y: number, w: number, h: number}} params.plot - область построения
 * @param {number} [params.inset] - отступ от края, px
 * @returns {{px: number, py: number}} точка в пределах полотна
 */
export function clampAnchorToPlot({ px, py, plot, inset = ANCHOR_INSET }) {
  'worklet';
  // NaN пролезает, пока точки ещё не поставлены: без подмены он расползается
  // по всей сцене через обратный перевод в координаты данных
  const safeX = isFinite(px) ? px : plot.x + plot.w / 2;
  const safeY = isFinite(py) ? py : plot.y + plot.h / 2;

  // Отступ ужимается под узкое полотно: на планшете в портрете область
  // построения бывает уже двух отступов, и границы разошлись бы местами
  const padX = Math.min(inset, plot.w / 2);
  const padY = Math.min(inset, plot.h / 2);

  return {
    px: Math.min(plot.x + plot.w - padX, Math.max(plot.x + padX, safeX)),
    py: Math.min(plot.y + plot.h - padY, Math.max(plot.y + padY, safeY)),
  };
}

/**
 * Какая из двух свободных точек ближе к пальцу
 *
 * Нужна касанию в свободном режиме: тап переносит под палец ближайшую точку,
 * и это единственный способ вернуть прямую, если точки разъехались по краям.
 *
 * @param {Object} params
 * @param {number} params.px - касание, px
 * @param {number} params.py - касание, px
 * @param {number} params.ax0 - первая точка, px
 * @param {number} params.ay0 - первая точка, px
 * @param {number} params.ax1 - вторая точка, px
 * @param {number} params.ay1 - вторая точка, px
 * @returns {number} 0 или 1
 */
export function nearestAnchorIndex({ px, py, ax0, ay0, ax1, ay1 }) {
  'worklet';
  const d0 = Math.hypot(px - ax0, py - ay0);
  const d1 = Math.hypot(px - ax1, py - ay1);
  // Пока точки не поставлены, расстояние до них NaN: непоставленная точка не
  // должна выигрывать у поставленной только потому, что сравнение с NaN ложно
  if (!isFinite(d0)) return isFinite(d1) ? 1 : 0;
  if (!isFinite(d1)) return 0;
  return d0 <= d1 ? 0 : 1;
}

/**
 * Прямая через две свободные точки — с честным признаком «прямой нет»
 *
 * Точки, вставшие на одну вертикаль, прямой не задают. Раньше это выражалось
 * молчаливым NaN: путь прямой пропадал с полотна, а обработка переходила на
 * метод наименьших квадратов и показывала другое T. Признак `ready` даёт
 * экрану возможность сказать об этом вслух.
 *
 * @param {Array<{x: number, y: number}>} anchors - две свободные точки
 * @returns {{slope: number, intercept: number, ready: boolean}} прямая
 */
export function freeLine(anchors) {
  if (anchors?.length !== 2) {
    return { slope: NaN, intercept: NaN, ready: false };
  }
  const line = lineThroughPoints(anchors[0], anchors[1]);
  return {
    ...line,
    ready: isFinite(line.slope) && isFinite(line.intercept),
  };
}
