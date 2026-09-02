/**
 * Столбики волны
 *
 * Один компонент рисует и живую запись, и воспроизведение: рисуют они одно и
 * то же, отличается только источник уровней и закраска пройденной части.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import AudioWave from '../AudioWave';

/**
 * Столбики волны — вложенные View с заданной высотой
 *
 * testID стоит и на составном View, и на нативной обёртке под ним — обход
 * с deep:true отдаёт оба. Оставляем только хостовый узел (type — строка),
 * иначе каждый столбик считается дважды
 */
const bars = (tree) =>
  tree.root.findAll(
    (node) => typeof node.type === 'string' && node.props?.testID === 'audio-wave-bar',
    { deep: true }
  );

test('столбиков ровно столько, сколько уровней', () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <AudioWave levels={[0.1, 0.5, 0.9]} color="#72002F" mutedColor="#E8E4E6" />
    );
  });

  expect(bars(tree)).toHaveLength(3);
});

test('громкий участок выше тихого', () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <AudioWave levels={[0.1, 0.9]} color="#72002F" mutedColor="#E8E4E6" height={40} />
    );
  });

  const [quiet, loud] = bars(tree).map((bar) =>
    [].concat(bar.props.style).reduce((acc, style) => ({ ...acc, ...style }), {}).height
  );

  expect(loud).toBeGreaterThan(quiet);
});

test('тишина всё равно видна', () => {
  // Нулевая высота дала бы разрыв в строке, и волна выглядела бы обрезанной
  let tree;
  act(() => {
    tree = renderer.create(
      <AudioWave levels={[0]} color="#72002F" mutedColor="#E8E4E6" height={40} />
    );
  });

  const [style] = bars(tree).map((bar) =>
    [].concat(bar.props.style).reduce((acc, item) => ({ ...acc, ...item }), {})
  );

  expect(style.height).toBeGreaterThanOrEqual(2);
});

test('пройденная часть закрашена, остальная приглушена', () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <AudioWave levels={[0.5, 0.5, 0.5, 0.5]} progress={0.5} color="#72002F" mutedColor="#E8E4E6" />
    );
  });

  const colors = bars(tree).map((bar) =>
    [].concat(bar.props.style).reduce((acc, item) => ({ ...acc, ...item }), {}).backgroundColor
  );

  expect(colors).toEqual(['#72002F', '#72002F', '#E8E4E6', '#E8E4E6']);
});

test('без уровней компонент ничего не рисует', () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <AudioWave levels={[]} color="#72002F" mutedColor="#E8E4E6" />
    );
  });

  expect(bars(tree)).toHaveLength(0);
});
