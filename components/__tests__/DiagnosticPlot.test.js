/**
 * Проверка диагностического графика
 *
 * График был неподвижной картинкой: полку производной ищут на позднем
 * участке, а он на общем масштабе сжат в несколько точек у правого края, и
 * разглядеть её было нечем. Теперь плоскость живая — те же жесты и тот же
 * масштаб, что у графика подбора прямой.
 *
 * Сами жесты отсюда не проверить: RNGH под react-test-renderer событий не
 * порождает. Проверяется то, что можно, — управление на месте и масштаб
 * действительно меняет плоскость, а не подписан кнопкой впустую.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import DiagnosticPlot from '../DiagnosticPlot';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

beforeAll(() => {
  I18n.locale = 'ru';
});

/** Замеры вразбивку: по равномерному ряду форма кривой не читается */
const result = {
  derivative: [
    { t: 1, s: 0.5, d: 0.4 },
    { t: 2, s: 0.8, d: 0.7 },
    { t: 5, s: 1.2, d: 0.9 },
    { t: 10, s: 1.5, d: 0.95 },
    { t: 30, s: 1.9, d: 0.97 },
    { t: 100, s: 2.3, d: 0.98 },
  ],
  plateau: 0.97,
  wellboreEndsAt: 2,
};

const mount = (props = {}) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <DiagnosticPlot result={result} width={340} {...props} />
      </PaperProvider>
    );
  });
  return tree;
};

/** Кнопка панели по метке для экранного диктора */
const button = (tree, label) =>
  tree.root
    .findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === label,
      { deep: true }
    )
    .pop();

/** Абсциссы точек на полотне */
const dots = (tree) =>
  tree.root
    .findAllByType('RNSVGCircle', { deep: true })
    .map((node) => node.props.cx);

test('над графиком стоят кнопки масштаба и сброс', () => {
  const tree = mount();
  expect(button(tree, 'Увеличить')).toBeDefined();
  expect(button(tree, 'Уменьшить')).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).toContain('Сброс');
});

test('выбора способа прямой в диагностике нет', () => {
  // Здесь смотрят на форму кривой, а не подбирают наклон: чипы «по всем
  // точкам / свободная прямая» пришли бы с графика, на котором их нажимают
  const json = JSON.stringify(mount().toJSON());
  expect(json).not.toContain('Свободная прямая');
});

test('приближение раздвигает точки по оси времени', () => {
  const tree = mount();
  const before = dots(tree);
  expect(before.length).toBeGreaterThan(2);

  act(() => {
    button(tree, 'Увеличить').props.onPress();
  });
  const zoomed = dots(tree);
  expect(zoomed).not.toEqual(before);

  // Разброс по оси времени вырос: точки разъехались, а не сдвинулись целиком
  const span = (xs) => Math.max(...xs) - Math.min(...xs);
  expect(span(zoomed)).toBeGreaterThan(span(before));
});

test('без данных вместо графика стоит объяснение', () => {
  const tree = mount({ result: { derivative: [{ t: 1, s: 1, d: 1 }] } });
  expect(JSON.stringify(tree.toJSON())).toContain('не меньше пяти замеров');
});
