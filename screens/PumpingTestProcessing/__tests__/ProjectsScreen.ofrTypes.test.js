/**
 * Проверка списка видов ОФР и маршрутизации по ним
 *
 * Список видов — то, с чего начинается любой журнал, и ошибка в нём стоит
 * дороже всего: заведённый не тем видом журнал придётся заводить заново.
 * Здесь проверяется, что в списке ровно пять нужных видов, что убранные
 * «Налив» и «Восстановление» в него не вернулись, и что журнал каждого вида
 * открывается на своём экране.
 *
 * Отдельно — что убранные виды продолжают открываться: они остались у людей
 * в базе и в присланных файлах, и терять их замеры нельзя.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import I18n from '../../../Localization';
import { OFR_TYPES, LEGACY_OFR_TYPES } from '../../../db/schema';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));

let mockProjects = [];

jest.mock('../../../db/projects', () => ({
  listProjects: jest.fn(async () => mockProjects),
  createProject: jest.fn(async ({ name, ofrType }) => ({
    id: 'created',
    name,
    ofrType,
  })),
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
const { OFR_OPTIONS, routeFor } = require('../ProjectsScreen');
const { UnitsProvider } = require('../../../UnitsContext');
const { createProject } = require('../../../db/projects');

beforeAll(() => {
  I18n.locale = 'ru';
});

beforeEach(() => {
  mockProjects = [];
  createProject.mockClear();
});

/**
 * Весь текст внутри узла
 *
 * Обходом по children, а не через JSON: в пропсах узлов лежат провайдеры
 * контекста, и сериализация упирается в круговую ссылку.
 */
const textOf = (node) => {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children ?? []).map(textOf).join(' ');
};

let mounted = [];
afterEach(async () => {
  await act(async () => {
    mounted.forEach((tree) => tree.unmount());
  });
  mounted = [];
});

/**
 * Монтирует экран списка
 *
 * @param {Function} navigate - обработчик перехода
 * @returns {Promise<Object>} дерево рендера
 */
const mount = async (navigate = jest.fn()) => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <ProjectsScreen navigation={{ navigate }} />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

describe('список видов ОФР', () => {
  test('содержит ровно пять видов, и это они', () => {
    expect(OFR_OPTIONS.map((option) => option.key)).toEqual([
      OFR_TYPES.SINGLE,
      OFR_TYPES.CLUSTER,
      OFR_TYPES.SLUG,
      OFR_TYPES.LUGEON,
      OFR_TYPES.VADOSE,
    ]);
  });

  test('убранные виды в него не вернулись', () => {
    const keys = OFR_OPTIONS.map((option) => option.key);
    expect(keys).not.toContain(LEGACY_OFR_TYPES.FILL);
    expect(keys).not.toContain(LEGACY_OFR_TYPES.RECOVERY);
  });

  test('у каждого вида есть название на обоих языках', () => {
    for (const locale of ['ru', 'en']) {
      I18n.locale = locale;
      for (const option of OFR_OPTIONS) {
        const label = I18n.t(option.labelKey);
        expect(label).not.toBe(option.labelKey);
        expect(label.length).toBeGreaterThan(0);
      }
    }
    I18n.locale = 'ru';
  });

  test('у убранных видов остались названия — для прежних журналов', () => {
    // Ключ перевода пропал бы вместе с видом, и в списке журналов вместо
    // названия стояло бы сырое «fill»
    expect(I18n.t('ofr_fill')).not.toBe('ofr_fill');
    expect(I18n.t('ofr_recovery')).not.toBe('ofr_recovery');
  });

  test('экран со списком журналов открывается', async () => {
    mockProjects = [
      {
        id: 'p1',
        name: 'Пакер 12',
        ofrType: OFR_TYPES.LUGEON,
        createdAt: Date.now(),
        measurementsCount: 0,
        starred: false,
        results: { T: null },
      },
    ];
    const tree = await mount();
    const text = textOf(tree.toJSON());
    expect(text).toContain('Пакер 12');
    // Вид журнала подписан названием, а не ключом
    expect(text).toContain(I18n.t('ofr_lugeon'));
  });
});

describe('переход в журнал', () => {
  test('каждый вид ОФР ведёт на свой экран', () => {
    expect(routeFor(OFR_TYPES.SLUG)).toBe('SlugTest');
    expect(routeFor(OFR_TYPES.LUGEON)).toBe('LugeonTest');
    expect(routeFor(OFR_TYPES.VADOSE)).toBe('VadoseFill');
  });

  test('откачки идут на общий экран обработки', () => {
    expect(routeFor(OFR_TYPES.SINGLE)).toBe('DataProcessing');
    expect(routeFor(OFR_TYPES.CLUSTER)).toBe('DataProcessing');
  });

  test('журналы прежних видов тоже открываются — на общем экране', () => {
    // Их не заводят заново, но заведённые раньше обязаны открыться там же,
    // где обрабатывались
    expect(routeFor(LEGACY_OFR_TYPES.RECOVERY)).toBe('DataProcessing');
    expect(routeFor(LEGACY_OFR_TYPES.FILL)).toBe('DataProcessing');
  });

  test('неизвестный вид не роняет переход', () => {
    // Журнал из будущей версии: лучше открыть общим экраном, чем никаким
    expect(routeFor('somethingNew')).toBe('DataProcessing');
    expect(routeFor(undefined)).toBe('DataProcessing');
  });
});
