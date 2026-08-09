/**
 * Репозиторий точек наблюдения полевого дневника
 */

import { getDatabase, createId } from './index';
import { POINT_TYPES } from './schema';

/**
 * Преобразует строку таблицы в точку наблюдения
 *
 * @param {Object} row - строка из SQLite
 * @returns {Object} точка наблюдения
 */
function mapPoint(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    lat: row.lat,
    lon: row.lon,
    note: row.note ?? '',
    recordedAt: row.recorded_at,
  };
}

/**
 * Возвращает точки наблюдения, новые первыми
 *
 * @returns {Promise<Array>} точки
 */
export async function listPoints() {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    'SELECT * FROM observation_points WHERE deleted_at IS NULL ORDER BY recorded_at DESC'
  );
  return rows.map(mapPoint);
}

/**
 * Создаёт точку наблюдения
 *
 * @param {Object} params
 * @param {string} params.title - название
 * @param {number} params.lat - широта
 * @param {number} params.lon - долгота
 * @param {string} [params.type] - тип точки
 * @param {string} [params.note] - примечание
 * @returns {Promise<Object>} созданная точка
 */
export async function createPoint({ title, lat, lon, type = POINT_TYPES.OBSERVATION, note = '' }) {
  const database = await getDatabase();
  const id = createId();
  const recordedAt = Date.now();

  await database.runAsync(
    `INSERT INTO observation_points
       (id, title, type, lat, lon, note, recorded_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, title, type, lat, lon, note, recordedAt, recordedAt]
  );

  return { id, title, type, lat, lon, note, recordedAt };
}

/**
 * Обновляет точку наблюдения
 *
 * @param {string} id - идентификатор
 * @param {Object} patch - изменяемые поля: title, type, lat, lon, note
 * @returns {Promise<void>}
 */
export async function updatePoint(id, patch) {
  const database = await getDatabase();

  const columns = [];
  const values = [];

  for (const [field, column] of [
    ['title', 'title'],
    ['type', 'type'],
    ['lat', 'lat'],
    ['lon', 'lon'],
    ['note', 'note'],
  ]) {
    if (patch[field] !== undefined) {
      columns.push(`${column} = ?`);
      values.push(patch[field]);
    }
  }

  if (columns.length === 0) return;
  columns.push('updated_at = ?', 'dirty = 1');
  values.push(Date.now(), id);

  await database.runAsync(
    `UPDATE observation_points SET ${columns.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Удаляет точку наблюдения
 *
 * @param {string} id - идентификатор
 * @returns {Promise<void>}
 */
export async function deletePoint(id) {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    'UPDATE observation_points SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [now, now, id]
  );
}

/**
 * Считает статистику для карточек над картой
 *
 * @returns {Promise<{total: number, types: number, lastRecordedAt: number|null}>}
 */
export async function getPointStats() {
  const database = await getDatabase();
  const row = await database.getFirstAsync(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT type) AS types,
            MAX(recorded_at) AS last_recorded
     FROM observation_points
     WHERE deleted_at IS NULL`
  );
  return {
    total: row?.total ?? 0,
    types: row?.types ?? 0,
    lastRecordedAt: row?.last_recorded ?? null,
  };
}
