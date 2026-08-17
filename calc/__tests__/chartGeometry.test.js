/**
 * Проверка геометрии графика
 *
 * Здесь проверяется то, что пользователь ощущает руками: остаётся ли точка
 * под пальцами на месте при щипке, не уезжают ли оси, попадает ли тап
 * по нужному замеру.
 */

import {
  valueToPixelX,
  valueToPixelY,
  zoomView,
  panView,
  findNearestPoint,
  toggleSelection,
  groupPoints,
  logTicks,
  pixelToValue,
  anchorsOnLine,
  pickDragTarget,
  DRAG_TARGETS,
  shouldRefitView,
  clampAnchorToPlot,
  nearestAnchorIndex,
  freeLine,
} from '../chartGeometry';

const PLOT = { x: 46, y: 14, w: 280, h: 178 };
const VIEW = { x0: 0, x1: 4, y0: 0, y1: 25 };
const BASE_RANGE = { x: 4, y: 25 };

describe('перевод в пиксели', () => {
  test('края области ложатся на границы графика', () => {
    expect(valueToPixelX(VIEW.x0, VIEW, PLOT)).toBeCloseTo(PLOT.x, 10);
    expect(valueToPixelX(VIEW.x1, VIEW, PLOT)).toBeCloseTo(PLOT.x + PLOT.w, 10);
    // Начало отсчёта — в левом нижнем углу: понижение откладывается вверх
    expect(valueToPixelY(VIEW.y0, VIEW, PLOT)).toBeCloseTo(PLOT.y + PLOT.h, 10);
    expect(valueToPixelY(VIEW.y1, VIEW, PLOT)).toBeCloseTo(PLOT.y, 10);
  });

  test('понижение растёт вверх по экрану', () => {
    const shallow = valueToPixelY(5, VIEW, PLOT);
    const deep = valueToPixelY(20, VIEW, PLOT);
    expect(deep).toBeLessThan(shallow);
  });

  test('вырожденная область не даёт NaN', () => {
    const flat = { x0: 1, x1: 1, y0: 0, y1: 0 };
    expect(Number.isNaN(valueToPixelX(1, flat, PLOT))).toBe(false);
    expect(Number.isNaN(valueToPixelY(0, flat, PLOT))).toBe(false);
  });
});

