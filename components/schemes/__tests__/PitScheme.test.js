/**
 * Проверка отрисовки разреза котлована
 *
 * Разрез обязан рисоваться в любом состоянии формы, включая пустую и
 * ошибочную: иллюстрация показывается рядом с полями ввода и не может
 * исчезать, пока пользователь их заполняет.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import PitScheme from '../PitScheme';
import { compute } from '../../../calc/pitInflow';

const base = { k: 5, m: 20, h0: 20, S: 10, a: 1000, mu: 0.1, t: 100, L: 2200, factor: 1 };

/**
 * Рисует разрез и отдаёт дерево
 *
 * @param {Object} props - свойства компонента
 * @returns {Object} корень отрисованного дерева
 */
function render(props) {
  let tree;
  act(() => {
    tree = renderer.create(<PitScheme {...props} />);
  });
  return tree.root;
}

/**
 * Собирает весь текст со схемы
 *
 * Обходит дерево вручную: children у SVG-текста содержат вложенные элементы,
 * и сериализовать их целиком нельзя — в узлах есть ссылки на родителя.
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
 * Склеивает подписи схемы в одну строку
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

describe('PitScheme', () => {
  const schemes = [
    'confined_unlimited',
    'confined_river',
    'unconfined_unlimited',
    'unconfined_river',
  ];

  schemes.forEach((scheme) => {
    it(`рисуется для схемы ${scheme}`, () => {
      const result = compute({ ...base, scheme, geom: 'area', F: 44000, rMethod: 'fromWall' });
      expect(result.ok).toBe(true);
      const root = render({ result, width: 340 });
      expect(root.findAllByType(require('react-native-svg').default).length).toBe(1);
    });
  });

  it('рисуется без результата расчёта', () => {
    const root = render({ result: null, width: 340 });
    expect(root.findAllByType(require('react-native-svg').default).length).toBe(1);
  });

  it('рисуется при ошибке ввода', () => {
    const failed = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 0, rMethod: 'fromWall' });
    expect(failed.ok).toBe(false);
    const root = render({ result: failed, width: 340 });
    expect(root.findAllByType(require('react-native-svg').default).length).toBe(1);
  });

  it('напорная схема подписывает мощность m, безнапорная — h₀', () => {
    const confinedText = textOf(
      render({ result: compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' }), width: 340 })
    );
    const unconfinedText = textOf(
      render({ result: compute({ ...base, scheme: 'unconfined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' }), width: 340 })
    );
    expect(confinedText).toContain('m');
    expect(unconfinedText).toContain('h₀');
  });

  it('у речной схемы подписан размер до реки, у неограниченной — радиус влияния', () => {
    const riverText = textOf(
      render({ result: compute({ ...base, scheme: 'confined_river', geom: 'area', F: 44000, rMethod: 'fromWall' }), width: 340 })
    );
    const plainText = textOf(
      render({ result: compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' }), width: 340 })
    );
    expect(riverText.split(' ')).toContain('L');
    expect(plainText.split(' ')).toContain('R');
  });

  it('подпись расчёта показывается, когда её передали', () => {
    const result = compute({ ...base, scheme: 'confined_unlimited', geom: 'area', F: 44000, rMethod: 'fromWall' });
    const root = render({ result, width: 340, caption: 'k = 5 м/сут · Q = 3597 м³/сут' });
    expect(textOf(root)).toContain('3597');
  });

  it('высота держит пропорции полотна', () => {
    let tree;
    act(() => {
      tree = renderer.create(<PitScheme result={null} width={350} />);
    });
    const svg = tree.root.findByType(require('react-native-svg').default);
    expect(svg.props.height).toBeCloseTo((350 * 378) / 700, 6);
  });
});
