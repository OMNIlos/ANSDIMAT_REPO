/**
 * Проверка канонической сериализации
 *
 * Смысл модуля один: одинаковое содержимое должно давать одинаковую строку
 * независимо от того, в каком порядке собирали объект. На этом держится
 * контрольная сумма файла.
 */

import { canonicalJson } from '../canonicalJson';

describe('canonicalJson', () => {
  test('порядок ключей не влияет на результат', () => {
    const first = { b: 1, a: 2, c: { z: 3, y: 4 } };
    const second = { c: { y: 4, z: 3 }, a: 2, b: 1 };

    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(canonicalJson(first)).toBe('{"a":2,"b":1,"c":{"y":4,"z":3}}');
  });

  test('порядок элементов массива сохраняется', () => {
    // Замеры идут по возрастанию времени: сортировка здесь была бы порчей
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJson([3, 1, 2])).not.toBe(canonicalJson([1, 2, 3]));
  });

  test('undefined в объекте отбрасывается, а в массиве становится null', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(canonicalJson([1, undefined, 2])).toBe('[1,null,2]');
  });

  test('null сохраняется как значение', () => {
    // Отличается от undefined: «координата не задана» — это факт о скважине
    expect(canonicalJson({ lat: null })).toBe('{"lat":null}');
  });

  test('нечисловые числа не ломают JSON', () => {
    expect(canonicalJson({ t: NaN, s: Infinity })).toBe('{"s":null,"t":null}');
  });

  test('строки экранируются как в JSON', () => {
    expect(canonicalJson('Куст «3»\n')).toBe(JSON.stringify('Куст «3»\n'));
  });

  test('результат разбирается обратно как JSON', () => {
    const value = { name: 'Скв. 7Ц', wells: [{ order: 0, name: '1w' }], q: 1.5 };
    expect(JSON.parse(canonicalJson(value))).toEqual(value);
  });
});