describe('zoomView', () => {
  test('значение под фокусом остаётся на том же месте экрана', () => {
    const focusX = 0.3;
    // Фокус по Y считается от верха полотна, как приходит от жеста, а
    // понижение растёт вверх — отсюда дополнение до единицы
    const focusY = 0.7;
    const anchorX = VIEW.x0 + focusX * (VIEW.x1 - VIEW.x0);
    const anchorY = VIEW.y0 + (1 - focusY) * (VIEW.y1 - VIEW.y0);

    const pixelBeforeX = valueToPixelX(anchorX, VIEW, PLOT);
    const pixelBeforeY = valueToPixelY(anchorY, VIEW, PLOT);

    const zoomed = zoomView({
      view: VIEW,
      scale: 2.5,
      focusX,
      focusY,
      baseRange: BASE_RANGE,
      minZoom: 0.5,
      maxZoom: 50,
    });

    expect(valueToPixelX(anchorX, zoomed, PLOT)).toBeCloseTo(pixelBeforeX, 8);
    expect(valueToPixelY(anchorY, zoomed, PLOT)).toBeCloseTo(pixelBeforeY, 8);
  });

  test('приближение сужает диапазон, отдаление расширяет', () => {
    const inZoom = zoomView({
      view: VIEW, scale: 2, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });
    const outZoom = zoomView({
      view: VIEW, scale: 0.5, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });

    expect(inZoom.x1 - inZoom.x0).toBeCloseTo(2, 10);
    expect(outZoom.x1 - outZoom.x0).toBeCloseTo(8, 10);
  });

  test('масштаб не выходит за пределы', () => {
    let view = VIEW;
    // Многократное приближение упирается в предел, а не уходит в бесконечность
    for (let i = 0; i < 40; i++) {
      view = zoomView({
        view, scale: 2, focusX: 0.5, focusY: 0.5,
        baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
      });
    }
    expect(view.x1 - view.x0).toBeCloseTo(BASE_RANGE.x / 50, 10);

    for (let i = 0; i < 40; i++) {
      view = zoomView({
        view, scale: 0.5, focusX: 0.5, focusY: 0.5,
        baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
      });
    }
    expect(view.x1 - view.x0).toBeCloseTo(BASE_RANGE.x / 0.5, 10);
  });

  test('равный масштаб по осям меняет их одинаково', () => {
    const zoomed = zoomView({
      view: VIEW, scale: 3, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });

    const ratioX = (zoomed.x1 - zoomed.x0) / (VIEW.x1 - VIEW.x0);
    const ratioY = (zoomed.y1 - zoomed.y0) / (VIEW.y1 - VIEW.y0);
    expect(ratioX).toBeCloseTo(ratioY, 10);
  });

  test('оси масштабируются по отдельности', () => {
    // Растянуть время, не трогая понижение: на графике это разглядывание
    // позднего участка записи без потери размаха по вертикали
    const zoomed = zoomView({
      view: VIEW, scaleX: 4, scaleY: 1, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });

    expect(zoomed.x1 - zoomed.x0).toBeCloseTo((VIEW.x1 - VIEW.x0) / 4, 10);
    expect(zoomed.y1 - zoomed.y0).toBeCloseTo(VIEW.y1 - VIEW.y0, 10);
  });

  test('предел масштаба считается по каждой оси свой', () => {
    let view = VIEW;
    for (let i = 0; i < 40; i++) {
      view = zoomView({
        view, scaleX: 2, scaleY: 1, focusX: 0.5, focusY: 0.5,
        baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
      });
    }
    expect(view.x1 - view.x0).toBeCloseTo(BASE_RANGE.x / 50, 10);
    expect(view.y1 - view.y0).toBeCloseTo(BASE_RANGE.y, 10);
  });

  test('некорректный масштаб не ломает область', () => {
    expect(zoomView({
      view: VIEW, scale: 0, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    })).toEqual(VIEW);

    expect(zoomView({
      view: VIEW, scale: NaN, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    })).toEqual(VIEW);
  });
});

describe('panView', () => {
  test('сдвиг вправо показывает более ранние значения', () => {
    const moved = panView({ view: VIEW, dx: 28, dy: 0, plot: PLOT });
    // Палец вправо — содержимое едет вправо, окно смещается влево
    expect(moved.x0).toBeLessThan(VIEW.x0);
    expect(moved.x1 - moved.x0).toBeCloseTo(VIEW.x1 - VIEW.x0, 10);
  });

  test('сдвиг вниз показывает меньшие понижения', () => {
    // Содержимое едет за пальцем: палец вниз — точки вниз по экрану, а
    // поскольку понижение отложено вверх, окно уезжает к большим значениям
    const moved = panView({ view: VIEW, dx: 0, dy: 30, plot: PLOT });
    expect(moved.y0).toBeGreaterThan(VIEW.y0);
  });

  test('масштаб окна при сдвиге не меняется', () => {
    const moved = panView({ view: VIEW, dx: 15, dy: -20, plot: PLOT });
    expect(moved.x1 - moved.x0).toBeCloseTo(VIEW.x1 - VIEW.x0, 10);
    expect(moved.y1 - moved.y0).toBeCloseTo(VIEW.y1 - VIEW.y0, 10);
  });

  test('сдвиг на всю ширину смещает окно ровно на диапазон', () => {
    const moved = panView({ view: VIEW, dx: -PLOT.w, dy: 0, plot: PLOT });
    expect(moved.x0).toBeCloseTo(VIEW.x0 + (VIEW.x1 - VIEW.x0), 10);
  });
});

