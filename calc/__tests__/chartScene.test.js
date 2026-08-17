/**
 * Проверка сцены графика
 *
 * Сцена — это всё, что зависит от видимой области: положения точек, ломаные,
 * деления осей и путь прямой. Раньше это был стопятидесятистрочный useMemo
 * внутри компонента, и проверить его можно было только глазами.
 */

import { buildScene, niceStep, formatTick, formatLogTick } from '../chartScene';
import { SERIES_ROLES } from '../chartSeries';
import { X_MODES } from '../cooperJacob';

const PLOT = { x: 46, y: 14, w: 280, h: 178 };
const VIEW = { x0: 0, x1: 4, y0: 0, y1: 25 };

const series = [
  {
    id: 'main',
    name: 'Откачка',
    color: '#2E86AB',
    role: SERIES_ROLES.FIT,
    points: [
      { x: 1, y: 5, index: 0 },
      { x: 2, y: 10, index: 1 },
      { x: 3, y: 15, index: 2 },
    ],
  },
];

const scene = (overrides = {}) =>
  buildScene({
    series,
    view: VIEW,
    base: VIEW,
    plot: PLOT,
    mode: X_MODES.LOG,
    fit: { slope: 5, intercept: 0 },
    anchors: null,
    ...overrides,
  });

describe('buildScene', () => {
  test('без серий сцена пустая, но не ломаная', () => {
    const empty = scene({ series: [] });
    expect(empty.hasData).toBe(false);
    expect(empty.shapes).toEqual([]);
    expect(empty.xTicks).toEqual([]);
  });

  test('серия без точек данных не делает', () => {
    const empty = scene({ series: [{ ...series[0], points: [] }] });
    expect(empty.hasData).toBe(false);
  });

  test('каждая серия даёт свою ломаную', () => {
    const built = scene();
    expect(built.shapes).toHaveLength(1);
    expect(built.shapes[0].path.startsWith('M')).toBe(true);
    expect(built.shapes[0].dots).toHaveLength(3);
  });

  test('ломаная не ведётся через точки разных серий', () => {
    // На комбинированном прослеживании из этого получилась бы пила
    const built = scene({
      series: [
        series[0],
        { ...series[0], id: 'second', points: [{ x: 1.5, y: 2, index: 0 }] },
      ],
    });
    expect(built.shapes).toHaveLength(2);
    // Одна точка ломаной не образует
    expect(built.shapes[1].path).toBe('');
  });

  test('точки ложатся в пределы области построения', () => {
    const built = scene();
    for (const dot of built.shapes[0].dots) {
      expect(dot.cx).toBeGreaterThanOrEqual(PLOT.x);
      expect(dot.cx).toBeLessThanOrEqual(PLOT.x + PLOT.w);
      expect(dot.cy).toBeGreaterThanOrEqual(PLOT.y);
      expect(dot.cy).toBeLessThanOrEqual(PLOT.y + PLOT.h);
    }
  });

  test('точка помнит номер строки журнала', () => {
    expect(scene().shapes[0].dots.map((d) => d.index)).toEqual([0, 1, 2]);
  });

  test('роль серии доезжает до отрисовки', () => {
    expect(scene().shapes[0].role).toBe(SERIES_ROLES.FIT);
  });

  test('прямая проводится через всю ширину полотна', () => {
    const built = scene();
    expect(built.fitPath).toMatch(/^M[\d.-]+,[\d.-]+ L[\d.-]+,[\d.-]+$/);
  });

  test('без прямой путь пустой, а сцена цела', () => {
    const built = scene({ fit: { slope: NaN, intercept: NaN } });
    expect(built.fitPath).toBe('');
    expect(built.hasData).toBe(true);
  });

  test('вырожденная область не роняет сцену в пустое состояние', () => {
    // Щипок двумя пальцами на мгновение даёт нулевой размах: раньше в этот
    // кадр график показывал «внесите замеры» прямо во время масштабирования
    const built = scene({ view: { x0: 2, x1: 2, y0: 0, y1: 0 } });
    expect(built.hasData).toBe(true);
    expect(built.shapes[0].dots).toHaveLength(3);
  });

  test('деления не выходят за область построения', () => {
    const built = scene();
    for (const tick of built.xTicks) {
      expect(tick.x).toBeGreaterThanOrEqual(PLOT.x - 1);
      expect(tick.x).toBeLessThanOrEqual(PLOT.x + PLOT.w + 1);
    }
    for (const tick of built.yTicks) {
      expect(tick.y).toBeGreaterThanOrEqual(PLOT.y - 1);
      expect(tick.y).toBeLessThanOrEqual(PLOT.y + PLOT.h + 1);
    }
  });

  test('на логарифмической оси подписаны степени десяти', () => {
    const labels = scene().xTicks.map((t) => t.label).filter(Boolean);
    expect(labels).toContain('10');
    expect(labels).toContain('100');
  });

  test('на линейной оси деления идут красивым шагом', () => {
    const built = scene({ mode: X_MODES.LINEAR });
    const labels = built.xTicks.map((t) => t.label);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.every((label) => label != null)).toBe(true);
  });

  test('свободные точки переводятся в пиксели', () => {
    const built = scene({ anchors: [{ x: 1, y: 5 }, { x: 3, y: 15 }] });
    expect(built.anchorDots).toHaveLength(2);
    expect(built.anchorDots[0].cx).toBeCloseTo(built.shapes[0].dots[0].cx, 6);
  });

  test('без свободных точек их список пуст', () => {
    expect(scene().anchorDots).toEqual([]);
  });
});

describe('niceStep', () => {
  test('шаг кратен 1, 2, 5 или 10 на степень десяти', () => {
    for (const range of [1, 3, 7, 45, 900, 0.03]) {
      const step = niceStep(range);
      const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 5, 10]).toContain(Math.round(step / magnitude));
    }
  });

  test('вырожденный размах не даёт нулевого шага', () => {
    expect(niceStep(0)).toBeGreaterThan(0);
    expect(niceStep(NaN)).toBeGreaterThan(0);
  });
});

describe('подписи делений', () => {
  test('крайности уходят в степенную запись', () => {
    expect(formatTick(0.0000001)).toContain('e');
    expect(formatTick(1e7)).toContain('e');
  });

  test('нуль остаётся нулём', () => {
    expect(formatTick(0)).toBe('0');
  });

  test('логарифмическая ось не тащит хвосты', () => {
    expect(formatLogTick(20.000000000000004)).toBe('20');
    expect(formatLogTick(100)).toBe('100');
  });
});
