/**
 * Запись голосовой заметки
 *
 * Проверяется то, что нельзя увидеть глазами на устройстве: уровни копятся,
 * пока идёт запись, микрофон отпускается, а рекордер не опрашивается тогда,
 * когда нативная сторона его освобождает. Именно такой опрос на Android
 * бросал исключение в таймере и закрывал приложение после записи.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

// Названия с приставкой mock — требование babel-plugin-jest-hoist: фабрика
// jest.mock() поднимается над объявлениями и без приставки не видит их
const mockRecorder = {
  uri: 'file:///cache/recording.m4a',
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(() => {}),
  stop: jest.fn(async () => {}),
  getStatus: jest.fn(),
};

jest.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })) },
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioRecorder: jest.fn(() => mockRecorder),
  useAudioRecorderState: jest.fn(() => ({ isRecording: false, durationMillis: 0 })),
}));

const { AudioModule, setAudioModeAsync, useAudioRecorderState } = require('expo-audio');
const recorderModule = require('../useVoiceRecorder');

const useVoiceRecorder = recorderModule.default;
const { METER_INTERVAL_MS, MIN_RECORDING_MS } = recorderModule;

/**
 * Поднимает хук в пробном компоненте
 *
 * @returns {Promise<{box: Object, tree: Object}>} доступ к хуку и дерево
 */
async function mountHook() {
  const box = {};
  function Probe() {
    box.current = useVoiceRecorder();
    return <Text>probe</Text>;
  }
  let tree;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  return { box, tree };
}

/**
 * Прокручивает таймеры внутри act: тики опроса обновляют состояние хука
 *
 * @param {number} ms - сколько прокрутить
 */
async function advance(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/**
 * Начинает запись
 *
 * @param {Object} box - доступ к хуку
 */
async function startRecording(box) {
  await act(async () => {
    await box.current.start();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRecorder.uri = 'file:///cache/recording.m4a';
  mockRecorder.getStatus.mockImplementation(() => ({
    isRecording: true,
    durationMillis: 0,
    metering: -30,
  }));
  mockRecorder.stop.mockImplementation(async () => {});
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
});

afterEach(() => {
  jest.useRealTimers();
});

test('старт готовит рекордер и включает микрофон', async () => {
  const { box } = await mountHook();

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
  expect(box.current.isRecording).toBe(true);
});

test('без доступа к микрофону запись не начинается', async () => {
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = await mountHook();

  let started;
  await act(async () => {
    started = await box.current.start();
  });

  expect(started).toBe(false);
  expect(mockRecorder.record).not.toHaveBeenCalled();
  expect(box.current.denied).toBe(true);
});

test('библиотечный опрос состояния не используется', async () => {
  // useAudioRecorderState держит таймер всё время жизни шторки и зовёт
  // getStatus в том числе во время остановки
  await mountHook();

  expect(useAudioRecorderState).not.toHaveBeenCalled();
});

test('до старта рекордер не опрашивается', async () => {
  await mountHook();

  await advance(1000);

  expect(mockRecorder.getStatus).not.toHaveBeenCalled();
});

test('пока идёт запись, уровни копятся по тикам', async () => {
  const { box } = await mountHook();
  await startRecording(box);

  // -30 дБFS — середина шкалы, 0 — максимум, -60 — порог тишины
  mockRecorder.getStatus
    .mockImplementationOnce(() => ({ isRecording: true, durationMillis: 100, metering: -30 }))
    .mockImplementationOnce(() => ({ isRecording: true, durationMillis: 200, metering: 0 }))
    .mockImplementationOnce(() => ({ isRecording: true, durationMillis: 300, metering: -60 }));
  await advance(METER_INTERVAL_MS * 3);

  expect(box.current.levels).toEqual([0.5, 1, 0]);
  expect(box.current.durationMillis).toBe(300);
});

test('опрос снимается раньше, чем рекордер начинает останавливаться', async () => {
  // Остановка на Android идёт фоновым потоком и освобождает MediaRecorder.
  // Тик опроса в это время читал maxAmplitude освобождённого рекордера, и
  // исключение в таймере закрывало приложение
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);

  let pollsAtStop = null;
  mockRecorder.stop.mockImplementation(async () => {
    pollsAtStop = mockRecorder.getStatus.mock.calls.length;
    // Пока нативная остановка идёт, таймеры продолжают тикать
    jest.advanceTimersByTime(METER_INTERVAL_MS * 5);
  });

  await act(async () => {
    await box.current.stop();
  });
  await advance(METER_INTERVAL_MS * 5);

  // Опрос шёл во время записи — и ни одного тика с момента остановки
  expect(pollsAtStop).toBeGreaterThan(0);
  expect(mockRecorder.getStatus.mock.calls.length).toBe(pollsAtStop);
});

test('сорвавшийся тик опроса не роняет запись', async () => {
  const { box } = await mountHook();
  await startRecording(box);
  mockRecorder.getStatus.mockImplementation(() => {
    throw new Error('getMaxAmplitude called in an invalid state');
  });

  await advance(METER_INTERVAL_MS * 3);

  expect(box.current.isRecording).toBe(true);
});

test('второе нажатие во время старта рекордер повторно не готовит', async () => {
  // Двойной тап звал prepareToRecordAsync дважды, и первый MediaRecorder
  // оставался держать микрофон
  let grant;
  AudioModule.requestRecordingPermissionsAsync.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      })
  );
  const { box } = await mountHook();

  let first;
  let second;
  await act(async () => {
    first = box.current.start();
    second = await box.current.start();
  });
  await act(async () => {
    grant({ granted: true });
    await first;
  });

  expect(second).toBe(false);
  expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
});