describe('findNearestPoint', () => {
  const points = [
    { index: 0, x: 0, y: 10 },
    { index: 1, x: 2, y: 15 },
    { index: 2, x: 4, y: 25 },
  ];

  test('находит точку под пальцем', () => {
    const target = points[1];
    const px = valueToPixelX(target.x, VIEW, PLOT);
    const py = valueToPixelY(target.y, VIEW, PLOT);

    const found = findNearestPoint({ points, touchX: px + 4, touchY: py - 3, view: VIEW, plot: PLOT, radius: 26 });
    expect(found.index).toBe(1);
  });

  test('промах мимо всех точек ничего не выбирает', () => {
    const found = findNearestPoint({ points, touchX: 200, touchY: 20, view: VIEW, plot: PLOT, radius: 10 });
    expect(found).toBeNull();
  });

  test('после приближения попадание считается в новых координатах', () => {
    const zoomed = zoomView({
      view: VIEW, scale: 4, focusX: 0.5, focusY: 0.5,
      baseRange: BASE_RANGE, minZoom: 0.5, maxZoom: 50,
    });
    const target = points[1];
    const px = valueToPixelX(target.x, zoomed, PLOT);
    const py = valueToPixelY(target.y, zoomed, PLOT);

    const found = findNearestPoint({ points, touchX: px, touchY: py, view: zoomed, plot: PLOT, radius: 26 });
    expect(found.index).toBe(1);
  });
});

describe('toggleSelection', () => {
  test('копит до двух точек', () => {
    expect(toggleSelection([], 0)).toEqual([0]);
    expect(toggleSelection([0], 2)).toEqual([0, 2]);
  });

  test('повторный тап снимает выбор', () => {
    expect(toggleSelection([0, 2], 0)).toEqual([2]);
  });

  test('третья точка заменяет самую старую', () => {
    expect(toggleSelection([0, 2], 3)).toEqual([2, 3]);
  });
});

describe('groupPoints', () => {
  const PALETTE = ['красный', 'синий', 'зелёный'];

  test('без признака группы серий нет', () => {
    const grouped = groupPoints([{ x: 1, y: 1 }, { x: 2, y: 2 }], PALETTE);
    expect(grouped).toEqual([]);
  });

  test('серии идут в порядке первого появления', () => {
    const points = [
      { group: 'w2', groupName: 'Н-2' },
      { group: 'w1', groupName: 'Н-1' },
      { group: 'w2', groupName: 'Н-2' },
    ];
    const grouped = groupPoints(points, PALETTE);

    expect(grouped.map((series) => series.name)).toEqual(['Н-2', 'Н-1']);
    expect(grouped.map((series) => series.color)).toEqual(['красный', 'синий']);
  });

  test('точки серии помнят своё место в исходном ряду', () => {
    const points = [
      { group: 'w2' },
      { group: 'w1' },
      { group: 'w2' },
      { group: 'w1' },
    ];
    const grouped = groupPoints(points, PALETTE);

    expect(grouped[0].indices).toEqual([0, 2]);
    expect(grouped[1].indices).toEqual([1, 3]);
  });

  test('цвета идут по кругу, когда скважин больше, чем цветов', () => {
    const points = ['a', 'b', 'c', 'd'].map((group) => ({ group }));
    const grouped = groupPoints(points, PALETTE);

    expect(grouped[3].color).toBe(PALETTE[0]);
  });

  test('точки без группы собираются в свою серию', () => {
    // Смешанный случай не должен молча терять точки: на графике они
    // остаются, просто без имени в легенде
    const points = [{ group: 'w1' }, {}, { group: 'w1' }];
    const grouped = groupPoints(points, PALETTE);

    expect(grouped).toHaveLength(2);
    expect(grouped[1].indices).toEqual([1]);
    expect(grouped[1].name).toBeUndefined();
  });
});

