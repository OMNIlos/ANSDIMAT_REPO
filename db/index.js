/**
 * Подключение к локальной базе и применение миграций
 *
 * Соединение открывается один раз и переиспользуется: expo-sqlite держит
 * его в нативном слое, повторное открытие только тратит время.
 */

import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './schema';

const DATABASE_NAME = 'ansdimat.db';

let databasePromise = null;

/**
 * Применяет непринятые миграции
 *
 * Версия схемы хранится в `PRAGMA user_version`, поэтому не нужна отдельная
 * служебная таблица.
 *
 * @param {Object} database - открытая база
 */
async function migrate(database) {
  const row = await database.getFirstAsync('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion >= MIGRATIONS.length) return;

  // Внешние ключи на время миграции выключены: перенос данных проходит через
  // промежуточные состояния, где связь временно нарушена — например, при смене
  // ключа проекта в v4. Проверка вернётся сразу после применения миграций.
  await database.execAsync('PRAGMA foreign_keys = OFF');
  try {
    for (let version = currentVersion; version < MIGRATIONS.length; version++) {
      await database.execAsync(MIGRATIONS[version]);
    }

    // PRAGMA не принимает подстановки параметров
    await database.execAsync(`PRAGMA user_version = ${MIGRATIONS.length}`);
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON');
  }
}

/**
 * Возвращает открытое соединение с базой, применив миграции
 *
 * @returns {Promise<Object>} соединение expo-sqlite
 */
export function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      // Внешние ключи в SQLite выключены по умолчанию — без этого
      // каскадное удаление замеров вместе с проектом не сработает.
      // Включает их migrate: сама миграция должна идти с выключенными.
      await migrate(database);
      await database.execAsync('PRAGMA foreign_keys = ON');
      return database;
    })();
  }
  return databasePromise;
}

/**
 * Закрывает соединение. Нужно в тестах и при полном сбросе данных.
 */
export async function closeDatabase() {
  if (!databasePromise) return;
  const database = await databasePromise;
  await database.closeAsync();
  databasePromise = null;
}

/**
 * Генерирует идентификатор записи
 *
 * Записи заводятся на устройстве, в том числе офлайн, поэтому идентификатор
 * должен быть уникален без обращения к серверу. Отсюда UUID: серверные
 * таблицы объявлены как uuid, и короткая строка туда просто не пройдёт.
 *
 * @returns {string} идентификатор
 */
export function createId() {
  // UUID, а не своя строка: идентификатор присваивается на устройстве, в том
  // числе офлайн, и должен без конфликтов лечь в общую таблицу на сервере
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  // Запасной путь для окружений без Web Crypto (старые Android WebView)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
