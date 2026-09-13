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

/**
 * Переключает вкладку по порядковому номеру
 *
 * @param {Object} tree - дерево отрисовки
 * @param {number} index - порядковый номер вкладки
 */
function selectTab(tree, index) {
  act(() => {
    tabButtons(tree)[index].props.onPress();
  });
}

describe('CalculatorScreen', () => {
  it('открывается и показывает все шесть вкладок', () => {
    const tree = renderScreen();
    expect(tabButtons(tree).length).toBe(6);
  });

  [0, 1, 2, 3, 4, 5].forEach((index) => {
    it(`вкладка ${index + 1} отрисовывается без ошибок`, () => {
      const tree = renderScreen();
      selectTab(tree, index);
      expect(screenText(tree).length).toBeGreaterThan(50);
    });
  });

  it('вкладка притока считает и показывает результат', () => {
    const tree = renderScreen();
    selectTab(tree, 4);
    const text = screenText(tree);
    // Значения по умолчанию совпадают с примером веб-версии: безнапорный
    // пласт, F = 44000 м², k = 5 м/сут, s = 10 м даёт Q ≈ 2698 м³/сут
    expect(text).toContain('2697');
  });

  it('вкладка ЗСО считает пояса по примеру веб-версии', () => {
    const tree = renderScreen();
    selectTab(tree, 5);
    const text = screenText(tree);
    // Значения по умолчанию совпадают с примером веб-версии: III пояс
    // уходит вверх по потоку на 547.8 м
    expect(text).toContain('547');
  });

  it('вкладка прогноза считает понижение по Тейсу', () => {
    const tree = renderScreen();
    selectTab(tree, 3);
    const text = screenText(tree);
    // Значения по умолчанию совпадают с эталоном веб-версии: s(r₀) = 4.656 м
    expect(text).toContain('4.65');
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
    selectTab(tree, 5);
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
    selectTab(tree, 2);
    // Пример из справки настольного АНСДИМАТ: Q = 100 м³/сут, s = 15 м
    expect(screenText(tree)).toContain('8.133');
  });
});
