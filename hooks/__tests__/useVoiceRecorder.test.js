/**
 * Запись голосовой заметки
 *
 * Проверяется то, что нельзя увидеть глазами на устройстве: уровни копятся,
 * пока идёт запись, прореживаются при остановке, и микрофон отпускается —
 * иначе на iOS воспроизведение уходит в разговорный динамик.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

// Названия с приставкой mock — не стиль, а требование babel-plugin-jest-hoist:
// фабрика jest.mock() поднимается над объявлениями, и без приставки mock
// babel статически запрещает ссылаться на внешние переменные
const mockRecorder = {
  uri: 'file:///cache/recording.m4a',
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(() => {}),
  stop: jest.fn(async () => {}),
};

let mockRecorderState = { isRecording: false, durationMillis: 0, metering: undefined };

jest.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })) },
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioRecorder: jest.fn(() => mockRecorder),
  useAudioRecorderState: jest.fn(() => mockRecorderState),
}));

const { AudioModule, setAudioModeAsync } = require('expo-audio');
const useVoiceRecorder = require('../useVoiceRecorder').default;

function mountHook() {
  const box = {};
  function Probe() {
    box.current = useVoiceRecorder();
    return <Text>probe</Text>;
  }
  let tree;
  act(() => {
    tree = renderer.create(<Probe />);
  });
  return { box, tree };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorderState = { isRecording: false, durationMillis: 0, metering: undefined };
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
});

test('старт готовит рекордер и включает микрофон', async () => {
  const { box } = mountHook();

  let started;
  await act(async () => {
    started = await box.current.start();
  });

  expect(started).toBe(true);
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: true })
  );
  expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalled();
  expect(mockRecorder.record).toHaveBeenCalled();
});

test('без доступа к микрофону запись не начинается', async () => {
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = mountHook();

  let started;
  await act(async () => {
    started = await box.current.start();
  });

  expect(started).toBe(false);
  expect(mockRecorder.record).not.toHaveBeenCalled();
  expect(box.current.denied).toBe(true);
});

test('остановка отпускает микрофон', async () => {
  // С allowsRecording воспроизведение на iOS идёт тихо и через разговорный
  // динамик: записанное потом невозможно прослушать
  const { box } = mountHook();
  await act(async () => {
    await box.current.start();
  });
  setAudioModeAsync.mockClear();

  await act(async () => {
    await box.current.stop();
  });

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: false })
  );
});

test('остановка отдаёт адрес, длительность и волну', async () => {
  mockRecorderState = { isRecording: false, durationMillis: 14_400, metering: undefined };
  const { box } = mountHook();
  await act(async () => {
    await box.current.start();
  });

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded.uri).toBe('file:///cache/recording.m4a');
  expect(recorded.durationMillis).toBe(14_400);
  expect(Array.isArray(recorded.waveform)).toBe(true);
});

test('рекордер без файла ничего не возвращает', async () => {
  mockRecorder.uri = null;
  const { box } = mountHook();
  await act(async () => {
    await box.current.start();
  });

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded).toBeNull();
  mockRecorder.uri = 'file:///cache/recording.m4a';
});
