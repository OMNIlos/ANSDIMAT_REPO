/**
 * Проверка отрисовки графика
 *
 * Жесты отсюда не проверить — RNGH под react-test-renderer событий не
 * порождает. Зато проверяется всё остальное: что нарисовано, сколько кривых
 * на полотне и не прячет ли пустое состояние управление.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import DrawdownChart, { FIT_MODES } from '../DrawdownChart';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

// Локаль в тестах определяется системой и приезжает английской: пробный
// прогон показал, что I18n.t('reset') отдаёт «Reset», а не «Сброс».
// Проверять подписи, не закрепив локаль, значит проверять окружение
beforeAll(() => {
  I18n.locale = 'ru';
});

const render = (props) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <DrawdownChart width={340} {...props} />
      </PaperProvider>
    );
  });
  return JSON.stringify(tree.toJSON());
};

const pumping = [
  { t: 1, s: 1 },
  { t: 10, s: 2 },
  { t: 100, s: 3 },
];

const count = (json, node) => (json.match(new RegExp(`"${node}"`, 'g')) ?? []).length;

test('замеры превращаются в точки на полотне', () => {
  const json = render({ measurements: pumping });
  expect(count(json, 'RNSVGCircle')).toBe(3);
});

test('пустое полотно не прячет управление масштабом', () => {
  // Ровно этим одиночная откачка выглядела полностью неуправляемой: при
  // пустом ряде не отрисовывалось ни одной кнопки
  const json = render({ measurements: [] });
  expect(json).toContain('Сброс');
  // Подписи берутся из ru-локали, а не из defaultValue: ключи уже переведены
  expect(json).toContain('Уменьшить');
  expect(json).toContain('Увеличить');
});

test('пустое полотно не прячет выбор способа прямой', () => {
  const json = render({ measurements: [], fitMode: FIT_MODES.AUTO });
  expect(json).toContain('Свободная прямая');
});

test('без заданного способа прямой переключателей нет', () => {
  // График, по которому прямую не ведут вовсе — петля «расход — давление» у
  // нагнетания, — не должен предлагать выбор между способами её построения
  const json = render({ measurements: pumping });
  expect(json).not.toContain('Свободная прямая');
  expect(json).not.toContain('По всем точкам');
  // Масштаб при этом остаётся управляемым
  expect(json).toContain('Сброс');
});

test('пустое полотно объясняет, чего не хватает', () => {
  const json = render({
    measurements: [],
    emptyTitle: 'Нужны расстояния',
    emptyHint: 'Введите расстояния до скважин',
  });
  expect(json).toContain('Нужны расстояния');
});

test('соседняя скважина рисуется своей кривой', () => {
  const json = render({
    measurements: pumping,
    extraSeries: [
      { id: 'w2', name: '2p', measurements: [{ t: 1, s: 5 }, { t: 10, s: 6 }] },
    ],
  });
  // Три замера основной кривой плюс два соседней
  expect(count(json, 'RNSVGCircle')).toBe(5);
});

test('свободный режим рисует свободные точки', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [
      { x: 0.5, y: 1 },
      { x: 2, y: 3 },
    ],
  });
  // Три замера плюс по два кружка на свободную точку
  expect(count(json, 'RNSVGCircle')).toBe(7);
});

test('в свободном режиме есть чем вернуть прямую', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [
      { x: 0.5, y: 1 },
      { x: 2, y: 3 },
    ],
  });
  expect(json).toContain('Прямую заново');
});

test('вырожденная свободная прямая не рисуется, но объясняется', () => {
  const json = render({
    measurements: pumping,
    fitMode: FIT_MODES.FREEDOM,
    anchors: [
      { x: 1, y: 1 },
      { x: 1, y: 3 },
    ],
  });
  expect(json).toContain('вертикал');
});

test('отмеченный замер выделяется на полотне', () => {
  const plain = render({ measurements: pumping });
  const marked = render({ measurements: pumping, selected: [1] });
  // Отмеченная точка крупнее: радиус в дереве отличается
  expect(marked).not.toBe(plain);
  expect(marked).toContain('"r":5.5');
});

test('в развёрнутом виде управление лежит поверх полотна', () => {
  const json = render({ measurements: pumping, fullscreen: true, height: 700, onToggleFullscreen: () => {} });
  expect(json).toContain('"position":"absolute"');
});

test('в развёрнутом виде плоскость занимает почти весь экран', () => {
  // Резервируется только строка управления сверху и место под подписи оси
  // снизу: меню приложения скрыто, переключатели прямой не показываются
  const height = 700;
  const json = render({
    measurements: pumping,
    fullscreen: true,
    height,
    onToggleFullscreen: () => {},
  });
  // Вертикальные линии сетки идут от верха области построения до низа,
  // поэтому по ним и видны её настоящие границы
  const tops = [...json.matchAll(/"y1":([\d.]+)/g)].map((m) => Number(m[1]));
  const bottoms = [...json.matchAll(/"y2":([\d.]+)/g)].map((m) => Number(m[1]));
  expect(Math.max(...bottoms)).toBeGreaterThan(height * 0.9);
  expect(Math.min(...tops)).toBeLessThan(height * 0.15);
});

test('в развёрнутом виде выбор способа прямой не показывается', () => {
  // Там работают с уже выбранной прямой, а не переключают режимы
  const json = render({
    measurements: pumping,
    fullscreen: true,
    height: 700,
    onToggleFullscreen: () => {},
  });
  expect(json).not.toContain('Свободная прямая');
  expect(json).not.toContain('По всем точкам');
});

test('в развёрнутом виде управление идёт одной строкой сверху', () => {
  const json = render({
    measurements: pumping,
    fullscreen: true,
    height: 700,
    onToggleFullscreen: () => {},
  });
  // Все кнопки лежат в одной строке: столбик закрывал правую треть полотна
  expect(json).toContain('"flexDirection":"row"');
  expect(json).toContain('Свернуть график');
  expect(json).toContain('Сброс');
});

test('кривая сравнения рисуется пунктиром', () => {
  // Цвета мало, когда рядом две тонкие кривые: пунктир отличает их и на
  // чёрно-белой распечатке
  const json = render({
    series: [
      { id: 'pumping', name: 'Откачка', role: 'fit', measurements: pumping },
      { id: 'recovery', name: 'Восстановление', role: 'reference', measurements: [{ t: 1, s: 3 }, { t: 10, s: 1 }] },
    ],
  });
  expect(json).toContain('"6"');
});

test('серии восстановления рисуются вместе с откачкой', () => {
  const json = render({
    series: [
      { id: 'pumping', name: 'Откачка', role: 'fit', measurements: pumping },
      {
        id: 'recovery',
        name: 'Восстановление',
        role: 'reference',
        measurements: [
          { t: 1, s: 3 },
          { t: 10, s: 1.5 },
          { t: 100, s: 0.2 },
        ],
      },
    ],
  });
  expect(count(json, 'RNSVGCircle')).toBe(6);
});

/**
 * Выбор кривой, по которой ведётся прямая
 *
 * У куста на плоскости s — lg t лежит несколько кривых: открытая скважина и
 * соседние. Прямая идёт по открытой, но на полотне это было видно только по
 * пунктиру у соседних — понять, чью прямую сейчас двигаешь, было нельзя. А
 * разница существенная: в пьезопроводность входит расстояние r, своё у
 * каждой скважины.
 */
