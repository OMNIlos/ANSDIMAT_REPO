/**
 * Переход с плитки «Архив откачек»
 *
 * Плитка на главной ведёт на тот же экран, что «Создать откачку», но
 * прокручивает его сразу к ранее созданным журналам. Обычный вход с
 * «Создать откачку» остаётся на форме нового журнала.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ScrollView } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme, spacing } from '../../../theme';
import I18n from '../../../Localization';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));
jest.mock('../../../db/projects', () => ({
  listProjects: jest.fn(async () => [
    { id: 'p1', name: 'Скв. 7', ofrType: 'single', createdAt: 1, measurementsCount: 12 },
  ]),
  createProject: jest.fn(async () => ({ id: 'created' })),
  deleteProject: jest.fn(async () => {}),
  toggleStarred: jest.fn(async () => {}),
  getProject: jest.fn(async () => null),
}));
jest.mock('../../../share/exportProject', () => ({
  shareProjectFile: jest.fn(async () => {}),
}));
jest.mock('../../../share/ImportContext', () => ({
  useImport: () => ({ openFromPicker: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));

const ProjectsScreen = require('../ProjectsScreen').default;
const { UnitsProvider } = require('../../../UnitsContext');

/** Где заголовок списка стоит на экране в этих тестах, px */
const HEADER_Y = 640;

beforeAll(() => {
  I18n.locale = 'ru';
});

let mounted = [];
afterEach(async () => {
  await act(async () => {
    mounted.forEach((tree) => tree.unmount());
  });
  mounted = [];
});

/**
 * Монтирует экран, отдаёт замер заголовка и смену высоты содержимого
 *
 * @param {Object} [params] - параметры маршрута
 * @returns {Promise<{scrollTo: Function, setParams: Function}>}
 */
const mount = async (params) => {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <ProjectsScreen navigation={navigation} route={{ params }} />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);

  const scroll = tree.root.findByType(ScrollView);
  // Заглушка ScrollView из react-native держит scrollTo одним jest.fn на
  // прототипе: spyOn отдаёт его же, и вызовы копятся между тестами
  const scrollTo = jest.spyOn(scroll.instance, 'scrollTo').mockImplementation(() => {});
  scrollTo.mockClear();

  // Заголовок списка — тот блок с замером, внутри которого «Ранее созданные»
  const saysArchive = (node) =>
    node.findAll((inner) =>
      [].concat(inner.props?.children).some(
        (child) => typeof child === 'string' && child.includes('Ранее созданные')
      )
    ).length > 0;
  const header = tree.root
    .findAll((node) => typeof node.props.onLayout === 'function')
    .find(saysArchive);

  await act(async () => {
    header.props.onLayout({ nativeEvent: { layout: { x: 0, y: HEADER_Y, width: 360, height: 40 } } });
    scroll.props.onContentSizeChange(360, 1600);
  });

  return { scrollTo, setParams: navigation.setParams };
};

test('с плитки «Архив откачек» экран открывается на списке журналов', async () => {
  const { scrollTo, setParams } = await mount({ focus: 'archive' });

  expect(scrollTo).toHaveBeenCalledWith({ y: HEADER_Y - spacing.md, animated: true });
  // Параметр гасится, чтобы возврат из журнала не перематывал экран снова
  expect(setParams).toHaveBeenCalledWith({ focus: undefined });
});

test('с «Создать откачку» экран остаётся на форме нового журнала', async () => {
  const { scrollTo } = await mount(undefined);

  expect(scrollTo).not.toHaveBeenCalled();
});

test('у кнопок-значков в строке журнала есть подписи для диктора', async () => {
  // «Звёздочка» была без подписи: диктор читал её просто «кнопка»
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <ProjectsScreen navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{}} />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);

  const star = tree.root.find(
    (node) =>
      typeof node.props?.onPress === 'function' &&
      'selected' in (node.props?.accessibilityState ?? {}) &&
      node.props?.accessibilityRole === 'button'
  );

  expect(star.props.accessibilityLabel).toBe(I18n.t('favoriteProject'));
});
