/**
 * Проверка экранов ОФР со своей расчётной схемой
 *
 * Расчёты покрыты отдельно в `calc/`, поэтому здесь важно другое: доходит ли
 * посчитанное до экрана и в тех ли размерностях. Экран стоит между базовыми
 * единицами базы и выбранными пользователем, и ошибка перевода в нём не
 * ловится ни одним тестом формулы — число просто выходит на порядок меньше.
 *
 * Контрольные числа те же, что в тестах расчётов: отчёты настольного
 * АНСДИМАТ по наливу в шурф (k = 0.1661538 м/сут) и по методу Люжона
 * (среднее Lu = 4.917916).
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

// Журнал, который отдаёт база; подменяется в каждом наборе тестов.
// Приставка `mock` обязательна: фабрика jest.mock не видит других
// переменных модуля
let mockProject = null;

jest.mock('../../../db/projects', () => ({
  getProject: jest.fn(async () => mockProject),
  updateProject: jest.fn(async () => {}),
  replaceMeasurements: jest.fn(async () => {}),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));

const SlugTestScreen = require('../SlugTestScreen').default;
const { FIT_MODES } = require('../../../components/DrawdownChart');
const LugeonScreen = require('../LugeonScreen').default;
const VadoseFillScreen = require('../VadoseFillScreen').default;
const { UnitsProvider } = require('../../../UnitsContext');
const { updateProject, replaceMeasurements } = require('../../../db/projects');

beforeAll(() => {
  I18n.locale = 'ru';
});

beforeEach(() => {
  updateProject.mockClear();
  replaceMeasurements.mockClear();
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
 * Монтирует экран с журналом из `mockProject`
 *
 * @param {Function} Screen - компонент экрана
 * @returns {Promise<Object>} дерево рендера
 */
const mount = async (Screen) => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <Screen route={{ params: { projectId: 'p1' } }} navigation={{}} />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  mounted.push(tree);
  return tree;
};

/** Текст всего экрана одной строкой */
const screenText = (tree) => textOf(tree.toJSON());

/** Сколько точек на графике */
const countCircles = (tree) => {
  const walk = (node, seen = []) => {
    if (!node || typeof node !== 'object') return seen;
    if (node.type) seen.push(node.type);
    for (const child of node.children ?? []) walk(child, seen);
    return seen;
  };
  return walk(tree.toJSON()).filter((type) => type === 'RNSVGCircle').length;
};

describe('Налив в шурф', () => {
  beforeEach(() => {
    mockProject = {
      id: 'p1',
      name: 'Шурф 3',
      ofrType: 'vadose',
      measurements: [],
      recoveryMeasurements: [],
      wells: [],
      // Контрольный пример: 3 л за 10 мин, шурф 2.5 м², слой 0.1 м,
      // просачивание 10 м, капиллярное поднятие 0.3 м
      params: {
        volume: 0.003,
        interval: 10,
        flow: 0,
        area: 2.5,
        head: 0.1,
        depth: 10,
        capillary: 0.3,
        useCapillary: true,
        lithologyId: null,
      },
    };
  });

  test('показывает k контрольного примера', async () => {
    const tree = await mount(VadoseFillScreen);
    // 0.1661538 м/сут, формат результата — четыре значащие цифры
    expect(screenText(tree)).toContain('0.1662');
  });

  test('без глубины просачивания сообщает, чего не хватает', async () => {
    mockProject.params.depth = 0;
    const tree = await mount(VadoseFillScreen);
    expect(screenText(tree)).toContain(I18n.t('vadoseNeedDepth'));
  });

  test('название журнала стоит в шапке', async () => {
    const tree = await mount(VadoseFillScreen);
    expect(screenText(tree)).toContain('Шурф 3');
  });

  test('без капиллярных сил считает по Болдыреву: k = Q/F', async () => {
    mockProject.params.useCapillary = false;
    const tree = await mount(VadoseFillScreen);
    // 0.432 / 2.5 = 0.1728 м³/сут на м²
    expect(screenText(tree)).toContain('0.1728');
  });

  test('у Болдырева слоя воды и глубины просачивания на экране нет', async () => {
    mockProject.params.useCapillary = false;
    const tree = await mount(VadoseFillScreen);
    const text = screenText(tree);
    // В формуле (13.68) их нет, и держать поля значило бы обещать влияние
    expect(text).not.toContain(I18n.t('vadoseDepth'));
    expect(text).not.toContain(I18n.t('vadoseHead'));
  });

  test('у Болдырева не требует глубину просачивания', async () => {
    mockProject.params.useCapillary = false;
    mockProject.params.depth = 0;
    const tree = await mount(VadoseFillScreen);
    expect(screenText(tree)).not.toContain(I18n.t('vadoseNeedDepth'));
  });
});

