/**
 * Репозиторий настроек
 *
 * Настройки лежат парами ключ-значение: их состав меняется чаще схемы,
 * и добавление тумблера не должно требовать миграции.
 * Значения сериализуются в JSON, поэтому булевы и числовые настройки
 * возвращаются в исходном типе, а не строками.
 */

import { getDatabase } from './index';
import { DEFAULT_SETTINGS } from './schema';

/**
 * Читает все настройки, подставляя значения по умолчанию
 *
 * @returns {Promise<Object>} настройки
 */
export async function getSettings() {
  const database = await getDatabase();
  const rows = await database.getAllAsync('SELECT key, value FROM settings');

  const stored = {};
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value);
    } catch {
      // Повреждённое значение игнорируем — подставится значение по умолчанию
    }
  }

  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * Читает одну настройку
 *
 * Нужна для служебных значений, которых нет в DEFAULT_SETTINGS: отметка
 * последней синхронизации, кэш прав доступа.
 *
 * @param {string} key - ключ настройки
 * @returns {Promise<*>} значение или null, если ключа нет
 */
export async function getSetting(key) {
  const database = await getDatabase();
  const row = await database.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

/**
 * Сохраняет одну настройку
 *
 * @param {string} key - ключ настройки
 * @param {*} value - значение (сериализуемое в JSON)
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)]
  );
}

/**
 * Сохраняет несколько настроек одной транзакцией
 *
 * @param {Object} patch - изменяемые настройки
 * @returns {Promise<void>}
 */
export async function updateSettings(patch) {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(patch)) {
      await database.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, JSON.stringify(value)]
      );
    }
  });
}

/**
 * Сбрасывает настройки к значениям по умолчанию
 *
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM settings');
}
