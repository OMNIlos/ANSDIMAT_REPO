/**
 * Съёмка снимка для точки
 *
 * Снимок делается системной камерой: она отдаёт вспышку, фокус, HDR и зум
 * бесплатно и в привычном виде. Галерея нужна не меньше — часть снимков
 * делают до того, как поставят точку.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///cache/IMG_0001.jpg' }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///cache/IMG_0042.jpg' }],
  })),
}));

const ImagePicker = require('expo-image-picker');
const usePhotoCapture = require('../usePhotoCapture').default;
const { PHOTO_QUALITY } = require('../usePhotoCapture');

/** Поднимает хук и отдаёт его текущее значение */
function mountHook() {
  const box = {};
  function Probe() {
    box.current = usePhotoCapture();
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
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
});

test('камера возвращает адрес снимка', async () => {
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('camera');
  });

  expect(uri).toBe('file:///cache/IMG_0001.jpg');
  expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
});

test('галерея открывается своим пикером', async () => {
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('library');
  });

  expect(uri).toBe('file:///cache/IMG_0042.jpg');
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});

test('снимок сжимается — иначе десяток точек съедает полгигабайта', async () => {
  const { box } = mountHook();

  await act(async () => {
    await box.current.capture('camera');
  });

  expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
    expect.objectContaining({ quality: PHOTO_QUALITY, allowsEditing: false })
  );
  expect(PHOTO_QUALITY).toBeLessThan(1);
});

test('отказ в доступе к камере запоминается, а пикер не открывается', async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('camera');
  });

  expect(uri).toBeNull();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(box.current.denied).toBe('camera');
});

test('отмена съёмки ничего не возвращает', async () => {
  ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('camera');
  });

  expect(uri).toBeNull();
  // Отмена — не отказ в доступе, плашку показывать не за что
  expect(box.current.denied).toBeNull();
});

test('удачная съёмка снимает прежнюю плашку отказа', async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = mountHook();
  await act(async () => {
    await box.current.capture('camera');
  });
  expect(box.current.denied).toBe('camera');

  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  await act(async () => {
    await box.current.capture('camera');
  });

  expect(box.current.denied).toBeNull();
});
