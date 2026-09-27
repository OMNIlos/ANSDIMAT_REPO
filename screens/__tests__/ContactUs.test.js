/**
 * Контакты: офисы вместо персоналий
 *
 * На экране были имена сотрудников и их места работы. Заказчик попросил
 * оставить только офисы — адрес, телефон, почту — и адрес техподдержки.
 * Кнопка «Перейти на сайт» ведёт на версию сайта на языке приложения.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';
import { LanguageContext } from '../../LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => ({})) }));

const ContactUs = require('../ContactUs').default;

let openURL;

beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  openURL.mockRestore();
});

const mount = (locale) => {
  I18n.locale = locale;
  let tree;
  act(() => {
    tree = renderer.create(
      <LanguageContext.Provider value={{ locale, toggleLanguage: () => {} }}>
        <PaperProvider theme={lightTheme}>
          <ContactUs />
        </PaperProvider>
      </LanguageContext.Provider>
    );
  });
  return tree;
};

const screenText = (tree) =>
  tree.root
    .findAll((node) => typeof node.props?.children === 'string', { deep: true })
    .map((node) => node.props.children)
    .join(' | ');

const press = (tree, label) =>
  act(() => {
    tree.root
      .find((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')
      .props.onPress();
  });

test('имён сотрудников на экране нет', () => {
  const text = screenText(mount('ru'));

  ['Боронина', 'Никулинов', 'Нева Грунтовые', 'Институт геоэкологии'].forEach((name) =>
    expect(text).not.toContain(name)
  );
});

test('международный офис в Австралии', () => {
  const text = screenText(mount('ru'));

  expect(text).toContain('Международный офис АНСДИМАТ');
  expect(text).toContain('16 Newton Street, Bayswater 6053, WA, Australia');
  expect(text).toContain('+61 478 633 429');
  expect(text).toContain('support@ansdimat.com');
});

test('центральный офис разработки в Петербурге', () => {
  const text = screenText(mount('ru'));

  expect(text).toContain('Центральный офис разработки АНСДИМАТ');
  expect(text).toContain('РФ, Санкт-Петербург, Средний проспект В.О., д.41');
  expect(text).toContain('+7 905 268 06 28');
  expect(text).toContain('support-russia@ansdimat.com');
});

test('сайт и техподдержка — annik@ansdimat.com', () => {
  const text = screenText(mount('ru'));

  expect(text).toContain('annik@ansdimat.com');
  expect(text).not.toContain('info@ansdimat.com');
});

test('телефон российского офиса набирается нажатием', () => {
  const tree = mount('ru');

  press(tree, '+7 905 268 06 28');

  expect(openURL).toHaveBeenCalledWith('tel:+79052680628');
});

test('кнопка сайта на русском ведёт на русский сайт', () => {
  const tree = mount('ru');

  press(tree, 'Перейти на сайт АНСДИМАТ');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/Ru/');
});

test('кнопка сайта на английском ведёт на английский сайт', () => {
  const tree = mount('en');

  press(tree, 'Go to ANSDIMAT Website');

  expect(openURL).toHaveBeenCalledWith('https://ansdimat.com/');
});

test('на английском офисы названы по-английски', () => {
  const text = screenText(mount('en'));

  expect(text).toContain('International ANSDIMAT Office');
  expect(text).toContain('ANSDIMAT Central Development Office');
});
