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

/**
 * Подпись поля так, как она стоит в ячейке
 *
 * Переводы опытов несут обозначение в конце — «Слой воды в шурфе H», — а
 * ячейка его не повторяет: обозначение у неё строкой ниже, см. Field
 *
 * @param {string} key - ключ перевода
 * @returns {string} подпись без обозначения
 */
const shownLabel = (key) => I18n.t(key).replace(/ \S+$/, '');

/**
 * Поле ввода по обозначению величины
 *
 * По обозначению, а не по подписи: подпись величины встречается на экране и
 * заголовком раздела, и строкой результата
 *
 * @param {Object} tree - дерево рендера
 * @param {string} symbol - обозначение в формуле: Q, h_c, F
 * @returns {Object} узел поля
 */
const field = (tree, symbol) =>
  tree.root.findAll(
    (node) =>
      node.props?.symbol === symbol && typeof node.props?.onChange === 'function',
    { deep: true }
  )[0];

/** Первый переключатель вариантов на экране */
const optionRow = (tree) =>
  tree.root.findAll(
    (node) =>
      Array.isArray(node.props?.options) &&
      typeof node.props?.onChange === 'function',
    { deep: true }
  )[0];

/** Лента справочных значений */
const presetRow = (tree) =>
  tree.root.findAll((node) => typeof node.props?.onPick === 'function', {
    deep: true,
  })[0];

