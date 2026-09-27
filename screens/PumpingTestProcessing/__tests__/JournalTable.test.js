/**
 * Таблица журнала экспресс-опробования
 *
 * «Далее» на клавиатуре ведёт t → s → t следующей строки, а на заполненной
 * последней заводит новую: раньше на каждый замер уходило четыре касания.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import JournalTable from '../JournalTable';

const ROWS = [
  { key: 'a', tText: '1', sText: '0.5' },
  { key: 'b', tText: '2', sText: '0.7' },
];

const render = (rows, onAdd = jest.fn()) => (
  <PaperProvider theme={lightTheme}>
    <JournalTable
      rows={rows}
      onChange={() => {}}
      onAdd={onAdd}
      onRemove={() => {}}
      timeUnit="мин"
      valueUnit="м"
    />
  </PaperProvider>
);

const mount = (rows, onAdd) => {
  let tree;
  act(() => {
    tree = renderer.create(render(rows, onAdd));
  });
  return tree;
};

const fields = (tree) => tree.root.findAllByType(TextInput);

test('«Далее» ведёт из t в s той же строки и дальше в следующую', () => {
  const tree = mount(ROWS);
  const [t1, s1, t2] = fields(tree);
  // focus у мока поля общий на все поля; чьё поле получило фокус — по this
  const focus = t1.instance.focus;

  act(() => t1.props.onSubmitEditing());
  expect(focus.mock.contexts.at(-1)).toBe(s1.instance);

  act(() => s1.props.onSubmitEditing());
  expect(focus.mock.contexts.at(-1)).toBe(t2.instance);
});

test('на заполненной последней строке «Далее» заводит новую и ставит в неё курсор', () => {
  const onAdd = jest.fn();
  const tree = mount(ROWS, onAdd);

  act(() => fields(tree)[3].props.onSubmitEditing());
  expect(onAdd).toHaveBeenCalledTimes(1);

  // Экран дописал строку — курсор встаёт в её t
  act(() => tree.update(render([...ROWS, { key: 'c', tText: '', sText: '' }], onAdd)));
  const newTime = fields(tree)[4];
  expect(newTime.instance.focus.mock.contexts.at(-1)).toBe(newTime.instance);
});

test('недописанная последняя строка новую не заводит', () => {
  const onAdd = jest.fn();
  const tree = mount([{ key: 'a', tText: '1', sText: '' }], onAdd);

  act(() => fields(tree)[1].props.onSubmitEditing());

  expect(onAdd).not.toHaveBeenCalled();
});
