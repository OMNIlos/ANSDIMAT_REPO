/**
 * Шторка вложений точки
 *
 * Всё содержимое вложений живёт здесь: дневник — плоский список, который
 * прокручивают целиком, и полоса миниатюр в каждой карточке превратила бы
 * его в ленту картинок.
 *
 * Шторка ничего не пишет в базу: она сообщает наружу, что снято и что
 * удалено, а запись остаётся за экраном.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

const mockCapture = jest.fn(async () => 'file:///cache/IMG_0001.jpg');
jest.mock('../../hooks/usePhotoCapture', () => ({
  __esModule: true,
  default: () => ({ capture: mockCapture, denied: null, clearDenied: jest.fn() }),
  PHOTO_QUALITY: 0.6,
}));

const start = jest.fn(async () => true);
const stop = jest.fn(async () => ({
  uri: 'file:///cache/recording.m4a',
  durationMillis: 14_000,
  waveform: [0.2, 0.8],
}));
let mockRecorder = { start, stop, isRecording: false, durationMillis: 0, levels: [], denied: false };
jest.mock('../../hooks/useVoiceRecorder', () => ({
  __esModule: true,
  default: () => mockRecorder,
  METER_INTERVAL_MS: 100,
}));

// Кнопки ConfirmDialog не несут accessibilityLabel — искать их по метке
// нечем. Подменяем его строковым компонентом и читаем пропсы
jest.mock('../ui/ConfirmDialog', () => 'ConfirmDialog');
jest.mock('../PhotoViewer', () => 'PhotoViewer');

const PointSheet = require('../PointSheet').default;

const POINT = {
  id: 'p1',
  title: 'Скважина 3',
  type: 'well',
  lat: 55.7558,
  lon: 37.6173,
  recordedAt: 1_700_000_000_000,
};

const ATTACHMENTS = [
  { id: 'a1', pointId: 'p1', kind: 'photo', source: 'a1.jpg', uri: 'file:///d/a1.jpg', durationMillis: 0, waveform: [], recordedAt: 1 },
  { id: 'a2', pointId: 'p1', kind: 'audio', source: 'a2.m4a', uri: 'file:///d/a2.m4a', durationMillis: 14_000, waveform: [0.2, 0.8], recordedAt: 2 },
];

beforeAll(() => {
  I18n.locale = 'ru';
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorder = { start, stop, isRecording: false, durationMillis: 0, levels: [], denied: false };
});

// React 19: renderer.create() надо оборачивать в act(), иначе тест-рендерер
// считается размонтированным ещё до первой проверки (см. другие тесты в
// components/__tests__ — та же обёртка везде)
const mount = (props) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <PointSheet
          point={POINT}
          attachments={ATTACHMENTS}
          visible
          onClose={() => {}}
          onAdd={async () => {}}
          onDelete={async () => {}}
          {...props}
        />
      </PaperProvider>
    );
  });
  return tree;
};

const button = (tree, label) =>
  tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      node.props?.accessibilityLabel === label
  );

// findAll без options по умолчанию идёт в глубину (deep:true в самой
// библиотеке) и находит accessibilityRole/accessibilityLabel и на составном
// TouchableOpacity, и на его хостовых обёртках — одна кнопка считается
// несколько раз. Фильтр по типу-строке — как в AudioWave.test.js — оставляет
// только хостовый узел
const buttons = (tree, label) =>
  tree.root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.props?.accessibilityRole === 'button' &&
      node.props?.accessibilityLabel === label,
    { deep: true }
  );

const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.props?.children === 'string', { deep: true })
    .map((node) => node.props.children);

test('в шапке стоит название и координаты точки', () => {
  const tree = mount();

  expect(texts(tree)).toEqual(expect.arrayContaining(['Скважина 3', '55.7558, 37.6173']));
});

test('длительность записи выводится рядом с волной', () => {
  const tree = mount();

  expect(texts(tree)).toEqual(expect.arrayContaining(['0:14']));
});

test('снятое фото уходит наружу, а не пишется здесь', async () => {
  const onAdd = jest.fn(async () => {});
  const tree = mount({ onAdd });

  // «Фото» раскрывает выбор источника на месте кнопки, «Снять» — уже в нём
  await act(async () => {
    button(tree, 'Фото').props.onPress();
  });
  await act(async () => {
    button(tree, 'Снять').props.onPress();
  });

  expect(mockCapture).toHaveBeenCalledWith('camera');
  expect(onAdd).toHaveBeenCalledWith({
    kind: 'photo',
    uri: 'file:///cache/IMG_0001.jpg',
  });
});

test('отменённая съёмка наружу ничего не отдаёт', async () => {
  mockCapture.mockResolvedValueOnce(null);
  const onAdd = jest.fn(async () => {});
  const tree = mount({ onAdd });

  await act(async () => {
    button(tree, 'Фото').props.onPress();
  });
  await act(async () => {
    button(tree, 'Снять').props.onPress();
  });

  expect(onAdd).not.toHaveBeenCalled();
});

test('тап по «Запись» начинает запись', async () => {
  const tree = mount();

  await act(async () => {
    button(tree, 'Запись').props.onPress();
  });

  expect(start).toHaveBeenCalled();
});

test('во время записи кнопка сменяется живой строкой', () => {
  mockRecorder = { ...mockRecorder, isRecording: true, durationMillis: 7_000, levels: [0.3, 0.7] };
  const tree = mount();

  // Кнопки «Запись» больше нет — на её месте строка со «стоп»
  expect(buttons(tree, 'Запись')).toHaveLength(0);
  expect(buttons(tree, 'Остановить запись')).toHaveLength(1);
  expect(texts(tree)).toEqual(expect.arrayContaining(['0:07']));
});

test('остановка отдаёт запись наружу с волной и длительностью', async () => {
  mockRecorder = { ...mockRecorder, isRecording: true, durationMillis: 14_000, levels: [0.2, 0.8] };
  const onAdd = jest.fn(async () => {});
  const tree = mount({ onAdd });

  await act(async () => {
    button(tree, 'Остановить запись').props.onPress();
  });

  expect(onAdd).toHaveBeenCalledWith({
    kind: 'audio',
    uri: 'file:///cache/recording.m4a',
    durationMillis: 14_000,
    waveform: [0.2, 0.8],
  });
});

test('пустая шторка не несёт пояснительного текста', () => {
  const tree = mount({ attachments: [] });

  // Две кнопки внизу сами говорят, что делать
  expect(buttons(tree, 'Фото')).toHaveLength(1);
  expect(buttons(tree, 'Запись')).toHaveLength(1);
  expect(texts(tree)).not.toEqual(expect.arrayContaining([expect.stringContaining('Пока ничего')]));
});

test('удаление записи спрашивает подтверждение, а не стирает молча', async () => {
  const onDelete = jest.fn(async () => {});
  const tree = mount({ onDelete });

  expect(tree.root.findByType('ConfirmDialog').props.visible).toBe(false);

  await act(async () => {
    button(tree, 'Удалить запись').props.onPress();
  });

  expect(onDelete).not.toHaveBeenCalled();
  const dialog = tree.root.findByType('ConfirmDialog');
  expect(dialog.props.visible).toBe(true);
  expect(dialog.props.title).toBe('Удалить вложение?');
});

test('подтверждённое удаление уходит наружу', async () => {
  const onDelete = jest.fn(async () => {});
  const tree = mount({ onDelete });

  await act(async () => {
    button(tree, 'Удалить запись').props.onPress();
  });
  await act(async () => {
    await tree.root.findByType('ConfirmDialog').props.onConfirm();
  });

  expect(onDelete).toHaveBeenCalledWith(ATTACHMENTS[1]);
});

test('без точки шторка не показывается', () => {
  const tree = mount({ point: null });

  expect(buttons(tree, 'Фото')).toHaveLength(0);
});
