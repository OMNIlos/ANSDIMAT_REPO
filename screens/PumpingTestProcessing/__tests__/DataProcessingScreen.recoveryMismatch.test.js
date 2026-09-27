/**
 * Кустовая откачка: виды по расстоянию и несходящийся журнал восстановления
 *
 * Две вещи, которые в поле выглядят как «приложение сломалось», а на деле
 * требуют объяснения на полотне.
 *
 * Первая — виды с расстоянием в абсциссе. Табл. 13.1 АНСДИМАТ даёт кусту три
 * прослеживания: временнóе s — lg t, площадное s — lg r и комбинированное
 * s — lg(t/r²). Все три обязаны быть на откачке, и тест держит их список.
 *
 * Вторая — журнал восстановления, заполненный не той величиной. Остаточное
 * понижение считается от понижения на остановке насоса, и если подъём уровня
 * во всех строках больше него, остатка не остаётся ни в одной точке. Раньше
 * такой журнал ложился ровной горизонталью по нулю: график без единой
 * настоящей точки, но с виду посчитанный.
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
 * Куст в том виде, в каком его заводит createProject
 *
 * Опытная скважина со своим радиусом 0.045 м, наблюдательная на 5 м. У
 * опытной журнал восстановления заполнен подъёмом уровня и сходится. У
 * наблюдательной — числами больше её собственного понижения на остановке
 * (0.6 м): так выглядит журнал, в который внесли не подъём уровня, а,
 * например, его глубину.
 */
jest.mock('../../../db/projects', () => ({
  getProject: jest.fn(async () => ({
    id: 'p1',
    name: 'Куст',
    ofrType: 'cluster',
    Q: 1000,
    pumpingDuration: 100,
    finalDrawdown: 0,
    wells: [
      { id: 'w1', name: '1оп', role: 'pumping', distance: 0.045, finalDrawdown: 0, order: 0 },
      { id: 'w2', name: '1н', role: 'observation', distance: 5, finalDrawdown: 0, order: 1 },
    ],
    measurements: [
      { id: 'a1', wellId: 'w1', t: 1, s: 2 },
      { id: 'a2', wellId: 'w1', t: 10, s: 4 },
      { id: 'a3', wellId: 'w1', t: 100, s: 6 },
      { id: 'b1', wellId: 'w2', t: 1, s: 0.2 },
      { id: 'b2', wellId: 'w2', t: 10, s: 0.4 },
      { id: 'b3', wellId: 'w2', t: 100, s: 0.6 },
    ],
    recoveryMeasurements: [
      { id: 'r1', wellId: 'w1', t: 1, s: 1 },
      { id: 'r2', wellId: 'w1', t: 10, s: 3 },
      { id: 'r3', wellId: 'w1', t: 100, s: 5.9 },
      { id: 'q1', wellId: 'w2', t: 1, s: 2 },
      { id: 'q2', wellId: 'w2', t: 10, s: 3 },
      { id: 'q3', wellId: 'w2', t: 100, s: 4 },
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

const textOf = (node) => {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children ?? []).map(textOf).join(' ');
};

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

/** Подписи чипов выбора вида графика */
const modeChips = (tree) => [
  ...new Set(
    tree.root
      .findAll(
        (node) =>
          typeof node.props?.onPress === 'function' &&
          node.props?.accessibilityRole === 'button',
        { deep: true }
      )
      .map((node) => textOf(node).trim())
  ),
];

const chartProps = (tree) => tree.root.findAllByType(DrawdownChart).pop()?.props;

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

test('на откачке у куста есть все три вида прослеживания из табл. 13.1', async () => {
  const tree = await mount();
  const chips = modeChips(tree);

  // Временнóе, площадное и комбинированное — три столбца таблицы
  expect(chips).toEqual(expect.arrayContaining(['lg t', 'lg r', 'lg t/r²']));
});

test('несходящийся журнал восстановления не рисуется горизонталью в ноль', async () => {
  const tree = await mount();
  await press(tree, 'Восстановление');
  await press(tree, '1н', 'radio');

  // Рядом лежит восстановление соседней скважины — оно сходится и остаётся.
  // Пусто должно быть у той кривой, по которой ведётся прямая
  const fitted = (chartProps(tree)?.series ?? []).find(
    (one) => one.role === 'fit'
  );
  expect(fitted?.measurements ?? []).toHaveLength(0);
});

test('вместо пустого полотна экран объясняет, что не сошлось', async () => {
  const tree = await mount();
  await press(tree, 'Восстановление');
  await press(tree, '1н', 'radio');

  const shown = textOf(tree.toJSON());
  expect(shown).toContain('не сходится с понижением на остановке');
});

test('у скважины со сходящимся журналом кривая на месте', async () => {
  const tree = await mount();
  await press(tree, 'Восстановление');
  await press(tree, '1оп', 'radio');

  const ordinates = (chartProps(tree)?.series ?? [])
    .filter((one) => one.role === 'fit')
    .flatMap((one) => one.measurements ?? [])
    .map((m) => m.s);

  expect(ordinates).toHaveLength(3);
  // Остаток сходит к нулю, а не стоит на нём
  expect(new Set(ordinates).size).toBe(3);
});

test('на восстановлении на полотне кривые всех скважин, а откачки — ни одной', async () => {
  // Фазы не смешиваются: выбрано восстановление — на полотне восстановление
  // каждой скважины куста, и кривой откачки среди них нет
  const tree = await mount();
  await press(tree, 'Восстановление');
  await press(tree, '1оп', 'radio');

  const series = chartProps(tree)?.series ?? [];
  // Кривой откачки на полотне восстановления нет ни одной: раньше она лежала
  // рядом с остаточным понижением, хотя по абсциссе у них разные величины
  expect(series.some((one) => one.id === 'pumping')).toBe(false);
  expect(series.filter((one) => one.role === 'fit')).toHaveLength(1);
  expect(series[0].name).toContain('Восстановление');
});

test('снятая с полотна скважина не рисуется', async () => {
  const tree = await mount();
  // Открытой при загрузке стоит наблюдательная, поэтому в ряду видимости
  // лежит опытная: открытую скважину скрыть нечем — по ней идёт прямая
  const before = (chartProps(tree)?.series ?? []).length;
  expect(before).toBe(2);

  await press(tree, '1оп', 'switch');

  expect((chartProps(tree)?.series ?? []).length).toBe(before - 1);
});