describe('logTicks', () => {
  /** Логарифмы подписанных делений */
  const labelled = (ticks) => ticks.filter((t) => t.labelled).map((t) => t.log);
  /** Логарифмы мелкой сетки */
  const minor = (ticks) => ticks.filter((t) => !t.labelled).map((t) => t.log);

  test('подписи стоят на декадах', () => {
    const ticks = logTicks({ from: 0, to: 2 });
    expect(labelled(ticks)).toEqual([0, 1, 2]);
    expect(ticks.filter((t) => t.labelled).map((t) => t.value)).toEqual([1, 10, 100]);
  });

  test('внутри декады идёт мелкая сетка от 2 до 9', () => {
    const ticks = logTicks({ from: 0, to: 1 });
    const inside = minor(ticks).filter((log) => log > 0 && log < 1);
    expect(inside).toHaveLength(8);
    expect(inside[0]).toBeCloseTo(Math.log10(2), 10);
    expect(inside[7]).toBeCloseTo(Math.log10(9), 10);
  });

  test('деления не выходят за границы области', () => {
    const ticks = logTicks({ from: 0.5, to: 1.7 });
    for (const tick of ticks) {
      expect(tick.log).toBeGreaterThanOrEqual(0.5);
      expect(tick.log).toBeLessThanOrEqual(1.7);
    }
  });

  test('на широком диапазоне подписи идут через декаду, а мелкая сетка пропадает', () => {
    // Восемь декад: подписать каждую — подписи налезут друг на друга,
    // а мелкая сетка превратится в сплошную заливку. Линии по декадам при
    // этом остаются, часть из них без подписи
    const ticks = logTicks({ from: 0, to: 8, maxLabels: 5 });
    expect(labelled(ticks).length).toBeLessThanOrEqual(5);
    expect(ticks.every((tick) => Number.isInteger(tick.log))).toBe(true);
  });

  test('меньше декады — подписываются промежуточные деления', () => {
    // Между 20 и 60 ни одной целой степени десяти нет, и без промежуточных
    // подписей ось осталась бы вовсе без чисел
    const ticks = logTicks({ from: Math.log10(20), to: Math.log10(60) });
    expect(labelled(ticks).length).toBeGreaterThanOrEqual(2);
    const values = ticks.filter((t) => t.labelled).map((t) => Math.round(t.value));
    expect(values).toContain(30);
  });

  test('промежуточные подписи идут по кратностям 1-2-5, а не подряд', () => {
    // Полторы декады: подписать всё подряд не выйдет по ширине, и числа
    // должны остаться теми, что стоят на логарифмической бумаге
    const ticks = logTicks({ from: Math.log10(18), to: Math.log10(700), maxLabels: 5 });
    const values = ticks.filter((t) => t.labelled).map((t) => Math.round(t.value));
    expect(values).toEqual([20, 50, 100, 200, 500]);
  });

  test('вырожденный диапазон не роняет расчёт', () => {
    expect(logTicks({ from: 2, to: 2 })).toEqual([]);
    expect(logTicks({ from: NaN, to: 1 })).toEqual([]);
  });
});

describe('pixelToValue', () => {
  test('возвращает то же значение, что и прямой перевод', () => {
    // Обратный перевод нужен свободным точкам: палец приходит в пикселях,
    // а прямая через них строится в координатах данных
    const value = { x: 2.5, y: 18 };
    const px = valueToPixelX(value.x, VIEW, PLOT);
    const py = valueToPixelY(value.y, VIEW, PLOT);

    const back = pixelToValue({ px, py, view: VIEW, plot: PLOT });
    expect(back.x).toBeCloseTo(value.x, 10);
    expect(back.y).toBeCloseTo(value.y, 10);
  });

  test('нижний левый угол полотна — начало координат области', () => {
    const back = pixelToValue({
      px: PLOT.x,
      py: PLOT.y + PLOT.h,
      view: VIEW,
      plot: PLOT,
    });
    expect(back.x).toBeCloseTo(VIEW.x0, 10);
    expect(back.y).toBeCloseTo(VIEW.y0, 10);
  });

  test('вырожденная область не даёт NaN', () => {
    const flat = { x0: 1, x1: 1, y0: 0, y1: 0 };
    const back = pixelToValue({ px: 100, py: 100, view: flat, plot: PLOT });
    expect(Number.isNaN(back.x)).toBe(false);
    expect(Number.isNaN(back.y)).toBe(false);
  });
});

describe('anchorsOnLine', () => {
  test('обе точки лежат на прямой', () => {
    // При переходе в свободный режим точки должны встать на уже построенную
    // прямую, иначе она прыгнет на другую при первом же переключении
    const line = { slope: 0.4, intercept: -0.2 };
    const [first, second] = anchorsOnLine({ ...line, x0: 1, x1: 3 });

    expect(first.y).toBeCloseTo(line.slope * first.x + line.intercept, 10);
    expect(second.y).toBeCloseTo(line.slope * second.x + line.intercept, 10);
  });

  test('точки стоят внутри видимой области и не совпадают', () => {
    const [first, second] = anchorsOnLine({ slope: 1, intercept: 0, x0: 1, x1: 3 });

    expect(first.x).toBeGreaterThan(1);
    expect(second.x).toBeLessThan(3);
    expect(second.x).toBeGreaterThan(first.x);
  });

  test('без прямой точки всё равно ставятся — по середине области', () => {
    // Прямой ещё нет: замеров мало или дебит не введён. Свободный режим
    // должен открываться и в этом случае, иначе кнопка выглядит сломанной
    const [first, second] = anchorsOnLine({
      slope: NaN, intercept: NaN, x0: 1, x1: 3, y0: 0, y1: 10,
    });

    expect(isFinite(first.y)).toBe(true);
    expect(isFinite(second.y)).toBe(true);
    expect(second.x).toBeGreaterThan(first.x);
  });
});

