/**
 * Проверка признака видимости плавающего меню
 *
 * Меню прячет развёрнутый график, а возвращает его снятие разворота или уход
 * с экрана. Худший исход здесь — залипшее скрытие: меню пропадёт по всему
 * приложению, и вернуть его будет нечем.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { setMenuHidden, useMenuHidden } from '../chromeVisibility';

/** Снимки значения хука по мере изменений */
function track() {
  const seen = [];
  function Probe() {
    seen.push(useMenuHidden());
    return null;
  }
  let tree;
  act(() => {
    tree = renderer.create(<Probe />);
  });
  return { seen, stop: () => act(() => tree.unmount()) };
}

afterEach(() => setMenuHidden(false));

test('по умолчанию меню показывается', () => {
  const { seen, stop } = track();
  expect(seen[0]).toBe(false);
  stop();
});

test('скрытие и возврат доходят до подписчика', () => {
  const { seen, stop } = track();
  act(() => setMenuHidden(true));
  act(() => setMenuHidden(false));
  stop();
  expect(seen).toContain(true);
  expect(seen[seen.length - 1]).toBe(false);
});

test('отписавшийся экран больше не обновляется', () => {
  // Экран ушёл, а меню осталось скрытым — так его было бы не вернуть
  const { seen, stop } = track();
  stop();
  const before = seen.length;
  act(() => setMenuHidden(true));
  expect(seen.length).toBe(before);
});