describe('Поинтервальное нагнетание', () => {
  beforeEach(() => {
    mockProject = {
      id: 'p1',
      name: 'Пакер 12',
      ofrType: 'lugeon',
      measurements: [],
      recoveryMeasurements: [],
      wells: [],
      params: {
        rw: 0.1,
        lw: 10,
        interval: 1,
        density: 1000,
        stages: [
          {
            pressure: 286132.4,
            readings: [8.836, 8.852, 8.867, 8.883, 8.899, 8.915, 8.931, 8.947, 8.962, 8.979],
          },
          {
            pressure: 417132.8,
            readings: [9.023, 9.043, 9.062, 9.083, 9.103, 9.123, 9.144, 9.164, 9.184, 9.204],
          },
          {
            pressure: 551580.6,
            readings: [9.252, 9.276, 9.3, 9.325, 9.348, 9.372, 9.396, 9.421, 9.445, 9.469],
          },
          {
            pressure: 420580.2,
            readings: [9.5, 9.52, 9.539, 9.559, 9.579, 9.599, 9.618, 9.638, 9.658, 9.678],
          },
          {
            pressure: 289579.8,
            readings: [9.715, 9.73, 9.745, 9.76, 9.775, 9.79, 9.805, 9.82, 9.835, 9.849],
          },
        ],
      },
    };
  });

  test('показывает средний параметр Люжона контрольного примера', async () => {
    const tree = await mount(LugeonScreen);
    expect(screenText(tree)).toContain('4.918');
  });

  test('называет вид зависимости по Хоулсби', async () => {
    const tree = await mount(LugeonScreen);
    expect(screenText(tree)).toContain(I18n.t('lugeonPatternTurbulent'));
  });

  test('на графике по точке на ступень', async () => {
    const tree = await mount(LugeonScreen);
    expect(countCircles(tree)).toBe(5);
  });

  test('пустой опыт не роняет экран', async () => {
    mockProject.params.stages = [];
    const tree = await mount(LugeonScreen);
    expect(screenText(tree)).toContain(I18n.t('lugeonNeedStages'));
  });

  test('называет класс трещиноватости по табл. 13.5', async () => {
    // Представительное Lu = 5.55 → диапазон 5—15, «Трещиноватые»
    const tree = await mount(LugeonScreen);
    expect(screenText(tree)).toContain(I18n.t('lugeonRockModerate'));
  });

  test('формула Тима меняет k, но не параметр Люжона', async () => {
    const moye = screenText(await mount(LugeonScreen));
    mockProject.params.formula = 'thiem';
    const thiem = screenText(await mount(LugeonScreen));
    // Среднее Lu то же — оно от способа расчёта k не зависит
    expect(moye).toContain('4.918');
    expect(thiem).toContain('4.918');
    // А k разный
    expect(moye).toContain('0.05431');
    expect(thiem).not.toContain('0.05431');
  });
});

