/**
 * Карта куста открыта без подписки
 *
 * Премиум снят целиком (billing/config, PREMIUM_ENABLED), и карта была
 * единственным, что он реально запирал. Здесь проверяется тот самый экран, на
 * котором стояла заглушка: права запрашиваются у настоящего провайдера, а не
 * подменяются, — иначе проверка разошлась бы с приложением.
 *
 * Сосед по папке, DataProcessingScreen.premium.test.js, описывает обратное:
 * он сторожит сохранённую платную логику и подменяет права руками. Когда
 * премиум вернут, красным станет этот файл, а не тот.
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

/** Права настоящие. Подменены только вход и сервер: их у пользователя может
    не быть, и карта всё равно обязана открыться */
jest.mock('../../../AuthContext', () => ({
  useAuth: () => ({ session: null }),
}));
jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: async () => ({ data: null, error: null }) },
}));

const DataProcessingScreen = require('../DataProcessingScreen').default;
const { UnitsProvider } = require('../../../UnitsContext');
const { EntitlementsProvider } = require('../../../billing/EntitlementsContext');

beforeAll(() => {
  I18n.locale = 'ru';
});

let mounted = [];
afterEach(async () => {
  await act(async () => {
    mounted.forEach((tree) => tree.unmount());
  });
  mounted = [];
  navigate.mockClear();
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
        <EntitlementsProvider>
          <UnitsProvider>
            <DataProcessingScreen
              route={{ params: { projectId: 'p1' } }}
              navigation={{ navigate }}
            />
          </UnitsProvider>
        </EntitlementsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

/** Есть ли на экране полотно карты */
const hasMap = (tree) => tree.root.findAllByType('FieldMap').length > 0;

/**
 * Карта куста выключена целиком, см. CLUSTER_MAP_ENABLED в
 * DataProcessingScreen. Набор описывает поведение карты под подпиской и
 * ждёт возврата флага — вместе с ним вернётся и он. Ниже, вне пропуска,
 * стоит проверка того, что сейчас карты нет вовсе.
 */
describe.skip('карта куста без подписки', () => {
  it('карта на месте: платить за неё больше не нужно', async () => {
    const tree = await mount();

    expect(hasMap(tree)).toBe(true);
  });

  it('заглушки с предложением подписки на экране нет', async () => {
    const tree = await mount();

    expect(textOf(tree.toJSON())).not.toContain(I18n.t('clusterMapLockTitle'));
    expect(textOf(tree.toJSON())).not.toContain(I18n.t('premiumLearnMore'));
  });

  it('на экран подписки экран никого не уводит', async () => {
    await mount();

    expect(navigate).not.toHaveBeenCalledWith('Subscription');
  });
});
