/**
 * Проверка диалога импорта журнала
 *
 * У диалога четыре состояния, и перепутать их дорого: пользователь либо
 * ничего не поймёт, либо нажмёт «Заменить» там, где хотел копию. Поэтому
 * проверяется и то, что показано, и то, что вызывается по нажатию.
 *
 * Приём файла подменён: сам разбор проверяется в share/__tests__, а здесь
 * важна только разметка и то, какие действия к каким кнопкам привязаны.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';

import ImportProjectDialog from '../ImportProjectDialog';
import I18n from '../../Localization';
import { IMPORT_ERRORS } from '../../share/format';
import { MEASUREMENT_PHASES, OFR_TYPES, WELL_ROLES } from '../../db/schema';
import { lightTheme } from '../../theme';

// Язык задаётся явно: без этого набор проверяет ту локаль, которая
// оказалась системной у запускающего, и падает на чужой машине
const originalLocale = I18n.locale;
beforeAll(() => {
  I18n.locale = 'ru';
});
afterAll(() => {
  I18n.locale = originalLocale;
});

const mockImportState = {
  pending: null,
  busy: false,
  confirm: jest.fn(),
  openExisting: jest.fn(),
  dismiss: jest.fn(),
  openFromPicker: jest.fn(),
};

jest.mock('../../share/ImportContext', () => ({
  useImport: () => mockImportState,
}));

/**
 * Собирает строки из поддерева
 *
 * @param {Object} node - узел дерева
 * @returns {Array<string>} найденные строки
 */
function collectText(node) {
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node && node.props) return collectText(node.props.children);
  return [];
}

/**
 * Рисует диалог в заданном состоянии
 *
 * @param {Object} state - что лежит в контексте импорта
 * @returns {Object} корень отрисованного дерева
 */
function render(state) {
  Object.assign(mockImportState, {
    pending: null,
    busy: false,
    confirm: jest.fn(),
    openExisting: jest.fn(),
    dismiss: jest.fn(),
    ...state,
  });

  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <ImportProjectDialog />
      </PaperProvider>
    );
  });
  return tree.root;
}

/**
 * Склеивает весь видимый текст диалога
 *
 * @param {Object} root - корень дерева
 * @returns {string} текст через пробел
 */
function textOf(root) {
  return root
    .findAll((node) => typeof node.type === 'string' && node.type.includes('Text'))
    .flatMap((node) => collectText(node.props.children))
    .join(' ');
}

/**
 * Ищет кнопку по подписи
 *
 * @param {Object} root - корень дерева
 * @param {string} label - подпись кнопки
 * @returns {Object} узел, принимающий нажатие
 */
function buttonWith(root, label) {
  // Нажатие ищется по onPress, а не по роли: TouchableOpacity разворачивается
  // в несколько узлов, и роль есть в том числе у внутреннего View, у которого
  // обработчика уже нет
  const found = root.findAll(
    (node) =>
      typeof node.props?.onPress === 'function' &&
      collectText(node.props.children).join(' ').includes(label)
  );
  if (!found.length) throw new Error(`Кнопка «${label}» не найдена. Текст: ${textOf(root)}`);
  return found[0];
}

/** Содержимое файла с кустовой откачкой */
const payload = {
  sourceId: 'source-1',
  name: 'Куст №3',
  ofrType: OFR_TYPES.CLUSTER,
  Q: 518.4,
  pumpingDuration: 1440,
  finalDrawdown: 3.24,
  results: { T: 125.4, slope: 0.42, method: 'cooper-jacob' },
  createdAt: 1690000000000,
  wells: [
    { sourceId: 'w1', name: '1w', role: WELL_ROLES.PUMPING, distance: 0.1, finalDrawdown: 4.2, lat: null, lon: null, order: 0 },
    { sourceId: 'w2', name: '1p', role: WELL_ROLES.OBSERVATION, distance: 25, finalDrawdown: 0.8, lat: null, lon: null, order: 1 },
  ],
  measurements: [
    { t: 1, s: 0.35, phase: MEASUREMENT_PHASES.PUMPING, wellSourceId: 'w2', order: 0 },
    { t: 5, s: 0.71, phase: MEASUREMENT_PHASES.PUMPING, wellSourceId: 'w2', order: 1 },
    { t: 2, s: 0.4, phase: MEASUREMENT_PHASES.RECOVERY, wellSourceId: 'w2', order: 0 },
  ],
};

const summary = { wells: 2, pumping: 2, recovery: 1, total: 3 };