describe('Экспресс-опробование', () => {
  beforeEach(() => {
    mockProject = {
      id: 'p1',
      name: 'Скв. 7Э',
      ofrType: 'slug',
      wells: [],
      recoveryMeasurements: [],
      // В журнале — восстановление уровня; остаток скачка s⁰ − s ложится
      // точно на прямую lg(s⁰/s_w) = C·t: 0.9, 0.81, 0.729, 0.6561
      measurements: [
        { id: 'm1', t: 1, s: 0.1 },
        { id: 'm2', t: 2, s: 0.19 },
        { id: 'm3', t: 3, s: 0.271 },
        { id: 'm4', t: 4, s: 0.3439 },
      ],
      params: { rw: 0.05, rc: 0.05, lw: 2, z: 5, m: 10, s0: 1 },
    };
  });

  test('журнал доходит до графика', async () => {
    const tree = await mount(SlugTestScreen);
    expect(countCircles(tree)).toBe(4);
  });

  test('несовершенная скважина считается по A₁ и A₂', async () => {
    const tree = await mount(SlugTestScreen);
    expect(screenText(tree)).toContain(I18n.t('slugSchemePartial'));
  });

  test('фильтр у подошвы пласта переводит расчёт на A₃', async () => {
    mockProject.params = { ...mockProject.params, m: 5 };
    const tree = await mount(SlugTestScreen);
    expect(screenText(tree)).toContain(I18n.t('slugSchemeFull'));
  });

  test('без скачка понижения сообщает, чего не хватает', async () => {
    mockProject.params = { ...mockProject.params, s0: 0 };
    const tree = await mount(SlugTestScreen);
    expect(screenText(tree)).toContain(I18n.t('slugNeedInitialDrawdown'));
  });

  test('прямая через две отмеченные точки берёт их наклон', async () => {
    // Журнал с изломом: ранний участок круче позднего. По всем точкам
    // прямая идёт средним наклоном, а по двум отмеченным — наклоном
    // выбранного участка, и k обязан это увидеть
    // Восстановление уровня: остаток скачка идёт 0.5, 0.25, 0.2, 0.16
    mockProject.measurements = [
      { id: 'm1', t: 1, s: 0.5 },
      { id: 'm2', t: 2, s: 0.75 },
      { id: 'm3', t: 3, s: 0.8 },
      { id: 'm4', t: 4, s: 0.84 },
    ];
    const tree = await mount(SlugTestScreen);
    const chart = () =>
      tree.root.findAll(
        (node) => typeof node.props?.onToggleSelect === 'function',
        { deep: true }
      )[0];
    const before = screenText(tree);

    await act(async () => {
      chart().props.onToggleSelect(0);
    });
    await act(async () => {
      chart().props.onToggleSelect(1);
    });
    expect(screenText(tree)).not.toBe(before);
  });

  test('на точной прямой выбор пары точек k не меняет', async () => {
    // Замеры лежат на прямой ровно, поэтому любые две дают тот же наклон:
    // это признак того, что отметки идут в расчёт, а не подменяют его
    const tree = await mount(SlugTestScreen);
    const chart = () =>
      tree.root.findAll(
        (node) => typeof node.props?.onToggleSelect === 'function',
        { deep: true }
      )[0];
    await act(async () => {
      chart().props.onToggleSelect(0);
    });
    await act(async () => {
      chart().props.onToggleSelect(3);
    });
    expect(screenText(tree)).toContain('0.2697');
  });

  test('свободная прямая доходит до расчёта в базовых единицах', async () => {
    const tree = await mount(SlugTestScreen);
    const chart = () =>
      tree.root.findAll(
        (node) => typeof node.props?.onAnchorsChange === 'function',
        { deep: true }
      )[0];

    await act(async () => {
      chart().props.onFitModeChange(FIT_MODES.FREEDOM);
    });
    // Точки в координатах графика: время в минутах (размерность по
    // умолчанию), ордината безразмерна. Прямая lg(s⁰/s) = 0.1·t
    await act(async () => {
      chart().props.onAnchorsChange([
        { x: 0, y: 0 },
        { x: 10, y: 1 },
      ]);
    });

    // k = 2.3·r_c²/(2·l_w)·C·ln(R/r_w), C = 0.1/мин = 144/сут
    const { conductivityFromSlope, influenceRadiusLog } = require('../../../calc/slugTest');
    const influenceLog = influenceRadiusLog({
      rw: 0.05,
      lw: 2,
      z: 5,
      m: 10,
    }).value;
    const expected = conductivityFromSlope({
      slope: 0.1,
      rc: 0.05,
      lw: 2,
      influenceLog,
    });
    // Результат показывается четырьмя значащими цифрами
    expect(expected).toBeCloseTo(0.5895, 4);
    expect(screenText(tree)).toContain('0.5895');
  });

  test('коэффициент фильтрации показан числом, а не прочерком', async () => {
    const tree = await mount(SlugTestScreen);
    // Прямая по четырём точкам даёт конечное k: прочерк означал бы, что до
    // расчёта не дошли ни замеры, ни геометрия
    const text = screenText(tree);
    expect(text).toMatch(/k[\s\S]{0,40}\d/);
  });
});
