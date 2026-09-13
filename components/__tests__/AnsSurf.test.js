/**
 * Построитель карт в WebView
 *
 * Здесь проверяется то, что задаёт приложение, а не страница: системные
 * индикаторы прокрутки WebView выключены — полосы справа быть не должно.
 */

import React from 'react';
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
