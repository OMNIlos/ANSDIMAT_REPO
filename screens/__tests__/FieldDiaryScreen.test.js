/**
 * Полевой дневник: описание точки
 *
 * Точка в дневнике — это координаты и название, и по одному названию через
 * неделю не вспомнить, чем «Скважина 3» отличалась от «Скважины 4»: глубиной,
 * обсадкой, подходом, запахом воды. Описание пишется руками — и при
 * постановке точки, и потом, когда от скважины уже отошли.
 *
 * Поле для него в базе было с самого начала (`note` в observation_points), но
 * ввести его на экране было нечем.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));

const STORED = [
  {
    id: 'p1',
    title: 'Скважина 3',
    type: 'well',
    lat: 55.7558,
    lon: 37.6173,
    note: 'Обсадка 168 мм, вода с запахом сероводорода',
    recordedAt: 1_700_000_000_000,
  },
  {
    id: 'p2',
    title: 'Родник у брода',
    type: 'spring',
    lat: 55.7601,
    lon: 37.6203,
    note: '',
    recordedAt: 1_700_000_100_000,
  },
];

jest.mock('../../db/points', () => ({
  listPoints: jest.fn(async () => STORED),
  createPoint: jest.fn(async () => ({ id: 'new' })),
  updatePoint: jest.fn(async () => {}),
  deletePoint: jest.fn(async () => {}),
  getPointStats: jest.fn(async () => ({
    total: 2,
    types: 2,
    lastRecordedAt: 1_700_000_100_000,
  })),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));
jest.mock('../../components/FieldMap', () => 'FieldMap');
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 55.75, longitude: 37.62 },
  })),
  Accuracy: { High: 4 },
}));

const FieldDiaryScreen = require('../FieldDiaryScreen').default;
const { createPoint, updatePoint } = require('../../db/points');

beforeAll(() => {
  I18n.locale = 'ru';
});

beforeEach(() => {
  jest.clearAllMocks();
});

/** Поля ввода экрана: у отрисованного TextInput пропсы стоят на двух узлах */
const inputs = (tree) => {
  const seen = new Set();
  return tree.root
    .findAll((node) => typeof node.props?.onChangeText === 'function', {
      deep: true,
    })
    .filter((node) => {
      const key = `${node.props.placeholder}|${node.props.accessibilityLabel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/** Поле описания точки по её названию */
const noteInput = (tree, title) =>
  inputs(tree).find(
    (node) => node.props.accessibilityLabel === `Описание точки: ${title}`
  );

/** Поле описания в карточке новой точки */
const newNoteInput = (tree) =>
  inputs(tree).find((node) =>
    String(node.props.placeholder ?? '').startsWith('Описание:')
  );

const typeInto = async (node, text) => {
  expect(node).toBeDefined();
  await act(async () => {
    node.props.onChangeText(text);
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
        <FieldDiaryScreen />
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

test('у каждой точки списка есть своё поле описания', async () => {
  const tree = await mount();

  expect(noteInput(tree, 'Скважина 3')).toBeDefined();
  expect(noteInput(tree, 'Родник у брода')).toBeDefined();
});

test('описание из базы стоит в поле, а не теряется', async () => {
  const tree = await mount();

  expect(noteInput(tree, 'Скважина 3').props.value).toBe(
    'Обсадка 168 мм, вода с запахом сероводорода'
  );
  expect(noteInput(tree, 'Родник у брода').props.value).toBe('');
});

test('написанное описание сохраняется по паузе в наборе', async () => {
  // Записью по onBlur описание терялось бы: с клавиатуры уходят кнопкой
  // «назад», а не касанием соседнего поля
  jest.useFakeTimers();
  try {
    const tree = await mount();
    await typeInto(noteInput(tree, 'Родник у брода'), 'Каптаж разрушен, дебит на глаз 0.5 л/с');

    expect(updatePoint).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(updatePoint).toHaveBeenCalledWith('p2', {
      note: 'Каптаж разрушен, дебит на глаз 0.5 л/с',
    });
  } finally {
    jest.useRealTimers();
  }
});

test('уход с экрана раньше паузы описание не теряет', async () => {
  // Отложенная запись снимается вместе с экраном, поэтому недописанное
  // дожимается при размонтировании
  jest.useFakeTimers();
  try {
    const tree = await mount();
    await typeInto(noteInput(tree, 'Родник у брода'), 'Каптаж разрушен');

    await act(async () => {
      tree.unmount();
    });
    mounted = [];

    expect(updatePoint).toHaveBeenCalledWith('p2', { note: 'Каптаж разрушен' });
  } finally {
    jest.useRealTimers();
  }
});

test('нетронутые описания в базу не переписываются', async () => {
  // Иначе каждое открытие дневника метило бы весь список как правленый
  // и гнало его в синхронизацию
  jest.useFakeTimers();
  try {
    await mount();
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(updatePoint).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('описание, написанное до постановки точки, уходит вместе с ней', async () => {
  const tree = await mount();
  await typeInto(newNoteInput(tree), 'Шурф до 2.4 м, вода на 1.8 м');

  // Точка ставится тапом по карте
  const map = tree.root.findAllByType('FieldMap').pop();
  await act(async () => {
    map.props.onPressMap(55.77, 37.64);
  });

  expect(createPoint).toHaveBeenCalledWith(
    expect.objectContaining({
      lat: 55.77,
      lon: 37.64,
      note: 'Шурф до 2.4 м, вода на 1.8 м',
    })
  );
});

test('после постановки точки поле описания очищается', async () => {
  const tree = await mount();
  await typeInto(newNoteInput(tree), 'Шурф до 2.4 м');

  const map = tree.root.findAllByType('FieldMap').pop();
  await act(async () => {
    map.props.onPressMap(55.77, 37.64);
  });

  // Иначе описание прошлой точки досталось бы следующей
  expect(newNoteInput(tree).props.value).toBe('');
});
