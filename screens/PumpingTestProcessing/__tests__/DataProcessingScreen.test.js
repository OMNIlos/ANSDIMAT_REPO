/**
 * Проверка экрана обработки целиком
 *
 * Здесь важна одна вещь, которую по частям не увидеть: доходит ли журнал
 * восстановления до полотна. Раньше он заполнялся, сохранялся и проверялся на
 * полноту, но точки в обеих фазах собирались из журнала откачки, и вторая
 * кривая не появлялась никогда.
 *
 * Жесты отсюда не проверить — RNGH под react-test-renderer событий не
 * порождает. Нажатия на обычные кнопки проверить можно: они идут через
 * onPress, а не через жест.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import I18n from '../../../Localization';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));

jest.mock('../../../db/projects', () => ({
  getProject: jest.fn(async () => ({
    id: 'p1',
    name: 'Опыт',
    ofrType: 'single',
    Q: 1000,
    pumpingDuration: 100,
    finalDrawdown: 5,
    wells: [],
    measurements: [
      { id: 'm1', t: 1, s: 1 },
      { id: 'm2', t: 10, s: 3 },
      { id: 'm3', t: 100, s: 5 },
    ],
    recoveryMeasurements: [
      { id: 'r1', t: 1, s: 0.5 },
      { id: 'r2', t: 10, s: 3 },
      { id: 'r3', t: 100, s: 4.8 },
    ],
  })),
  updateProject: jest.fn(async () => {}),
  replaceMeasurements: jest.fn(async () => {}),
  addMeasurement: jest.fn(async () => ({ id: 'new' })),
  deleteMeasurement: jest.fn(async () => {}),
}));
jest.mock('../../../db/wells', () => ({
  createWell: jest.fn(),
  deleteWell: jest.fn(),
  setWellDistance: jest.fn(),
  setWellPosition: jest.fn(async () => {}),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));
jest.mock('../../../components/FieldMap', () => 'FieldMap');
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn() }));

const DataProcessingScreen = require('../DataProcessingScreen').default;
const { UnitsProvider } = require('../../../UnitsContext');

beforeAll(() => {
  I18n.locale = 'ru';
});

/** Сколько узлов каждого типа в дереве */
const nodeTypes = (node, seen = []) => {
  if (!node || typeof node !== 'object') return seen;
  if (node.type) seen.push(node.type);
  for (const child of node.children ?? []) nodeTypes(child, seen);
  return seen;
};

const countCircles = (tree) =>
  nodeTypes(tree.toJSON()).filter((n) => n === 'RNSVGCircle').length;

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

/**
 * Нажимает кнопку с заданной подписью
 *
 * Ищется тот узел, у которого есть сам обработчик: у отрисованного
 * TouchableOpacity роль кнопки стоит на хост-элементе, а onPress остаётся
 * на составном выше.
 */
const press = async (tree, label) => {
  const target = tree.root
    .findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityRole === 'button' &&
        textOf(node).includes(label),
      { deep: true }
    )
    .pop();
  expect(target).toBeDefined();
  await act(async () => {
    target.props.onPress();
  });
};

// Размонтируем всё, что смонтировали: react-native-gesture-handler ставит
// setImmediate на обновление обработчика, и оставленное дерево дёргает его
// уже после разрушения окружения — воркер jest падает целиком
let mounted = [];
afterEach(async () => {
  await act(async () => {
    mounted.forEach((tree) => tree.unmount());
  });
  mounted = [];
});

const mount = async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <DataProcessingScreen
            route={{ params: { projectId: 'p1' } }}
            navigation={{}}
          />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

test('на откачке рисуется одна кривая', async () => {
  const tree = await mount();
  // Три замера журнала откачки
  expect(countCircles(tree)).toBe(3);
});

test('выбор фазы восстановления переводит расчёт на восстановление', async () => {
  // Выбрал восстановление — числа идут по восстановлению, и плоскость
  // становится той, на которой снимают наклон: s′ — lg(t/t′). Кривую откачки
  // в этих координатах не построить, у её замеров нет времени от остановки
  const tree = await mount();
  await press(tree, 'Восстановление');
  expect(countCircles(tree)).toBe(3);
});

test('на восстановлении на полотне только остаточное понижение', async () => {
  // Фазы не смешиваются: по абсциссе у откачки время от её начала, у
  // восстановления отношение t/t′. Раньше переключатель клал их на одни оси,
  // и шесть точек читались как одна зависимость, которой нет
  const tree = await mount();
  await press(tree, 'Восстановление');
  expect(countCircles(tree)).toBe(3);
});

/**
 * Нажимает кнопку по метке для экранного диктора
 *
 * Кнопки управления графиком подписаны значками, текста в них нет — искать
 * их приходится по accessibilityLabel.
 */
const pressLabel = async (tree, label) => {
  const target = tree.root
    .findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === label,
      { deep: true }
    )
    .pop();
  expect(target).toBeDefined();
  await act(async () => {
    target.props.onPress();
  });
};

test('разворот графика не разрушает список экрана', async () => {
  // Развёрнутый график рисовался вместо всего экрана, и прокрутка вместе со
  // списком уходила в небытие: возврат в обычный вид монтировал список
  // заново, то есть с самого верха. Список обязан пережить разворот —
  // иначе позицию прокрутки сохранять не в чем
  const { ScrollView } = require('react-native-gesture-handler');
  const tree = await mount();
  expect(tree.root.findAllByType(ScrollView).length).toBe(1);

  await pressLabel(tree, 'Развернуть график на весь экран');
  // Развёрнутый вид действительно открылся
  expect(
    tree.root.findAll(
      (node) => node.props?.accessibilityLabel === 'Свернуть график',
      { deep: true }
    ).length
  ).toBeGreaterThan(0);
  // …и открылся именно в Modal. Обычной накладкой поверх списка это не
  // сделать: экран лежит в карточке навигатора, а та на вебе выше окна и
  // сдвинута transform — и absolute, и fixed внутри неё уезжают вместе с
  // прокруткой, и график встаёт мимо экрана
  const { Modal } = require('react-native');
  expect(
    tree.root.findAllByType(Modal).filter((node) => node.props.visible).length
  ).toBe(1);
  // …и список экрана при этом остался смонтированным
  expect(tree.root.findAllByType(ScrollView).length).toBe(1);
  expect(textOf(tree.root)).toContain('Опыт');
});

test('на время разворота место графика в списке сохраняет высоту', async () => {
  // Иначе список бы укоротился на весь график, прокрутка съехала бы к новому
  // концу, и возврат в обычный вид показывал бы уже не то место
  const tree = await mount();
  // Первый узел с onLayout в порядке дерева — обёртка места графика:
  // остальные лежат внутри самого графика, то есть ниже
  const slot = () =>
    tree.root.findAll((node) => typeof node.props?.onLayout === 'function', {
      deep: true,
    })[0];
  expect(slot().props.style).toBeNull();

  await act(async () => {
    slot().props.onLayout({ nativeEvent: { layout: { width: 300, height: 420 } } });
  });
  await pressLabel(tree, 'Развернуть график на весь экран');
  expect(slot().props.style).toEqual({ height: 420 });

  await pressLabel(tree, 'Свернуть график');
  expect(slot().props.style).toBeNull();
});