test('слишком ранний стоп дожидается минимальной длительности', async () => {
  // MediaRecorder.stop() сразу после start() бросает «stop failed» и
  // оставляет пустой файл
  const { box } = await mountHook();
  await startRecording(box);

  let stopping;
  await act(async () => {
    stopping = box.current.stop();
  });
  expect(mockRecorder.stop).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(MIN_RECORDING_MS);
    await stopping;
  });
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
});

test('остановка отпускает микрофон', async () => {
  // С allowsRecording воспроизведение на iOS идёт тихо и через разговорный
  // динамик: записанное потом невозможно прослушать
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);
  setAudioModeAsync.mockClear();

  await act(async () => {
    await box.current.stop();
  });

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: false })
  );
  expect(box.current.isRecording).toBe(false);
});

test('сорвавшаяся остановка всё равно отпускает микрофон', async () => {
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);
  mockRecorder.stop.mockRejectedValueOnce(new Error('stop failed'));
  setAudioModeAsync.mockClear();

  await act(async () => {
    await expect(box.current.stop()).rejects.toThrow('stop failed');
  });

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: false })
  );
  expect(box.current.isRecording).toBe(false);
});

test('остановка отдаёт адрес, длительность и волну', async () => {
  const { box } = await mountHook();
  await startRecording(box);
  mockRecorder.getStatus.mockImplementation(() => ({
    isRecording: true,
    durationMillis: 14_400,
    metering: -30,
  }));
  await advance(14_400);

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded.uri).toBe('file:///cache/recording.m4a');
  expect(recorded.durationMillis).toBe(14_400);
  // 144 тика прорежены до 40 столбиков
  expect(recorded.waveform).toHaveLength(40);
});

test('рекордер без файла ничего не возвращает', async () => {
  mockRecorder.uri = null;
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded).toBeNull();
});

test('размонтирование во время записи снимает опрос', async () => {
  const { box, tree } = await mountHook();
  await startRecording(box);
  await act(async () => {
    tree.unmount();
  });
  const polls = mockRecorder.getStatus.mock.calls.length;

  await advance(METER_INTERVAL_MS * 5);

  expect(mockRecorder.getStatus.mock.calls.length).toBe(polls);
});
