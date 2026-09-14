/**
 * Построитель карт в iframe веб-сборки
 *
 * У iframe не должно быть атрибута title: браузер показывает его всплывающей
 * подсказкой «AnsSurf» везде, где стоит курсор, — поверх кнопки «назад» и
 * вкладок шагов. Имя для экранного диктора остаётся в aria-label.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';

jest.mock('../anssurfAsset', () => ({
  anssurfPageUri: jest.fn(async () => '/assets/anssurf/gidroizogipsy.html'),
}));

const AnsSurf = require('../AnsSurf.web').default;

test('у iframe нет всплывающей подсказки, но есть имя для диктора', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <AnsSurf locale="ru" dark={false} menuInset={12} />
      </PaperProvider>
    );
  });

  const frame = tree.root.findByType('iframe');
  expect(frame.props.title).toBeUndefined();
  expect(frame.props['aria-label']).toBe('AnsSurf');
});