describe('pickDragTarget', () => {
  /** Свободные точки в пикселях: одна в глубине поля, вторая у правого края */
  const ANCHORS = { ax0: 120, ay0: 100, ax1: 300, ay1: 60 };
  const base = { ...ANCHORS, plot: PLOT, radius: 30, freedom: true };

  test('палец на первой точке захватывает её', () => {
    const picked = pickDragTarget({ ...base, startX: 124, startY: 104 });
    expect(picked.target).toBe(0);
  });

  test('палец на второй точке захватывает её', () => {
    const picked = pickDragTarget({ ...base, startX: 296, startY: 62 });
    expect(picked.target).toBe(1);
  });

  test('точка не прыгает под палец: смещение захвата сохраняется', () => {
    // Взялись на 10 px правее и на 6 px ниже центра — точка должна поехать,
    // сохраняя этот сдвиг, иначе она дёрнется под палец в момент захвата
    const picked = pickDragTarget({ ...base, startX: 130, startY: 106 });
    expect(picked.grabDX).toBeCloseTo(-10, 10);
    expect(picked.grabDY).toBeCloseTo(-6, 10);
  });

  test('мимо точек — жест двигает область', () => {
    const picked = pickDragTarget({ ...base, startX: 210, startY: 90 });
    expect(picked.target).toBe(DRAG_TARGETS.VIEW);
  });

  test('вне свободного режима точки не ловятся', () => {
    const picked = pickDragTarget({ ...base, freedom: false, startX: 124, startY: 104 });
    expect(picked.target).toBe(DRAG_TARGETS.VIEW);
  });

  test('полоса слева растягивает ординату', () => {
    const picked = pickDragTarget({ ...base, startX: PLOT.x - 10, startY: 100 });
    expect(picked.target).toBe(DRAG_TARGETS.AXIS_Y);
  });

  test('полоса снизу растягивает абсциссу', () => {
    const picked = pickDragTarget({ ...base, startX: 200, startY: PLOT.y + PLOT.h + 10 });
    expect(picked.target).toBe(DRAG_TARGETS.AXIS_X);
  });

  test('точка на полосе оси всё равно захватывается первой', () => {
    // Свободную точку можно утащить к самому краю; там она важнее полосы,
    // иначе вернуть её обратно было бы нечем
    const picked = pickDragTarget({
      ...base, ax0: PLOT.x - 5, ay0: 100, startX: PLOT.x - 6, startY: 101,
    });
    expect(picked.target).toBe(0);
  });

  test('без поставленных точек свободный режим двигает область', () => {
    const picked = pickDragTarget({
      ...base, ax0: NaN, ay0: NaN, ax1: NaN, ay1: NaN, startX: 200, startY: 90,
    });
    expect(picked.target).toBe(DRAG_TARGETS.VIEW);
  });
});

describe('shouldRefitView', () => {
  test('первый показ с данными — подогнать область', () => {
    expect(shouldRefitView({ key: 'lg|1', appliedKey: null, hasData: true })).toBe(true);
  });

  test('те же оси, другие числа — область не трогать', () => {
    // Правка замера в журнале не повод терять масштаб: геолог поставил его
    // руками и разглядывает поздний участок записи
    expect(shouldRefitView({ key: 'lg|1', appliedKey: 'lg|1', hasData: true })).toBe(false);
  });

  test('сменился вид графика — подогнать заново', () => {
    // У площадного прослеживания по оси отложено расстояние, а не время:
    // прежнее окно показывало бы пустое поле
    expect(shouldRefitView({ key: 'lgR|1', appliedKey: 'lg|1', hasData: true })).toBe(true);
  });

  test('данных ещё нет — подгонять не по чему', () => {
    expect(shouldRefitView({ key: 'lg|1', appliedKey: null, hasData: false })).toBe(false);
  });
});