/** Цвета ломаных на графике: RNSVG отдаёт их числом в props.stroke.payload */
const pathStrokes = (tree) => {
  const walk = (node, seen = []) => {
    if (!node || typeof node !== 'object') return seen;
    if (node.type === 'RNSVGPath' && node.props?.stroke?.payload != null) {
      seen.push(node.props.stroke.payload);
    }
    for (const child of node.children ?? []) walk(child, seen);
    return seen;
  };
  return walk(tree.toJSON());
};

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
    expect(text).not.toContain(shownLabel('vadoseDepth'));
    expect(text).not.toContain(shownLabel('vadoseHead'));
  });

  test('у Болдырева не требует глубину просачивания', async () => {
    mockProject.params.useCapillary = false;
    mockProject.params.depth = 0;
    const tree = await mount(VadoseFillScreen);
    expect(screenText(tree)).not.toContain(I18n.t('vadoseNeedDepth'));
  });

  test('у Болдырева нет ни капиллярного поднятия, ни справочника пород', async () => {
    mockProject.params.useCapillary = false;
    const tree = await mount(VadoseFillScreen);
    const text = screenText(tree);
    expect(text).not.toContain(shownLabel('vadoseCapillary'));
    expect(text).not.toContain(I18n.t('capillarySandyLoam'));
  });

  test('выбор метода стоит выше полей', async () => {
    // От метода зависит, сколько на экране полей вообще, и выбирать его
    // после того, как половина заполнена, поздно
    const text = screenText(await mount(VadoseFillScreen));
    const volume = text.indexOf(shownLabel('vadoseVolume'));
    expect(volume).toBeGreaterThan(-1);
    expect(text.indexOf(I18n.t('vadoseMethodName'))).toBeLessThan(volume);
  });

  test('переключение на Биндемана открывает его поля', async () => {
    mockProject.params.useCapillary = false;
    const tree = await mount(VadoseFillScreen);
    await act(async () => {
      optionRow(tree).props.onChange(true);
    });
    const text = screenText(tree);
    expect(text).toContain(shownLabel('vadoseHead'));
    expect(text).toContain(shownLabel('vadoseDepth'));
    expect(text).toContain(shownLabel('vadoseCapillary'));
  });

  test('расход считается по объёму с интервалом и стоит прямо в поле', async () => {
    // 3 л за 10 мин — это 0.432 м³/сут; набивать его руками незачем
    const tree = await mount(VadoseFillScreen);
    expect(field(tree, 'Q').props.value).toBe('0.432');
    expect(screenText(tree)).toContain(I18n.t('vadoseFlowComputed'));
  });

  test('заданный руками расход поле не подменяет', async () => {
    mockProject.params.flow = 0.864;
    const tree = await mount(VadoseFillScreen);
    expect(field(tree, 'Q').props.value).toBe('0.864');
    expect(screenText(tree)).toContain(I18n.t('vadoseFlowManual'));
    // И в расчёт идёт он же, а не 0.432 из объёма
    expect(screenText(tree)).toContain('0.3323');
  });

  test('стёртое поле расхода не заполняется посчитанным на полуслове', async () => {
    // Иначе стереть посчитанное число, чтобы вписать своё, было бы нельзя
    const tree = await mount(VadoseFillScreen);
    await act(async () => {
      field(tree, 'Q').props.onChange('');
    });
    expect(field(tree, 'Q').props.value).toBe('');
  });

  test('справочная порода подставляется поверх набранного вручную', async () => {
    // Набранный текст живёт, пока поле правят, и перекрывал подставленное:
    // порода «вставлялась» только со второго раза
    const tree = await mount(VadoseFillScreen);
    await act(async () => {
      field(tree, 'h_c').props.onChange('0.55');
    });
    expect(field(tree, 'h_c').props.value).toBe('0.55');
    await act(async () => {
      presetRow(tree).props.onPick('sandyLoam');
    });
    // Супесь: половина середины диапазона 1.5—3.0 м
    expect(field(tree, 'h_c').props.value).toBe('1.125');
  });

  test('лента пород не отдаёт первое нажатие клавиатуре', async () => {
    // Вложенная прокрутка берёт своё умолчание, и первый тап уходил на
    // закрытие клавиатуры вместо подстановки
    const tree = await mount(VadoseFillScreen);
    const scroll = presetRow(tree).findAll(
      (node) => node.props?.keyboardShouldPersistTaps !== undefined,
      { deep: true }
    )[0];
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
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

  test('петля «расход — давление» замыкается в нуле', async () => {
    const tree = await mount(LugeonScreen);
    // Ноль и три ступени подъёма, затем пик, две ступени спуска и возврат в
    // ноль: пик у ветвей общий, поэтому точек восемь, а не десять
    expect(countCircles(tree)).toBe(8);
  });

  test('подъём и спуск давления разведены по цвету и подписаны', async () => {
    const tree = await mount(LugeonScreen);
    const text = screenText(tree);
    expect(text).toContain(I18n.t('lugeonBranchRise'));
    expect(text).toContain(I18n.t('lugeonBranchFall'));
    // Две ломаные разного цвета: по расхождению ветвей и читается опыт
    expect(new Set(pathStrokes(tree)).size).toBe(2);
  });

  test('пока обратного хода нет, спуск не дорисовывается', async () => {
    mockProject.params.stages = mockProject.params.stages.slice(0, 3);
    const tree = await mount(LugeonScreen);
    expect(screenText(tree)).not.toContain(I18n.t('lugeonBranchFall'));
    // Ноль и три ступени подъёма
    expect(countCircles(tree)).toBe(4);
  });

  test('способ построения прямой на петле не предлагается', async () => {
    // Прямую по петле не ведут, и переключатели «По всем точкам» и
    // «Свободная прямая» здесь обещали бы работу, которой нет
    const text = screenText(await mount(LugeonScreen));
    expect(text).not.toContain(I18n.t('fitAuto'));
    expect(text).not.toContain(I18n.t('fitFreedom'));
  });

  test('объясняет, что показания расходомера накопленные', async () => {
    const text = screenText(await mount(LugeonScreen));
    expect(text).toContain(I18n.t('lugeonReadings'));
    expect(text).toContain(I18n.t('lugeonReadingsHint'));
  });

  test('убывающие показания названы ошибкой ввода', async () => {
    // Внесён прирост за минуту, а не нарастающий итог: расход выходит
    // отрицательным, и молчать об этом нельзя
    mockProject.params.stages = [
      { pressure: 286132.4, readings: [10, 20, 30, 40, 5] },
    ];
    const text = screenText(await mount(LugeonScreen));
    expect(text).toContain(I18n.t('lugeonReadingsFalling'));
  });

  test('исправные показания об ошибке не сообщают', async () => {
    const text = screenText(await mount(LugeonScreen));
    expect(text).not.toContain(I18n.t('lugeonReadingsFalling'));
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

  /**
   * Поле по testID
   *
   * По testID, а не по подписи: подпись «Давление ΔP» одна на пять ступеней
   *
   * @param {Object} tree - дерево рендера
   * @param {string} testID - метка поля
   * @returns {Object} узел поля
   */
  const input = (tree, testID) =>
    tree.root.findAll(
      (node) =>
        node.props?.testID === testID && typeof node.props?.onChangeText === 'function',
      { deep: true }
    )[0];

  test('в давление ступени вводится значение меньше единицы', async () => {
    // Ноль в базе значит «не задано», и первый же символ «0,» обнулял поле:
    // значение меньше единицы было не набрать в принципе
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-pressure-0').props.onChangeText('0,');
    });
    expect(input(tree, 'lugeon-pressure-0').props.value).toBe('0,');

    await act(async () => {
      input(tree, 'lugeon-pressure-0').props.onChangeText('0,5');
    });
    expect(input(tree, 'lugeon-pressure-0').props.value).toBe('0,5');
  });

  test('разделитель в давлении не съедается', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-pressure-1').props.onChangeText('1,');
    });
    expect(input(tree, 'lugeon-pressure-1').props.value).toBe('1,');

    await act(async () => {
      input(tree, 'lugeon-pressure-1').props.onChangeText('1,3');
    });
    expect(input(tree, 'lugeon-pressure-1').props.value).toBe('1,3');
  });

  test('набранное давление доходит до расчёта', async () => {
    const tree = await mount(LugeonScreen);
    // Контрольный средний параметр Люжона исходных ступеней
    expect(screenText(tree)).toContain('4.918');

    await act(async () => {
      input(tree, 'lugeon-pressure-0').props.onChangeText('0,5');
    });
    // Давление первой ступени упало впятеро — среднее обязано измениться
    expect(screenText(tree)).not.toContain('4.918');
  });

  test('в показание расходомера вводится дробное значение', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-reading-0-0').props.onChangeText('8,');
    });
    expect(input(tree, 'lugeon-reading-0-0').props.value).toBe('8,');

    await act(async () => {
      input(tree, 'lugeon-reading-0-0').props.onChangeText('8,84');
    });
    expect(input(tree, 'lugeon-reading-0-0').props.value).toBe('8,84');
  });

  test('стёртое показание остаётся пропуском, а не нулём', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-reading-0-3').props.onChangeText('');
    });
    expect(input(tree, 'lugeon-reading-0-3').props.value).toBe('');
    // Ноль на расходомере означал бы обнуление прибора, а не пропуск отсчёта:
    // расчёт по-прежнему берёт крайние достоверные отсчёты
    expect(screenText(tree)).not.toContain(I18n.t('lugeonReadingsFalling'));
  });

  test('удаление ступени не переносит набранное на соседнюю', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-pressure-4').props.onChangeText('9,');
    });

    // Крестик ступени — Pressable с одной меткой доступности, без роли:
    // отбираем по обработчику, первый в списке относится к первой ступени
    const remove = tree.root.findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === I18n.t('lugeonRemoveStage'),
      { deep: true }
    )[0];
    await act(async () => {
      remove.props.onPress();
    });

    // Черновики привязаны к номеру ступени: после удаления первой номера
    // съезжают, и набранный текст пятой ступени оказался бы в четвёртой
    expect(input(tree, 'lugeon-pressure-3').props.value).not.toBe('9,');
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
      // Фильтр задан серединой: LT_w = 4 при длине 2 м — это низ на z = 5 м
      params: { rw: 0.05, rc: 0.05, lw: 2, lt: 4, m: 10, s0: 1 },
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

  test('опыт из настольного АНСДИМАТ считается по его же геометрии', async () => {
    // Проект «Экспресс» настольной программы: «Верх/Низ» 4 м, фильтр 7.9 м,
    // обсадка и фильтр по 0.05 м, мощность 8 м, скачок 3.45 м. Низ фильтра
    // выходит на 7.95 м — фильтр отцентрован в пласте, как его и задавали
    mockProject.params = { rw: 0.05, rc: 0.05, lw: 7.9, lt: 4, m: 8, s0: 3.45 };
    mockProject.measurements = [
      [1, 0.07], [4, 0.2], [10, 0.34], [20, 0.65], [50, 1.2], [100, 1.8],
      [240, 2.8], [540, 3.27], [900, 3.32], [1920, 3.37], [3000, 3.4],
      [5160, 3.43], [6600, 3.44],
    ].map(([t, s], i) => ({ id: `m${i}`, t, s }));

    const text = screenText(await mount(SlugTestScreen));
    // Низ фильтра посчитан из середины и показан числом
    expect(text).toContain('7.950');
    // Скважина несовершенная: ln(R/r_w) по A₁ и A₂
    expect(text).toContain('3.9758177');
    // Излом найден, и об этом сказано
    expect(text).toContain('два прямолинейных участка');
    // Ответ — по второму участку; k первого показан рядом. На чертеже
    // настольного АНСДИМАТ подписано 4.275847E-04 и 6.420426E-03
    expect(text).toContain('4.1582e-4');
    expect(text).toContain('0.006422');
  });

  test('коэффициент фильтрации показан числом, а не прочерком', async () => {
    const tree = await mount(SlugTestScreen);
    // Прямая по четырём точкам даёт конечное k: прочерк означал бы, что до
    // расчёта не дошли ни замеры, ни геометрия
    const text = screenText(tree);
    expect(text).toMatch(/k[\s\S]{0,40}\d/);
  });

  describe('коэффициенты A и ln(R/r_w)', () => {
    /**
     * Раскрывает блок «Как считается»: коэффициенты лежат в нём
     *
     * @param {Object} tree - дерево рендера
     */
    const openMethod = async (tree) => {
      const [collapsible] = tree.root.findAll(
        (node) => node.props?.title === I18n.t('ofrMethodTitle'),
        { deep: true }
      );
      const [head] = collapsible.findAll(
        (node) => typeof node.props?.onPress === 'function'
      );
      await act(async () => {
        head.props.onPress();
      });
    };

    /**
     * Сообщает блоку его ширину, как это делает разметка на устройстве
     *
     * @param {Object} tree - дерево рендера
     * @param {string} testID - метка блока
     * @param {number} width - ширина, px
     */
    const layout = async (tree, testID, width) => {
      const [slot] = tree.root.findAll(
        (node) =>
          node.props?.testID === testID && typeof node.props?.onLayout === 'function'
      );
      await act(async () => {
        slot.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height: 20 } } });
      });
    };

    test('фильтр во всю мощность: на экране только A₃', async () => {
      mockProject.params = { rw: 0.05, rc: 0.05, lw: 8, lt: 3.9, m: 8, s0: 3.45 };
      const tree = await mount(SlugTestScreen);
      await openMethod(tree);
      const text = screenText(tree);
      expect(text).toContain(I18n.t('slugSchemeFull'));
      expect(text).toContain('A₃ = ');
      expect(text).not.toContain('A₁ = ');
      expect(text).not.toContain('A₂ = ');
    });

    test('фильтр короче пласта: на экране A₁ и A₂, без A₃', async () => {
      mockProject.params = { rw: 0.05, rc: 0.05, lw: 7.9, lt: 4, m: 8, s0: 3.45 };
      const tree = await mount(SlugTestScreen);
      await openMethod(tree);
      const text = screenText(tree);
      expect(text).toContain(I18n.t('slugSchemePartial'));
      expect(text).toContain('A₁ = ');
      expect(text).toContain('A₂ = ');
      expect(text).not.toContain('A₃ = ');
    });

    test('A — столько знаков, сколько влезает в строку', async () => {
      mockProject.params = { rw: 0.05, rc: 0.05, lw: 7.9, lt: 4, m: 8, s0: 3.45 };
      const { bouwerRiceCoefficients } = require('../../../calc/slugTest');
      const { A1, A2 } = bouwerRiceCoefficients(158);
      const tree = await mount(SlugTestScreen);
      await openMethod(tree);

      // Кегль формулы 12, системный множитель шрифта в тестовой среде 2:
      // знак 14.4 px. В 400 px — 27 знаков, после «A₁ = » остаётся 22, и
      // число показывается во все пятнадцать значащих цифр
      await layout(tree, 'slug-coefficients', 400);
      let text = screenText(tree);
      expect(text).toContain(`A₁ = ${Number(A1.toPrecision(15))}`);
      expect(text).toContain(`A₂ = ${Number(A2.toPrecision(15))}`);
      expect(text).toContain('A₁ = 5.45276308870136');

      // В 200 px — 13 знаков, на число 8: запись сокращается округлением
      await layout(tree, 'slug-coefficients', 200);
      text = screenText(tree);
      expect(text).toMatch(/A₁ = 5\.452763(?!\d)/);
      expect(text).toMatch(/A₂ = 0\.928226(?!\d)/);
    });

    test('ln(R/r_w) — столько знаков, сколько влезает в строку', async () => {
      mockProject.params = { rw: 0.05, rc: 0.05, lw: 7.9, lt: 4, m: 8, s0: 3.45 };
      const tree = await mount(SlugTestScreen);

      // Кегль значения 14, множитель 2: знак 16.8 px. В 300 px — 17 знаков
      await layout(tree, 'slug-influence-log', 300);
      expect(screenText(tree)).toContain('3.97581770124749');

      // В 120 px — 7 знаков: 3.9758177… округляется до 3.97582
      await layout(tree, 'slug-influence-log', 120);
      expect(screenText(tree)).toMatch(/3\.97582(?!\d)/);
    });
  });
});
