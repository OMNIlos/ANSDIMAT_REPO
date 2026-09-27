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
jest.mock('../../db/attachments', () => ({
  ATTACHMENT_KINDS: { PHOTO: 'photo', AUDIO: 'audio' },
  listAttachments: jest.fn(async () => ({
    p1: [
      { id: 'a1', pointId: 'p1', kind: 'photo', source: 'a1.jpg', uri: 'file:///d/a1.jpg', durationMillis: 0, waveform: [], recordedAt: 1 },
      { id: 'a2', pointId: 'p1', kind: 'photo', source: 'a2.jpg', uri: 'file:///d/a2.jpg', durationMillis: 0, waveform: [], recordedAt: 2 },
      { id: 'a3', pointId: 'p1', kind: 'audio', source: 'a3.m4a', uri: 'file:///d/a3.m4a', durationMillis: 14000, waveform: [0.2], recordedAt: 3 },
    ],
  })),
  addAttachment: jest.fn(async () => ({ id: 'new' })),
  deleteAttachment: jest.fn(async () => {}),
}));
jest.mock('../../components/PointSheet', () => 'PointSheet');
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
  // По умолчанию доступ ещё не выдавали: дневник не должен дёргать
  // геопозицию сам, пока его об этом не просили
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 55.75, longitude: 37.62 },
  })),
  Accuracy: { High: 4, Balanced: 3 },
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

/** Бейдж вложений точки по её названию */
const badge = (tree, title) =>
  tree.root.find(
    (node) => node.props?.accessibilityLabel === `Вложения точки: ${title}`
  );

test('карточка точки показывает, сколько к ней прикреплено', async () => {
  const tree = await mount();

  // Два снимка и одна запись — счётчики раздельные: искать фото среди
  // записей и наоборот приходится по-разному
  // Форма слова — по числу: «2 снимка», «1 запись»
  expect(badge(tree, 'Скважина 3').props.accessibilityValue).toEqual({
    text: '2 снимка, 1 запись',
  });
});

test('пустая точка всё равно открывает вложения', async () => {
  // Иначе первое вложение некуда добавить: шторку нечем вызвать
  const tree = await mount();

  expect(badge(tree, 'Родник у брода')).toBeDefined();
  // У пустой точки счётчиков нет — только скрепка. Значение всё же явное:
  // undefined на Android не сбрасывал прежнее, и после удаления последнего
  // вложения диктор продолжал читать «1 запись»
  expect(badge(tree, 'Родник у брода').props.accessibilityValue).toEqual({
    text: 'нет вложений',
  });
});

test('нажатие на бейдж открывает шторку этой точки', async () => {
  const tree = await mount();

  expect(tree.root.findByType('PointSheet').props.visible).toBe(false);

  await act(async () => {
    badge(tree, 'Скважина 3').props.onPress();
  });

  const sheet = tree.root.findByType('PointSheet');
  expect(sheet.props.visible).toBe(true);
  expect(sheet.props.point.id).toBe('p1');
  expect(sheet.props.attachments).toHaveLength(3);
});

test('у точки без вложений шторка получает пустой список, а не undefined', async () => {
  // listAttachments не кладёт ключ для точки без вложений
  const tree = await mount();

  await act(async () => {
    badge(tree, 'Родник у брода').props.onPress();
  });

  expect(tree.root.findByType('PointSheet').props.attachments).toEqual([]);
});

test('снятое в шторке пишется в базу и список перечитывается', async () => {
  const { listAttachments, addAttachment } = require('../../db/attachments');
  const tree = await mount();

  // Шторку надо открыть: вложение пишется той точке, чья шторка на экране
  await act(async () => {
    badge(tree, 'Скважина 3').props.onPress();
  });
  listAttachments.mockClear();

  await act(async () => {
    await tree.root
      .findByType('PointSheet')
      .props.onAdd({ kind: 'photo', uri: 'file:///cache/IMG_0001.jpg' });
  });

  expect(addAttachment).toHaveBeenCalledWith({
    pointId: 'p1',
    kind: 'photo',
    uri: 'file:///cache/IMG_0001.jpg',
  });
  // Без перечитывания счётчик в карточке остался бы прежним
  expect(listAttachments).toHaveBeenCalled();
});

test('удалённое в шторке уходит из базы вместе с файлом', async () => {
  const { deleteAttachment } = require('../../db/attachments');
  const tree = await mount();

  await act(async () => {
    badge(tree, 'Скважина 3').props.onPress();
  });
  await act(async () => {
    await tree.root
      .findByType('PointSheet')
      .props.onDelete({ id: 'a1', kind: 'photo' });
  });

  expect(deleteAttachment).toHaveBeenCalledWith('a1');
});

describe('автоопределение координат', () => {
  const Location = require('expo-location');

  /** Даёт отработать цепочке await в эффекте после монтирования */
  const settle = () => act(async () => {});

  test('с уже выданным доступом карта сама встаёт на текущее место', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    const tree = await mount();
    await settle();

    expect(tree.root.findByType('FieldMap').props.center).toEqual({
      lat: 55.75,
      lon: 37.62,
    });
    // Разрешение не спрашивается: его задаёт кнопка «моё местоположение»
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  test('без выданного доступа дневник не запрашивает геопозицию сам', async () => {
    const tree = await mount();
    await settle();

    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(tree.root.findByType('FieldMap').props.center).toBeNull();
  });

  test('выключенный в настройках переключатель карту не двигает', async () => {
    const { setPref } = require('../../lib/appPrefs');
    Location.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    setPref('autoLocation', false);
    try {
      const tree = await mount();
      await settle();
      expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
      expect(tree.root.findByType('FieldMap').props.center).toBeNull();
    } finally {
      setPref('autoLocation', true);
      // Неизрасходованный ответ «granted» не должен достаться чужому тесту
      Location.getForegroundPermissionsAsync.mockReset();
      Location.getForegroundPermissionsAsync.mockImplementation(async () => ({
        status: 'undetermined',
      }));
    }
  });
});
