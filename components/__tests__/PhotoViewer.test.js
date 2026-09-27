/**
 * Полноэкранный просмотр снимка
 *
 * Миниатюра в шторке показывает, что снимок есть, но не показывает, что на
 * нём: разглядеть по ней оголовок скважины нельзя.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';
import PhotoViewer from '../PhotoViewer';

const PHOTOS = [
  { id: 'a1', kind: 'photo', uri: 'file:///documents/attachments/a1.jpg' },
  { id: 'a2', kind: 'photo', uri: 'file:///documents/attachments/a2.jpg' },
];

beforeAll(() => {
  I18n.locale = 'ru';
});

// React 19: renderer.create() надо оборачивать в act(), иначе тест-рендерер
// считается размонтированным ещё до первой проверки (см. другие тесты в
// components/__tests__ — та же обёртка везде)
const mount = (props) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <PhotoViewer
          photos={PHOTOS}
          initialIndex={0}
          visible
          onClose={() => {}}
          onDelete={() => {}}
          {...props}
        />
      </PaperProvider>
    );
  });
  return tree;
};

/** Кнопка по её метке доступности */
const button = (tree, label) =>
  tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      node.props?.accessibilityLabel === label
  );

test('показывает все снимки — между ними свайпают', () => {
  const tree = mount();

  const images = tree.root.findAllByType(Image);
  expect(images.map((image) => image.props.source.uri)).toEqual([
    'file:///documents/attachments/a1.jpg',
    'file:///documents/attachments/a2.jpg',
  ]);
});

test('закрытие сообщает наружу', () => {
  const onClose = jest.fn();
  const tree = mount({ onClose });

  act(() => {
    button(tree, 'Закрыть снимок').props.onPress();
  });

  expect(onClose).toHaveBeenCalled();
});

test('удаление отдаёт наружу тот снимок, что открыт', () => {
  const onDelete = jest.fn();
  const tree = mount({ onDelete, initialIndex: 1 });

  act(() => {
    button(tree, 'Удалить').props.onPress();
  });

  expect(onDelete).toHaveBeenCalledWith(PHOTOS[1]);
});

test('пустой список не роняет просмотр', () => {
  // Последний снимок могли удалить, пока просмотр открыт
  const tree = mount({ photos: [] });

  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});