describe('выбор кривой', () => {
  const twoWells = [
    { id: 'w1', name: '1p', role: 'fit', measurements: pumping },
    {
      id: 'w2',
      name: '2p',
      role: 'reference',
      measurements: [
        { t: 1, s: 0.5 },
        { t: 10, s: 1 },
      ],
    },
  ];

  /** Дерево целиком: нажатия проверяются по обработчикам, а не по разметке */
  const mount = (props) => {
    let tree;
    act(() => {
      tree = renderer.create(
        <PaperProvider theme={lightTheme}>
          <DrawdownChart width={340} {...props} />
        </PaperProvider>
      );
    });
    return tree;
  };

  /** Весь текст внутри узла */
  const textOf = (node) => {
    if (typeof node === 'string') return node;
    if (!node || typeof node !== 'object') return '';
    return (node.children ?? []).map(textOf).join(' ');
  };

  /**
   * Элементы легенды по одному на кривую
   *
   * Обход отдаёт один и тот же TouchableOpacity несколько раз — пропсы стоят
   * и на составном компоненте, и на обёртках под ним. Считаем по подписи:
   * имена кривых на полотне и так не повторяются
   */
  const legendItems = (tree) => {
    const seen = new Map();
    for (const node of tree.root.findAll(
      (one) =>
        typeof one.props?.onPress === 'function' &&
        one.props?.accessibilityRole === 'radio',
      { deep: true }
    )) {
      const label = textOf(node);
      if (!seen.has(label)) seen.set(label, node);
    }
    return [...seen.values()];
  };

  test('кривая в легенде выбирается касанием', () => {
    const onSelectSeries = jest.fn();
    const tree = mount({ series: twoWells, onSelectSeries });

    const soutside = legendItems(tree).find((node) =>
      textOf(node).includes('2p')
    );
    expect(soutside).toBeDefined();
    act(() => {
      soutside.props.onPress();
    });
    expect(onSelectSeries).toHaveBeenCalledWith('w2');
  });

  test('выбранная кривая отмечена в легенде', () => {
    const tree = mount({ series: twoWells, onSelectSeries: () => {} });
    const chosen = legendItems(tree).filter(
      (node) => node.props.accessibilityState?.selected
    );
    // Прямая идёт по одной кривой, и отмечена в легенде тоже одна
    expect(chosen).toHaveLength(1);
    expect(textOf(chosen[0])).toContain('1p');
  });

  test('без обработчика легенда остаётся подписью, а не выбором', () => {
    // На одиночной откачке выбирать нечего: вторая кривая там — фаза
    // восстановления, а не соседняя скважина
    const tree = mount({ series: twoWells });
    expect(legendItems(tree)).toHaveLength(0);
  });
});
