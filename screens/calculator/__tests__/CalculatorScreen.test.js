/**
 * Проверка экрана калькулятора
 *
 * Главное, что здесь ловится, — обрыв ссылок при разборе экрана на вкладки:
 * вкладка, оставшаяся со ссылкой на исчезнувшую переменную, падает только при
 * отрисовке, и без такого прохода это выяснилось бы у пользователя.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import CalculatorScreen from '../../CalculatorScreen';
import I18n from '../../../Localization';
import { UnitsProvider } from '../../../UnitsContext';
import { lightTheme, darkTheme } from '../../../theme';

// Карта ЗСО тянет WebView, а тот требует нативного модуля: в тесте на
// вёрстку экрана он не нужен
jest.mock('../../../components/FieldMap', () => 'FieldMap');

jest.mock('../../../db/settings', () => ({
  getSettings: () => Promise.resolve({}),
  setSetting: () => Promise.resolve(),
}));

// Без явной локали тест идёт на английском, и проверки русских подписей
// («Утечки», «Барраж») проходили бы вхолостую
beforeAll(() => {
  I18n.locale = 'ru';
});

/**
 * Отрисовывает экран целиком
 *
 * @param {Object} theme - тема оформления
 * @returns {Object} дерево отрисовки
 */
function renderScreen(theme = lightTheme) {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={theme}>
        <UnitsProvider>
          <CalculatorScreen />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  return tree;
}

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
 * Весь текст экрана одной строкой
 *
 * @param {Object} tree - дерево отрисовки
 * @returns {string} склеенный текст
 */
function screenText(tree) {
  return tree.root
    .findAll((node) => typeof node.type === 'string' && node.type.includes('Text'))
    .flatMap((node) => collectText(node.props.children))
    .join(' ');
}

/**
 * Кнопки вкладок без повторов
 *
 * TouchableOpacity разворачивается в несколько узлов, и обработчик нажатия
 * висит на двух из них. Отбираем по одному на вкладку, различая их подписью.
 *
 * @param {Object} tree - дерево отрисовки
 * @returns {Array<Object>} узлы кнопок в порядке вкладок
 */