describe('clampAnchorToPlot', () => {
  const PLOT_A = { x: 46, y: 14, w: 280, h: 178 };

  test('точка внутри полотна не двигается', () => {
    expect(clampAnchorToPlot({ px: 100, py: 100, plot: PLOT_A })).toEqual({
      px: 100,
      py: 100,
    });
  });

  test('точку, утащенную за левый край, возвращает на полотно', () => {
    // Координаты жеста продолжают приходить и за пределами View: без зажима
    // свободная точка уезжает туда, где её больше нечем поймать пальцем
    const fixed = clampAnchorToPlot({ px: -500, py: 100, plot: PLOT_A });
    expect(fixed.px).toBeGreaterThanOrEqual(PLOT_A.x);
    expect(fixed.px).toBeLessThanOrEqual(PLOT_A.x + PLOT_A.w);
  });

  test('точку, утащенную вниз и вправо, возвращает на полотно', () => {
    const fixed = clampAnchorToPlot({ px: 9999, py: 9999, plot: PLOT_A });
    expect(fixed.px).toBeLessThanOrEqual(PLOT_A.x + PLOT_A.w);
    expect(fixed.py).toBeLessThanOrEqual(PLOT_A.y + PLOT_A.h);
  });

  test('точка остаётся в пределах досягаемости пальца от края', () => {
    const fixed = clampAnchorToPlot({ px: -500, py: -500, plot: PLOT_A });
    expect(fixed.px).toBeGreaterThanOrEqual(PLOT_A.x);
    expect(fixed.py).toBeGreaterThanOrEqual(PLOT_A.y);
  });

  test('NaN не пролезает наружу', () => {
    const fixed = clampAnchorToPlot({ px: NaN, py: NaN, plot: PLOT_A });
    expect(Number.isNaN(fixed.px)).toBe(false);
    expect(Number.isNaN(fixed.py)).toBe(false);
  });

  test('узкое полотно не разводит границы местами', () => {
    // На узком экране область построения бывает уже двух отступов
    const narrow = { x: 0, y: 0, w: 8, h: 8 };
    const fixed = clampAnchorToPlot({ px: 100, py: -100, plot: narrow });
    expect(fixed.px).toBeGreaterThanOrEqual(narrow.x);
    expect(fixed.px).toBeLessThanOrEqual(narrow.x + narrow.w);
    expect(fixed.py).toBeGreaterThanOrEqual(narrow.y);
    expect(fixed.py).toBeLessThanOrEqual(narrow.y + narrow.h);
  });
});

describe('nearestAnchorIndex', () => {
  test('выбирает ту точку, что ближе к пальцу', () => {
    const anchors = { ax0: 100, ay0: 100, ax1: 300, ay1: 100 };
    expect(nearestAnchorIndex({ px: 120, py: 100, ...anchors })).toBe(0);
    expect(nearestAnchorIndex({ px: 280, py: 100, ...anchors })).toBe(1);
  });

  test('непоставленная точка не выигрывает у поставленной', () => {
    const index = nearestAnchorIndex({
      px: 120, py: 100, ax0: NaN, ay0: NaN, ax1: 300, ay1: 100,
    });
    expect(index).toBe(1);
  });
});

describe('freeLine', () => {
  test('две точки дают прямую', () => {
    const line = freeLine([{ x: 0, y: 0 }, { x: 2, y: 4 }]);
    expect(line.ready).toBe(true);
    expect(line.slope).toBeCloseTo(2, 10);
  });

  test('точки на одной вертикали прямой не дают', () => {
    // Здесь прямая пропадала с полотна, а расчёт молча уезжал на МНК:
    // число T в карточке менялось, и понять почему было неоткуда
    const line = freeLine([{ x: 1, y: 0 }, { x: 1, y: 4 }]);
    expect(line.ready).toBe(false);
  });

  test('без пары точек прямой нет', () => {
    expect(freeLine(null).ready).toBe(false);
    expect(freeLine([{ x: 0, y: 0 }]).ready).toBe(false);
  });
});
