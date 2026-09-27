/**
 * Проверка типовой схемы водозабора
 *
 * Чертёж обязан рисоваться для всех четырёх расчётных схем и различаться
 * между ними: у Хантуша два водоупора, у Болтона безнапорный горизонт,
 * у границы питания река и два дополнительных размера.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import Svg from 'react-native-svg';
import WellScheme from '../WellScheme';
import { wellSchemeLayout, screenLines, LAYOUTS, WIDTH } from '../wellSchemeLayout';
import { WELL_SCHEMES } from '../../../calc/wellDrawdown';

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
 * Рисует схему и отдаёт корень дерева
 *
 * @param {Object} props - свойства компонента
 * @returns {Object} корень отрисованного дерева
 */
function render(props) {
  let tree;
  act(() => {
    tree = renderer.create(<WellScheme {...props} />);
  });
  return tree.root;
}

/**
 * Склеивает подписи схемы
 *
 * @param {Object} root - корень дерева
 * @returns {string} подписи через пробел
 */
function textOf(root) {
  return root
    .findAll((node) => typeof node.type === 'string' && node.type.includes('Text'))
    .flatMap((node) => collectText(node.props.children))
    .join(' ');
}

describe('wellSchemeLayout', () => {
  it('разметка есть у каждой расчётной схемы', () => {
    Object.keys(WELL_SCHEMES).forEach((scheme) => {
      expect(LAYOUTS[scheme]).toBeDefined();
    });
  });

  it('неизвестная схема отдаёт Тейса', () => {
    expect(wellSchemeLayout('unknown')).toBe(LAYOUTS.theis);
  });

  it('слои идут сверху вниз без разрывов', () => {
    Object.entries(LAYOUTS).forEach(([name, layout]) => {
      layout.layers.forEach((layer, i) => {
        if (i === 0) return;
        const previous = layout.layers[i - 1];
        expect(`${name}:${layer.y}`).toBe(`${name}:${previous.y + previous.h}`);
      });
    });
  });

  it('слои умещаются в полотно', () => {
    Object.values(LAYOUTS).forEach((layout) => {
      const last = layout.layers[layout.layers.length - 1];
      expect(last.y + last.h).toBeLessThanOrEqual(layout.height);
    });
  });

  it('уровень воды выше дна ствола и ниже оголовка', () => {
    Object.values(LAYOUTS).forEach((layout) => {
      [layout.pumped, layout.observer].forEach((well) => {
        expect(well.waterY).toBeGreaterThan(well.top);
        expect(well.waterY).toBeLessThan(well.bottom);
      });
    });
  });

  it('у схемы с перетеканием два водоупора', () => {
    const aquitards = LAYOUTS.hantush.labels.filter((l) => l.key === 'schemeAquitard');
    expect(aquitards.length).toBe(2);
  });

  it('только у схемы с границей питания есть река', () => {
    expect(LAYOUTS.boundary.river).toBeDefined();
    ['theis', 'hantush', 'boulton'].forEach((scheme) => {
      expect(LAYOUTS[scheme].river).toBeUndefined();
    });
  });

  it('у границы питания три размера, у остальных один', () => {
    expect(LAYOUTS.boundary.dims.length).toBe(3);
    ['theis', 'hantush', 'boulton'].forEach((scheme) => {
      expect(LAYOUTS[scheme].dims.length).toBe(1);
    });
  });

  it('у границы питания наблюдательная скважина левее опытной', () => {
    expect(LAYOUTS.boundary.observer.x).toBeLessThan(LAYOUTS.boundary.pumped.x);
  });

  it('безнапорная схема подписывает обводнённую мощность и Sy', () => {
    expect(LAYOUTS.boulton.thickness.label).toBe('h₀');
    expect(LAYOUTS.boulton.storageSub).toBe('y');
  });
});

describe('screenLines', () => {
  it('фильтр не выходит за дно ствола', () => {
    Object.values(LAYOUTS).forEach((layout) => {
      screenLines(layout.pumped, 10).forEach((y) => {
        expect(y).toBeGreaterThan(layout.pumped.top);
        expect(y).toBeLessThan(layout.pumped.bottom);
      });
    });
  });

  it('шаг штрихов выдержан', () => {
    const lines = screenLines(LAYOUTS.theis.pumped, 10);
    expect(lines.length).toBeGreaterThan(5);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i] - lines[i - 1]).toBeCloseTo(10, 9);
    }
  });
});

describe('WellScheme', () => {
  Object.keys(WELL_SCHEMES).forEach((scheme) => {
    it(`рисуется для схемы ${scheme}`, () => {
      const root = render({ scheme, width: 340 });
      expect(root.findAllByType(Svg).length).toBe(1);
    });
  });

  it('подпись с k и Q показывается, когда её передали', () => {
    const root = render({ scheme: 'theis', width: 340, caption: 'k = 2 м/сут · Q = 100 м³/сут' });
    expect(textOf(root)).toContain('100');
  });

  it('без подписи схема всё равно рисуется', () => {
    const root = render({ scheme: 'theis', width: 340 });
    expect(root.findAllByType(Svg).length).toBe(1);
  });

  it('у границы питания подписаны оба расстояния до реки', () => {
    const text = textOf(render({ scheme: 'boundary', width: 340 }));
    expect(text).toContain('L');
    expect(text.split(' ')).toContain('w');
    expect(text.split(' ')).toContain('p');
  });

  it('высота полотна следует за схемой', () => {
    const heights = Object.keys(WELL_SCHEMES).map((scheme) => {
      let tree;
      act(() => {
        tree = renderer.create(<WellScheme scheme={scheme} width={WIDTH} />);
      });
      return tree.root.findByType(Svg).props.height;
    });
    expect(new Set(heights).size).toBeGreaterThan(1);
  });
});
