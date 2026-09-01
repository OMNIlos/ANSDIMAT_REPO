/**
 * Проверка экрана обработки на кустовой откачке
 *
 * У куста журналов вдвое больше, чем у одиночной откачки: пара «откачка —
 * восстановление» на каждую скважину. Отсюда две вещи, которых на одиночной
 * не увидеть.
 *
 * Первая — понижение на момент остановки насоса. Оно своё у каждой скважины:
 * опытная садится на метры, дальняя наблюдательная на сантиметры. Общее на
 * весь журнал число давало остаточное понижение чужой скважины, разница
 * выходила отрицательной, обрезалась нулём — и кривая восстановления ложилась
 * ровной горизонталью по нулю.
 *
 * Вторая — виды с расстоянием в абсциссе. Они читают журнал откачки, а
 * ветвились раньше проверки фазы: переход на восстановление оставлял на
 * полотне те же точки, только с переименованными осями.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import I18n from '../../../Localization';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));

/**
 * Куст из опытной и наблюдательной скважины
 *
 * Понижения различаются на порядок — так и бывает в поле, и ровно на этом
 * ломалось общее на весь журнал понижение на остановке. Журнал
 * восстановления заполнен у опытной: подъём уровня идёт к её же понижению
 * на остановке (6 м), а не к понижению наблюдательной (0.6 м).
 */
jest.mock('../../../db/projects', () => ({
  getProject: jest.fn(async () => ({
    id: 'p1',
    name: 'Куст',
    ofrType: 'cluster',
    Q: 1000,
    pumpingDuration: 100,
    // Проектное понижение на остановке осталось от наблюдательной скважины:
    // именно так его подставляет переход на фазу восстановления
    finalDrawdown: 0.6,
    wells: [
      {
        id: 'w1',
        name: '1w',
        role: 'pumping',
        distance: 0.1,
        finalDrawdown: 0,
        order: 0,
      },
      {
        id: 'p1w',
        name: '1p',
        role: 'observation',
        distance: 25,
        finalDrawdown: 0,
        order: 1,
      },
    ],
    measurements: [
      { id: 'a1', wellId: 'w1', t: 1, s: 2 },
      { id: 'a2', wellId: 'w1', t: 10, s: 4 },
      { id: 'a3', wellId: 'w1', t: 100, s: 6 },
      { id: 'b1', wellId: 'p1w', t: 1, s: 0.2 },
      { id: 'b2', wellId: 'p1w', t: 10, s: 0.4 },
      { id: 'b3', wellId: 'p1w', t: 100, s: 0.6 },
    ],
    // Подъём уровня в опытной скважине от момента остановки насоса
    recoveryMeasurements: [
      { id: 'r1', wellId: 'w1', t: 1, s: 1 },
      { id: 'r2', wellId: 'w1', t: 10, s: 3 },
      { id: 'r3', wellId: 'w1', t: 100, s: 5.9 },
    ],
  })),
  updateProject: jest.fn(async () => {}),
  replaceMeasurements: jest.fn(async () => {}),
  addMeasurement: jest.fn(async () => ({ id: 'new' })),
  deleteMeasurement: jest.fn(async () => {}),
}));
jest.mock('../../../db/wells', () => ({
  createWell: jest.fn(),
  deleteWell: jest.fn(),
  setWellDistance: jest.fn(async () => {}),
  setWellFinalDrawdown: jest.fn(async () => {}),
  setWellPosition: jest.fn(async () => {}),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));
jest.mock('../../../components/FieldMap', () => 'FieldMap');
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn() }));

const DataProcessingScreen = require('../DataProcessingScreen').default;
const DrawdownChart = require('../../../components/chart/DrawdownChart').default;
const { UnitsProvider } = require('../../../UnitsContext');

beforeAll(() => {
  I18n.locale = 'ru';
});

/** Все узлы дерева подряд */
const walk = (node, seen = []) => {
  if (!node || typeof node !== 'object') return seen;
  if (node.type) seen.push(node);
  for (const child of node.children ?? []) walk(child, seen);
  return seen;
};

/** Точки замеров на полотне: только они рисуются кружками с ординатой */
const dotsOf = (tree) =>
  walk(tree.toJSON()).filter((node) => node.type === 'RNSVGCircle');

/**
 * Весь текст внутри узла
 *
 * Обходом по children, а не через JSON: в пропсах узлов лежат провайдеры
 * контекста, и сериализация упирается в круговую ссылку.
 */
const textOf = (node) => {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children ?? []).map(textOf).join(' ');
};

/**
 * Нажимает элемент с заданной подписью
 *
 * Роль указывается отдельно: чипы скважин объявлены переключателями (radio),
 * а не кнопками — по роли их и отличают от кнопок управления.
 */
const press = async (tree, label, role = 'button') => {
  const target = tree.root
    .findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityRole === role &&
        textOf(node).includes(label),
      { deep: true }
    )
    .pop();
  expect(target).toBeDefined();
  await act(async () => {
    target.props.onPress();
  });
};

let mounted = [];
afterEach(async () => {
  await act(async () => {
    mounted.forEach((tree) => tree.unmount());
  });
  mounted = [];
});

const mount = async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <DataProcessingScreen
            route={{ params: { projectId: 'p1' } }}
            navigation={{}}
          />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

