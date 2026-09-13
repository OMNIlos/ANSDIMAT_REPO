/**
 * Проигрывание голосовых заметок
 *
 * Один плеер на шторку: нажатие по заметке ставит её в плеер или ставит на
 * паузу, окончание возвращает к началу, остановка глушит звук.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const mockPlayer = {
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(async () => {}),
};
let mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

const { setAudioModeAsync, useAudioPlayer } = require('expo-audio');
const useVoicePlayback = require('../useVoicePlayback').default;

const FIRST = { id: 'a1', uri: 'file:///d/a1.m4a' };
const SECOND = { id: 'a2', uri: 'file:///d/a2.m4a' };

const box = {};
function Probe() {
  box.current = useVoicePlayback();
  return <Text>probe</Text>;
}

/**
 * Поднимает пробу
 *
 * @returns {Promise<Object>} дерево react-test-renderer
 */
async function mount() {
  let tree;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  return tree;
}

/**
 * Плеер прислал новый статус
 *
 * @param {Object} tree - дерево пробы
 * @param {Object} next - изменившиеся поля статуса
 */
async function status(tree, next) {
  mockStatus = { ...mockStatus, ...next };
  await act(async () => {
    tree.update(<Probe />);
  });
}

/**
 * Нажатие по заметке
 *
 * @param {Object} record - заметка
 */
async function press(record) {
  await act(async () => {
    await box.current.toggle(record);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
});

test('плеер один и заводится без источника', async () => {
  await mount();

  expect(useAudioPlayer).toHaveBeenCalledWith(null);
});

test('нажатие по заметке ставит её в плеер и играет в беззвучном режиме', async () => {
  await mount();

  await press(FIRST);

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ playsInSilentMode: true, allowsRecording: false })
  );
  expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: FIRST.uri });
  expect(mockPlayer.play).toHaveBeenCalled();
  expect(box.current.activeId).toBe('a1');
});

test('повторное нажатие по играющей заметке ставит паузу', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: true });
  mockPlayer.replace.mockClear();

  await press(FIRST);

  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(mockPlayer.replace).not.toHaveBeenCalled();
});

test('нажатие по заметке на паузе продолжает её с того же места', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: false, currentTime: 3, duration: 10 });
  mockPlayer.play.mockClear();

  await press(FIRST);

  expect(mockPlayer.play).toHaveBeenCalled();
  expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
});

test('нажатие по другой заметке меняет источник', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: true });

  await press(SECOND);

  expect(mockPlayer.replace).toHaveBeenLastCalledWith({ uri: SECOND.uri });
  expect(box.current.activeId).toBe('a2');
});

test('прогресс — доля проигранного', async () => {
  const tree = await mount();
  await press(FIRST);

  await status(tree, { playing: true, currentTime: 5, duration: 20 });

  expect(box.current.progress).toBe(0.25);
  expect(box.current.playing).toBe(true);
});

test('окончание ставит на паузу и возвращает к началу', async () => {
  // Без возврата повторное нажатие не проиграло бы ничего: плеер стоит в конце
  const tree = await mount();
  await press(FIRST);

  await status(tree, { playing: false, currentTime: 20, duration: 20, didJustFinish: true });

  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  expect(box.current.activeId).toBeNull();
});

test('остановка глушит заметку и снимает её с плеера', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: true });

  act(() => {
    box.current.stop();
  });

  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(box.current.activeId).toBeNull();
});

test('остановка без играющей заметки плеер не трогает', async () => {
  await mount();

  act(() => {
    box.current.stop();
  });

  expect(mockPlayer.pause).not.toHaveBeenCalled();
});
