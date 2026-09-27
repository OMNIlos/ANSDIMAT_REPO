/**
 * Построитель карт в WebView
 *
 * Здесь проверяется то, что задаёт приложение, а не страница: системные
 * индикаторы прокрутки WebView выключены — полосы справа быть не должно.
 */

import React from 'react';
import { ActivityIndicator } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';

jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('../anssurfAsset', () => ({
  anssurfPageUri: jest.fn(async () => 'file:///android_asset/anssurf/gidroizogipsy.html'),
}));
jest.mock('../../share/anssurfExport', () => ({ saveAnsSurfExport: jest.fn() }));

const AnsSurf = require('../AnsSurf').default;

test('системные индикаторы прокрутки у WebView выключены', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <AnsSurf locale="ru" dark={false} menuInset={24} />
      </PaperProvider>
    );
  });

  const web = tree.root.findByType('WebView');
  expect(web.props.showsVerticalScrollIndicator).toBe(false);
  expect(web.props.showsHorizontalScrollIndicator).toBe(false);
});

/** Монтирует построитель и дожидается адреса страницы */
const mount = async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <AnsSurf locale="ru" dark={false} menuInset={24} />
      </PaperProvider>
    );
  });
  return tree;
};

const veiled = (tree) => tree.root.findAllByType(ActivityIndicator).length > 0;

test('мост к странице ставится и после её загрузки', async () => {
  // На Android скрипт «до загрузки» react-native-webview выполняет из
  // onPageStarted асинхронно, и тот то и дело попадает в прежний, пустой
  // документ: сигнал готовности не приходил, и карты открывались раз из десяти
  const web = (await mount()).root.findByType('WebView');

  expect(web.props.injectedJavaScript).toContain('__ansdHostReply');
  expect(web.props.injectedJavaScript).toBe(web.props.injectedJavaScriptBeforeContentLoaded);
});

test('сигнал готовности от страницы снимает заглушку', async () => {
  const tree = await mount();
  expect(veiled(tree)).toBe(true);

  act(() => {
    tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: '{"type":"ready"}' } });
  });

  expect(veiled(tree)).toBe(false);
});

test('после загрузки заглушка снимается, даже если сигнал так и не пришёл', async () => {
  jest.useFakeTimers();
  try {
    const tree = await mount();

    act(() => {
      tree.root.findByType('WebView').props.onLoadEnd({ nativeEvent: {} });
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Лучше мелькнёт не та тема, чем экран навсегда останется с кружком
    expect(veiled(tree)).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

test('сигнал о работе на карте уходит экрану', async () => {
  const onWorkChange = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <AnsSurf locale="ru" dark={false} onWorkChange={onWorkChange} />
      </PaperProvider>
    );
  });
  const send = (data) =>
    act(async () => {
      await tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data } });
    });

  await send('{"type":"work","has":true}');
  await send('{"type":"work","has":false}');

  expect(onWorkChange.mock.calls).toEqual([[true], [false]]);
});
