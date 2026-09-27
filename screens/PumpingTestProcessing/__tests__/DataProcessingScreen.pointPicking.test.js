/**
 * Отметка точек для прямой по двум замерам
 *
 * Прямую по двум точкам ведут по той кривой, что лежит на полотне, и отмечать
 * её точки надо в той таблице, из которой эта кривая собрана. Отметки стояли
 * только в журнале откачки: у вида ОФР «восстановление уровня» журнал один,
 * на полотне его же строки, а кружков в таблице не было вовсе — прямую
 * приходилось вести вслепую по графику.
 *
 * Второе, что здесь проверяется, — нумерация. На полотно попадают не все
 * строки: пустые выпадают, а на восстановлении выпадают ещё и замеры,
 * сделанные до остановки насоса. Считать номер точки по номеру строки после
 * такого прореживания нельзя — прямая пошла бы по соседним точкам, и
 * водопроводимость получилась бы по замерам, которых геолог не отмечал.
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
 * Одиночная откачка: два журнала, восстановление вторым
 *
 * Первая строка журнала восстановления пустая — так выглядит заготовка под
 * замер, который ещё не сделан. На полотно она не попадает, и номера точек
 * съезжают относительно номеров строк.
 */
const SINGLE = {
  id: 'p1',
  name: 'Одиночная',
  ofrType: 'single',
  Q: 1000,
  pumpingDuration: 100,
  finalDrawdown: 5,
  wells: [],
  measurements: [
    { id: 'm1', t: 1, s: 1 },
    { id: 'm2', t: 10, s: 3 },
    { id: 'm3', t: 100, s: 5 },
  ],
  recoveryMeasurements: [
    { id: 'r0', t: 0, s: 0 },
    { id: 'r1', t: 1, s: 0.5 },
    { id: 'r2', t: 10, s: 3 },
    { id: 'r3', t: 100, s: 4.8 },
  ],
};

/**
 * Вид ОФР «восстановление уровня»: журнал один
 *
 * Время в нём идёт от начала откачки, и первый замер сделан ещё при
 * работающем насосе — до остановки на сотой минуте. На график Тейса он не
 * попадает: t/t′ там не определено.
 */
const RECOVERY = {
  id: 'p2',
  name: 'Восстановление',
  ofrType: 'recovery',
  Q: 1000,
  pumpingDuration: 100,
  finalDrawdown: 5,
  wells: [],
  measurements: [
    { id: 'n0', t: 50, s: 5 },
    { id: 'n1', t: 110, s: 2 },
    { id: 'n2', t: 200, s: 1 },
    { id: 'n3', t: 1100, s: 0.3 },
  ],
  recoveryMeasurements: [],
};

let mockProject = SINGLE;

jest.mock('../../../db/projects', () => ({
  getProject: jest.fn(async () => mockProject),
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

beforeEach(() => {
  mockProject = SINGLE;
});

const textOf = (node) => {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children ?? []).map(textOf).join(' ');
};

const press = async (tree, label) => {
  const target = tree.root
    .findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityRole === 'button' &&
        textOf(node).includes(label),
      { deep: true }
    )
    .pop();
  expect(target).toBeDefined();
  await act(async () => {
    target.props.onPress();
  });
};

/**
 * Узлы отметок точек в таблицах замеров
 *
 * У отрисованного TouchableOpacity одни и те же пропсы стоят и на составном
 * узле, и на хост-элементе под ним, поэтому каждая отметка находится дважды.
 */
const pickNodes = (tree) =>
  tree.root.findAll(
    (node) =>
      typeof node.props?.onPress === 'function' &&
      node.props?.accessibilityRole === 'checkbox',
    { deep: true }
  );

/** Подписи отметок, по одной на строку журнала */
const picks = (tree) => [
  ...new Set(pickNodes(tree).map((node) => node.props.accessibilityLabel)),
];

/** Отметка строки журнала по её номеру в таблице, считая с единицы */
const pick = (tree, rowNumber) =>
  pickNodes(tree)
    .filter((node) => node.props.accessibilityLabel === `Замер ${rowNumber}`)
    .pop();

const tapPick = async (tree, rowNumber) => {
  const target = pick(tree, rowNumber);
  expect(target).toBeDefined();
  await act(async () => {
    target.props.onPress();
  });
};

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
            route={{ params: { projectId: mockProject.id } }}
            navigation={{}}
          />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

test('у вида ОФР «восстановление уровня» отметки стоят в его таблице', async () => {
  // Журнал здесь один, и на полотне лежат его же строки: отмечать точки
  // больше негде. Раньше кружков в этой таблице не было совсем
  mockProject = RECOVERY;
  const tree = await mount();

  expect(picks(tree)).toHaveLength(RECOVERY.measurements.length);
});

test('замер до остановки насоса отметить нечем', async () => {
  // Первая строка сделана при работающем насосе: t/t′ для неё не определено,
  // на графике этой точки нет — и прямую через неё не провести
  mockProject = RECOVERY;
  const tree = await mount();

  expect(pick(tree, 1).props.accessibilityState.disabled).toBe(true);
  expect(pick(tree, 2).props.accessibilityState.disabled).toBe(false);
});

test('отметка находит свою точку, а не строку с тем же номером', async () => {
  // Вторая и третья строки таблицы — первая и вторая точки на полотне:
  // замер до остановки насоса в ряд не попал
  mockProject = RECOVERY;
  const tree = await mount();

  await tapPick(tree, 2);
  await tapPick(tree, 3);

  expect(chartProps(tree).selected).toEqual([0, 1]);
});

test('на восстановлении отметки переезжают в журнал восстановления', async () => {
  // На полотне остаточное понижение, собранное из второго журнала. Отметки
  // на журнале откачки показывали бы номера строк чужого ряда
  const tree = await mount();
  expect(picks(tree)).toHaveLength(SINGLE.measurements.length);

  await press(tree, 'Восстановление');

  expect(picks(tree)).toHaveLength(SINGLE.recoveryMeasurements.length);
});

test('пустая строка журнала восстановления не сдвигает номера точек', async () => {
  const tree = await mount();
  await press(tree, 'Восстановление');

  // Первая строка пустая — точки на полотне нет
  expect(pick(tree, 1).props.accessibilityState.disabled).toBe(true);

  await tapPick(tree, 2);
  await tapPick(tree, 3);

  expect(chartProps(tree).selected).toEqual([0, 1]);
});

test('смена фазы снимает отметки прежней кривой', async () => {
  // У откачки на абсциссе время от её начала, у восстановления отношение
  // t/t′: прежние номера указывали бы на точки другой кривой
  const tree = await mount();
  await tapPick(tree, 1);
  await tapPick(tree, 2);
  expect(chartProps(tree).selected).toEqual([0, 1]);

  await press(tree, 'Восстановление');

  expect(chartProps(tree).selected).toEqual([]);
});