test('кривая восстановления опытной скважины не ложится горизонталью в ноль', async () => {
  // Порядок тот, каким экран открывается: сперва фаза, потом скважина.
  // Открытой при переходе стоит наблюдательная — её понижение на остановке
  // и подставлялось в поле, а журнал восстановления заполняли у опытной.
  // Подъём уровня оказывался больше чужого понижения, разница обрезалась
  // нулём, и все точки вставали на одну высоту
  const tree = await mount();
  await press(tree, 'Восстановление');
  await press(tree, '1w', 'radio');

  const ordinates = dotsOf(tree).map((dot) => dot.props.cy);
  expect(ordinates.length).toBeGreaterThanOrEqual(3);
  expect(new Set(ordinates.map((y) => y.toFixed(1))).size).toBeGreaterThan(1);
});

/**
 * Пьезопроводность на прямой восстановления
 *
 * Отсечка на этом графике за a не отвечает — прямая обязана выходить из
 * начала координат, — и в карточке годами стоял прочерк. Считается она по
 * понижению на момент остановки насоса: табл. 3.13 АНСДИМАТ, примечание (3).
 */
test('на прямой восстановления пьезопроводность считается', async () => {
  const tree = await mount();
  await press(tree, 'Восстановление');
  await press(tree, '1w', 'radio');

  const card = tree.root
    .findAll((node) => typeof node.props?.label === 'string' &&
      node.props.label.startsWith('Пьезопр'), { deep: true })
    .pop();
  expect(card).toBeDefined();
  expect(card.props.value).not.toBe('—');
  expect(Number(card.props.value)).toBeGreaterThan(0);
});

test('переход на восстановление уводит с видов по расстоянию', async () => {
  // Комбинированный график читает журнал откачки: остаточное понижение по
  // Джейкобу от расстояния не зависит вовсе, и строить его по кусту нечего.
  // Раньше точки откачки оставались на полотне, а оси переименовывались
  const tree = await mount();
  await press(tree, 'lg t/r²');
  const combined = dotsOf(tree).map((dot) => dot.props.cy);
  expect(combined.length).toBe(6);

  await press(tree, 'Восстановление');
  await press(tree, '1w', 'radio');

  const after = dotsOf(tree).map((dot) => dot.props.cy);
  expect(after).not.toEqual(combined);

  // Виды по расстоянию на восстановлении не предлагаются вовсе: остаточное
  // понижение от r не зависит, строить по кусту нечего
  const modes = tree.root
    .findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityRole === 'button',
      { deep: true }
    )
    .map(textOf);
  expect(modes.some((label) => label.includes('lg t/r²'))).toBe(false);
  expect(modes.some((label) => label.includes('lg r'))).toBe(false);
});

/**
 * Выбор кривой на полотне
 *
 * На плоскости s — lg t у куста лежит по кривой на скважину. Прямая идёт по
 * одной из них, и до этого понять, по какой именно, можно было только по
 * пунктиру соседних. Разница не косметическая: в пьезопроводность и водоотдачу
 * входит расстояние r, своё у каждой скважины, — по двум кривым на одном
 * полотне выходят два разных ответа.
 */
describe('выбор кривой на графике', () => {
  /**
   * Элементы легенды по одному на кривую
   *
   * Поиск идёт внутри графика: чипы скважин над журналом объявлены такими же
   * переключателями и подписаны теми же именами — по всему экрану они попали
   * бы в выборку наравне с легендой.
   */
  const legendItems = (tree) => {
    const chart = tree.root.findAllByType(DrawdownChart)[0];
    if (!chart) return [];
    const seen = new Map();
    for (const node of chart.findAll(
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

  /** Весь текст экрана: подпись под графиком ищется по ней */
  const screenText = (tree) => textOf(tree.toJSON());

  test('прямая идёт по открытой скважине, и её расстояние названо', async () => {
    const tree = await mount();
    // Открытой встаёт наблюдательная скважина: расстояние у неё 25 м
    expect(screenText(tree)).toContain('1p');
    expect(screenText(tree)).toContain('25');
  });

  test('касание кривой в легенде переводит прямую на неё вместе с r', async () => {
    const tree = await mount();

    // В легенде обе кривые куста: открытая наблюдательная и опытная рядом
    const chosen = legendItems(tree).filter(
      (node) => node.props.accessibilityState?.selected
    );
    expect(chosen).toHaveLength(1);
    expect(textOf(chosen[0])).toContain('1p');

    const pumpingCurve = legendItems(tree).find((node) =>
      textOf(node).includes('1w')
    );
    expect(pumpingCurve).toBeDefined();
    await act(async () => {
      pumpingCurve.props.onPress();
    });

    // Радиус опытной скважины 0.1 м — теперь пьезопроводность считается по нему
    const after = screenText(tree);
    expect(after).toContain('0.1');
    const nowChosen = legendItems(tree).filter(
      (node) => node.props.accessibilityState?.selected
    );
    expect(textOf(nowChosen[0])).toContain('1w');
  });

  test('пустой журнал восстановления объясняется на полотне', async () => {
    // У наблюдательной замеров после остановки насоса нет вовсе. Полотно
    // должно сказать это прямо, а не показывать точки откачки под осями
    // восстановления и не отделываться общим «внесите замеры»
    const tree = await mount();
    await press(tree, 'Восстановление');
    expect(screenText(tree)).toContain('Журнал восстановления пуст');
  });
});