function tabButtons(tree) {
  const seen = new Set();
  return tree.root
    .findAll(
      (node) =>
        node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function'
    )
    .filter((node) => {
      const label = collectText(node.props.children).join(' ');
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
}

/** Ключи подписей вкладок */
const TAB_KEYS = ['tabFlow', 'tabFiltration', 'tabParams', 'tabForecast', 'tabPit', 'tabWhpa'];

/**
 * Переключает вкладку по её подписи
 *
 * По подписи, а не по порядковому номеру: вкладки разложены в два ряда, и
 * порядок в дереве не совпадает с порядком расчётов.
 *
 * @param {Object} tree - дерево отрисовки
 * @param {string} labelKey - ключ подписи вкладки
 */
function selectTab(tree, labelKey) {
  const label = I18n.t(labelKey);
  const button = tabButtons(tree).find(
    (node) => collectText(node.props.children).join(' ') === label
  );
  act(() => {
    button.props.onPress();
  });
}

/**
 * Поле ввода калькулятора по подписи его ячейки
 *
 * @param {Object} tree - дерево отрисовки
 * @param {string} label - подпись ячейки
 * @returns {Object} узел TextInput
 */
function fieldInput(tree, label) {
  const cell = tree.root.find(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  );
  return cell.find((node) => typeof node.props.onChangeText === 'function');
}

/** Вводит текст в поле по подписи */
function typeInto(tree, label, text) {
  act(() => {
    fieldInput(tree, label).props.onChangeText(text);
  });
}

/** Варианты-переключатели на экране: подпись и выбран ли */
function radios(tree) {
  const seen = new Set();
  return tree.root
    .findAll(
      (node) => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function'
    )
    .map((node) => ({
      node,
      label: collectText(node.props.children).join(' '),
      selected: !!node.props.accessibilityState?.selected,
    }))
    .filter((item) => (seen.has(item.label) ? false : seen.add(item.label)));
}

/** Нажимает вариант-переключатель по подписи */
function pickRadio(tree, label) {
  act(() => {
    radios(tree).find((item) => item.label === label).node.props.onPress();
  });
}

describe('CalculatorScreen', () => {
  it('открывается и показывает все шесть вкладок', () => {
    const tree = renderScreen();
    expect(tabButtons(tree).length).toBe(6);
  });

  TAB_KEYS.forEach((labelKey) => {
    it(`вкладка «${labelKey}» отрисовывается без ошибок`, () => {
      const tree = renderScreen();
      selectTab(tree, labelKey);
      expect(screenText(tree).length).toBeGreaterThan(50);
    });
  });

  it('вкладки разложены в два ряда: Котлован в первом, ЗСО во втором', () => {
    const tree = renderScreen();
    const rows = [0, 1].map((index) =>
      tree.root
        .find((node) => node.props.testID === `calc-tab-row-${index}`)
        .findAll(
          (node) => node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function'
        )
        .map((node) => collectText(node.props.children).join(' '))
        .filter((label, position, all) => all.indexOf(label) === position)
    );

    expect(rows[0]).toEqual(['Пересчёт Q', 'Пересчёт k', 'Котлован']);
    expect(rows[1]).toEqual(['Оценка по Q/s', 'Расчёт понижения', 'ЗСО']);
  });

  it('поля калькулятора не предлагают автозаполнение', () => {
    // Телефон норовил подставить в числовые поля номер владельца
    TAB_KEYS.forEach((labelKey) => {
      const tree = renderScreen();
      selectTab(tree, labelKey);
      const inputs = tree.root.findAll(
        (node) => typeof node.props.onChangeText === 'function' && 'keyboardType' in node.props
      );
      expect(inputs.length).toBeGreaterThan(0);
      inputs.forEach((input) => {
        expect(input.props.autoComplete).toBe('off');
        expect(input.props.importantForAutofill).toBe('no');
      });
    });
  });

  it('вкладка притока считает и показывает результат', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabPit');
    const text = screenText(tree);
    // Значения по умолчанию совпадают с примером веб-версии: безнапорный
    // пласт, F = 44000 м², k = 5 м/сут, s = 10 м даёт Q ≈ 2698 м³/сут
    expect(text).toContain('2697');
  });

  it('вкладка ЗСО считает пояса по примеру веб-версии', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabWhpa');
    const text = screenText(tree);
    // Значения по умолчанию совпадают с примером веб-версии: III пояс
    // уходит вверх по потоку на 547.8 м
    expect(text).toContain('547');
  });

  it('широта и долгота ЗСО помещаются в поле целиком', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabWhpa');
    // «-179.123456» — одиннадцать знаков моноширинной гарнитурой 19 pt
    const needed = Math.ceil(11 * 19 * 0.6);
    [I18n.t('whpaLatitude'), I18n.t('whpaLongitude')].forEach((label) => {
      const style = [].concat(fieldInput(tree, label).props.style).flat().filter(Boolean);
      const width = Math.max(...style.map((part) => part.width ?? 0));
      expect(width).toBeGreaterThanOrEqual(needed);
    });
  });

  it('расчёт понижения открывается на безнапорном пласте, схемы — в порядке заказчика', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabForecast');
    const schemes = radios(tree).filter((item) =>
      ['Безнапорный', 'Напорный', 'С перетеканием', 'Граница питания'].includes(item.label)
    );

    expect(schemes.map((item) => item.label)).toEqual([
      'Безнапорный',
      'Напорный',
      'С перетеканием',
      'Граница питания',
    ]);
    expect(schemes.find((item) => item.selected).label).toBe('Безнапорный');
  });

  it('вкладка прогноза считает понижение по Тейсу', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabForecast');
    pickRadio(tree, 'Напорный');
    const text = screenText(tree);
    // Значения по умолчанию совпадают с эталоном веб-версии: s(r₀) = 4.656 м
    expect(text).toContain('4.65');
  });

  it('в прогнозе пьезопроводность пересчитывается из упругой водоотдачи', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabForecast');
    pickRadio(tree, 'Напорный');
    // k = 2 м/сут, m = 25 м: T = 50 м²/сут, a = T/S
    typeInto(tree, I18n.t('wellStorativity'), '0.0002');

    expect(fieldInput(tree, I18n.t('wellDiffusivity')).props.value).toBe('250000');
  });

  it('в прогнозе водоотдача пересчитывается из пьезопроводности и следует за k', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabForecast');
    pickRadio(tree, 'С перетеканием');
    typeInto(tree, I18n.t('wellDiffusivity'), '100000');
    expect(fieldInput(tree, I18n.t('wellStorativity')).props.value).toBe('0.0005');

    // Последней задавали a — при смене k пересчитывается S, а a стоит
    typeInto(tree, I18n.t('wellConductivity'), '4');
    expect(fieldInput(tree, I18n.t('wellDiffusivity')).props.value).toBe('100000');
    expect(fieldInput(tree, I18n.t('wellStorativity')).props.value).toBe('0.001');
  });

  it('в притоке пьезопроводность и водоотдача пересчитывают друг друга', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabPit');
    // k = 5 м/сут, h₀ = 20 м: a = k·h/μ
    typeInto(tree, I18n.t('pitStorage'), '0.2');
    expect(fieldInput(tree, I18n.t('pitDiffusivity')).props.value).toBe('500');

    typeInto(tree, I18n.t('pitDiffusivity'), '2000');
    expect(fieldInput(tree, I18n.t('pitStorage')).props.value).toBe('0.05');
  });

  it('вкладки «Утечки» нет: перетекание считает прогноз понижения', () => {
    // Схема Хантуша–Джейкоба живёт переключателем в «Прогнозе понижения»
    // рядом с Тейсом, Болтоном и границей питания. Отдельная вкладка
    // дублировала ввод и уводила от сравнения схем
    expect(screenText(renderScreen())).not.toContain('Утечки');
  });

  it('пересчёт расхода стоит первой вкладкой и открыт при входе', () => {
    const tree = renderScreen();
    // Самый востребованный расчёт в поле: дебит из чужого отчёта приводят
    // к своим единицам чаще, чем считают что бы то ни было ещё
    const first = collectText(tabButtons(tree)[0].props.children).join(' ');
    expect(first).toContain(I18n.t('tabFlow'));
    // Открыт сразу: содержимое вкладки на экране без единого нажатия
    expect(screenText(tree)).toContain(I18n.t('flowGroupMetric'));
  });

  it('экран работает и в тёмной теме', () => {
    const tree = renderScreen(darkTheme);
    selectTab(tree, 'tabWhpa');
    expect(screenText(tree).length).toBeGreaterThan(50);
  });

  it('вкладки «Барраж» нет', () => {
    // Граничные условия отображениями и подпор перед стеной в поле не
    // считают: вкладка занимала ряд и уводила от нужных расчётов
    expect(screenText(renderScreen())).not.toContain('Барраж');
  });

  it('вкладки подписаны «Оценка по Q/s» и «Расчёт понижения»', () => {
    const labels = tabButtons(renderScreen()).map((node) =>
      collectText(node.props.children).join(' ')
    );
    expect(labels).toEqual(expect.arrayContaining(['Оценка по Q/s', 'Расчёт понижения']));
    expect(labels).not.toContain('Параметры');
    expect(labels).not.toContain('Прогноз s');
  });

  it('«Оценка по Q/s» по умолчанию считает T напорного пласта', () => {
    const tree = renderScreen();
    selectTab(tree, 'tabParams');
    // Пример из справки настольного АНСДИМАТ: Q = 100 м³/сут, s = 15 м
    expect(screenText(tree)).toContain('8.133');
  });
});