const readyState = {
  pending: {
    status: 'ready',
    payload,
    summary,
    meta: { formatVersion: 1, exportedAt: '2026-08-19T09:30:00.000Z', app: {} },
    existing: null,
    uri: 'file:///tmp/Куст №3.ansdimat',
  },
};

describe('пока нечего показывать', () => {
  it('диалога нет', () => {
    const root = render({ pending: null });
    expect(root.findAll((node) => node.props?.accessibilityRole === 'button')).toHaveLength(0);
  });
});

describe('чтение файла', () => {
  it('показывается ожидание без кнопок', () => {
    const root = render({ pending: { status: 'loading', uri: 'file:///tmp/a.ansdimat' } });

    expect(textOf(root)).toContain('Читаем файл');
    // Прервать чтение нечем, поэтому и кнопок быть не должно
    expect(root.findAll((node) => node.props?.accessibilityRole === 'button')).toHaveLength(0);
  });
});

describe('файл не принят', () => {
  it.each([
    [IMPORT_ERRORS.NOT_ANSDIMAT, 'не файл проекта'],
    [IMPORT_ERRORS.TOO_NEW, 'более новой версией'],
    [IMPORT_ERRORS.CORRUPTED, 'повреждён при передаче'],
    [IMPORT_ERRORS.INVALID, 'повреждён или заполнен не полностью'],
    [IMPORT_ERRORS.READ_FAILED, 'Не удалось прочитать файл'],
  ])('причина %s объясняется своими словами', (error, expected) => {
    const root = render({ pending: { status: 'error', error, uri: null } });

    expect(textOf(root)).toContain('Не удалось открыть файл');
    expect(textOf(root)).toContain(expected);
  });

  it('закрытие сбрасывает состояние', () => {
    const root = render({ pending: { status: 'error', error: IMPORT_ERRORS.CORRUPTED, uri: null } });

    act(() => buttonWith(root, 'Закрыть').props.onPress());
    expect(mockImportState.dismiss).toHaveBeenCalled();
  });
});

describe('файл разобран', () => {
  it('показывает, что именно приехало', () => {
    const text = textOf(render(readyState));

    expect(text).toContain('Импорт журнала');
    expect(text).toContain('Куст №3');
    // Скважины и обе фазы замеров — по ним видно, полон ли журнал
    expect(text).toContain('2');
    expect(text).toContain('1');
    expect(text).toContain('19.08.2026');
  });

  it('импорт заводит копию', () => {
    const root = render(readyState);

    act(() => buttonWith(root, 'Импортировать').props.onPress());
    expect(mockImportState.confirm).toHaveBeenCalledWith('copy');
  });

  it('отмена ничего не импортирует', () => {
    const root = render(readyState);

    act(() => buttonWith(root, 'Отмена').props.onPress());
    expect(mockImportState.dismiss).toHaveBeenCalled();
    expect(mockImportState.confirm).not.toHaveBeenCalled();
  });

  it('пока идёт запись, кнопки заблокированы', () => {
    const root = render({ ...readyState, busy: true });

    expect(buttonWith(root, 'Импортировать').props.disabled).toBe(true);
  });
});

describe('такой журнал уже есть', () => {
  const existingState = {
    pending: {
      ...readyState.pending,
      existing: { id: 'local-1', name: 'Куст №3', sourceId: 'source-1' },
    },
  };

  it('предлагает все три исхода, а не один', () => {
    const text = textOf(render(existingState));

    expect(text).toContain('Такой журнал уже есть');
    expect(text).toContain('Заменить существующий');
    expect(text).toContain('Создать копию');
    expect(text).toContain('Открыть имеющийся');
    // Обычной кнопки импорта здесь быть не должно: выбор осознанный
    expect(text).not.toContain('Импорт журнала');
  });

  it('замена и копия — разные действия', () => {
    const root = render(existingState);

    act(() => buttonWith(root, 'Заменить существующий').props.onPress());
    expect(mockImportState.confirm).toHaveBeenCalledWith('replace');

    act(() => buttonWith(root, 'Создать копию').props.onPress());
    expect(mockImportState.confirm).toHaveBeenCalledWith('copy');
  });

  it('открытие имеющегося ничего не импортирует', () => {
    const root = render(existingState);

    act(() => buttonWith(root, 'Открыть имеющийся').props.onPress());
    expect(mockImportState.openExisting).toHaveBeenCalled();
    expect(mockImportState.confirm).not.toHaveBeenCalled();
  });
});
