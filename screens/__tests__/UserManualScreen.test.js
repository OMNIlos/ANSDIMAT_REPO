/**
 * Руководство пользователя: новые разделы и полнота перевода
 *
 * В приложение добавили виды ОФР, диагностику, карты гидроизогипс, обмен
 * журналами — руководство о них молчало. Отдельно проверяется английская
 * версия: у каждой строки руководства есть русский текст по умолчанию, и
 * забытый перевод не упал бы, а тихо показал бы англоязычному пользователю
 * русский абзац.
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

const UserManualScreen = require('../UserManualScreen').default;

const mount = (locale) => {
  I18n.locale = locale;
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UserManualScreen />
      </PaperProvider>
    );
  });
  return tree;
};

const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.props?.children === 'string', { deep: true })
    .map((node) => node.props.children);

/** Заголовки разделов — кнопки со свойством expanded */
const sectionHeads = (tree) =>
  tree.root.findAll(
    (node) =>
      node.props?.accessibilityState &&
      'expanded' in node.props.accessibilityState &&
      typeof node.props.onPress === 'function'
  );

/** Раскрывает разделы по одному и собирает весь текст руководства */
const allText = (tree) => {
  const seen = new Set(texts(tree));
  const titles = [...new Set(sectionHeads(tree).map((head) => head.props.accessibilityLabel))];
  titles.forEach((title) => {
    const head = sectionHeads(tree).find((node) => node.props.accessibilityLabel === title);
    if (!head.props.accessibilityState.expanded) {
      act(() => head.props.onPress());
    }
    texts(tree).forEach((text) => seen.add(text));
  });
  return [...seen];
};

test('в руководстве есть разделы о новых блоках приложения', () => {
  const tree = mount('ru');

  const titles = sectionHeads(tree).map((head) => head.props.accessibilityLabel);
  [
    'Журналы и архив откачек',
    'Диагностика режима',
    'Кустовая откачка',
    'Экспресс-опробование',
    'Поинтервальное нагнетание',
    'Налив в шурф',
    'Карты гидроизогипс',
    'Обмен журналами',
    'Настройки',
  ].forEach((title) => expect(titles).toContain(title));
});

test('в руководстве нет «Вписать» и наклона под буквой a — так было в старой версии', () => {
  const text = allText(mount('ru')).join(' ');

  expect(text).not.toContain('«Вписать»');
  expect(text).toContain('Пьезопроводность, м²/сут');
  expect(text).toContain('Наклон прямой, м на логарифмический цикл');
});

test('английское руководство переведено целиком', () => {
  const cyrillic = allText(mount('en')).filter((text) => /[А-Яа-яЁё]/.test(text));

  expect(cyrillic).toEqual([]);
});
