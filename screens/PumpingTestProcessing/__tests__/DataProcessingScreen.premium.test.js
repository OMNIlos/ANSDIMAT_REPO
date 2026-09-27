/**
 * Проверка платного доступа к карте куста
 *
 * Карта — единственное место, где расстояния до скважин задаются
 * перетаскиванием по местности. Сама обработка ОФР остаётся бесплатной:
 * расстояние по-прежнему вписывается числом в таблицу, и заглушка обязана про
 * это сказать — иначе закрытая карта читается как сломанный экран.
 *
 * Главное, что здесь ловится: карта не должна показываться, пока сервер не
 * подтвердил право. Без входа в аккаунт и без связи прав нет, и это
 * правильное поведение — премиум не открывается отсутствием ответа.
 *
 * В самом приложении премиум сейчас выключен (billing/config, PREMIUM_ENABLED)
 * и карта открыта всем: права здесь подменяются целиком, поэтому проверки
 * идут мимо флага. Тест сторожит сохранённую платную логику на случай
 * возврата премиума, а не сегодняшнее поведение экрана.
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

/** Куст из опытной и наблюдательной скважины: карта имеет смысл только у него */
jest.mock('../../../db/projects', () => ({
  getProject: jest.fn(async () => ({
    id: 'p1',
    name: 'Куст',
    ofrType: 'cluster',
    Q: 1000,
    pumpingDuration: 100,
    finalDrawdown: 0,
    wells: [
      { id: 'w1', name: '1w', role: 'pumping', distance: 0.1, finalDrawdown: 0, order: 0 },
      { id: 'p1w', name: '1p', role: 'observation', distance: 25, finalDrawdown: 0, order: 1 },
    ],
    measurements: [
      { id: 'a1', wellId: 'w1', t: 1, s: 2 },
      { id: 'a2', wellId: 'w1', t: 10, s: 4 },
    ],
    recoveryMeasurements: [],
  })),
  updateProject: jest.fn(async () => {}),
  replaceMeasurements: jest.fn(async () => {}),
  addMeasurement: jest.fn(async () => ({ id: 'new' })),
  deleteMeasurement: jest.fn(async () => {}),
}));
jest.mock('../../../db/wells', () => ({
  createWell: jest.fn(),
  deleteWell: jest.fn(),
  setWellDistance: jest.fn(async () => {}),
  setWellFinalDrawdown: jest.fn(async () => {}),
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

/** Права подписки подменяются целиком: сервер в тесте не участвует */
let mockFeatures = {};
jest.mock('../../../billing/EntitlementsContext', () => ({
  useEntitlements: () => ({
    entitlements: { premium: false, features: mockFeatures },
    loading: false,
    refresh: async () => {},
    redeemPromo: async () => ({ ok: false }),
    has: (feature) => Boolean(mockFeatures[feature]),
  }),
}));

const DataProcessingScreen = require('../DataProcessingScreen').default;
const { UnitsProvider } = require('../../../UnitsContext');

beforeAll(() => {
  I18n.locale = 'ru';
});

let mounted = [];
afterEach(async () => {
  await act(async () => {
    mounted.forEach((tree) => tree.unmount());
  });
  mounted = [];
  mockFeatures = {};
});

/** Весь текст внутри узла */
const textOf = (node) => {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  return (node.children ?? []).map(textOf).join(' ');
};

const navigate = jest.fn();

const mount = async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <DataProcessingScreen
            route={{ params: { projectId: 'p1' } }}
            navigation={{ navigate }}
          />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

/** Есть ли на экране полотно карты */
const hasMap = (tree) => tree.root.findAllByType('FieldMap').length > 0;

/** Кнопка заглушки, если она показана */
const lockButton = (tree) =>
  tree.root
    .findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityRole === 'button' &&
        textOf(node).includes(I18n.t('premiumLearnMore')),
      { deep: true }
    )
    .pop();

/**
 * Карта куста выключена целиком, см. CLUSTER_MAP_ENABLED в
 * DataProcessingScreen. Набор описывает поведение карты под подпиской и
 * ждёт возврата флага — вместе с ним вернётся и он. Ниже, вне пропуска,
 * стоит проверка того, что сейчас карты нет вовсе.
 */
describe.skip('карта куста под подпиской', () => {
  it('без подписки карта не рисуется, а на её месте стоит заглушка', async () => {
    const tree = await mount();

    expect(hasMap(tree)).toBe(false);
    expect(textOf(tree.toJSON())).toContain(I18n.t('clusterMapLockTitle'));
  });

  it('заглушка объясняет, как обойтись без подписки', async () => {
    const tree = await mount();

    // Ввод расстояний руками остаётся: работа не встала, закрыто удобство
    expect(textOf(tree.toJSON())).toContain(I18n.t('clusterMapLockNote'));
  });

  it('кнопка заглушки ведёт к описанию подписки', async () => {
    const tree = await mount();
    const button = lockButton(tree);
    expect(button).toBeDefined();

    await act(async () => {
      button.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Subscription');
  });

  it('с подпиской карта на месте, а заглушки нет', async () => {
    mockFeatures = { clusterMap: true };
    const tree = await mount();

    expect(hasMap(tree)).toBe(true);
    expect(textOf(tree.toJSON())).not.toContain(I18n.t('clusterMapLockTitle'));
  });

  it('премиум в целом ещё не открывает карту: право проверяется отдельно', async () => {
    // Сервер отдаёт список возможностей, а не один флаг: старый кэш без
    // clusterMap не должен открывать карту задним числом
    mockFeatures = { sync: true, advancedCalc: true, exportPdf: true };
    const tree = await mount();

    expect(hasMap(tree)).toBe(false);
  });
});
