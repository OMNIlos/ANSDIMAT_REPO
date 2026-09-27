/**
 * Детерминированная сериализация JSON
 *
 * Нужна ровно для одного: контрольная сумма должна сойтись у отправителя и
 * получателя. `JSON.stringify` порядок ключей не гарантирует — он повторяет
 * порядок вставки, а тот зависит от того, как объект собрали. Пересобери
 * приложение иначе, и сумма к тому же содержимому получится другая.
 *
 * Здесь ключи всегда отсортированы, пробелов нет, `undefined` отбрасывается.
 */

/**
 * Сериализует значение в канонический JSON
 *
 * @param {*} value - значение
 * @returns {string} JSON без пробелов с отсортированными ключами
 */
export function canonicalJson(value) {
  if (value === null || value === undefined) return 'null';

  const kind = typeof value;

  if (kind === 'boolean') return value ? 'true' : 'false';

  if (kind === 'number') {
    // NaN и бесконечности в JSON не выражаются. Записываем null — так же
    // поступает JSON.stringify, и разбор не разойдётся со сборкой
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }

  if (kind === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    // Порядок элементов массива значим и сохраняется: замеры идут по
    // возрастанию времени, и сортировать их здесь было бы порчей данных
    return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  }

  if (kind === 'object') {
    const parts = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key]));
    return '{' + parts.join(',') + '}';
  }

  // Функции и символы в данные проекта попасть не могут, но молча выдавать
  // на них невалидный JSON нельзя — сумма перестала бы что-либо значить
  return 'null';
}
