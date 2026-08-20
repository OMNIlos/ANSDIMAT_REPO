/**
 * Репозиторий скважин опробования
 *
 * Скважины есть у кустовой откачки: одна опытная и сколько угодно
 * наблюдательных. Каждая ведёт свой ряд замеров и даёт свою кривую на
 * графике — связь идёт через `measurements.well_id`.
 *
 * Опытная скважина в проекте одна. Ограничение держится здесь, а не на
 * экране: добавить вторую можно было бы и синхронизацией с другого
 * устройства, а схема с двумя опытными — это уже групповая откачка.
 */

import { getDatabase, createId } from './index';
import { WELL_ROLES } from './schema';

/**
 * Преобразует строку таблицы в объект скважины
 *
 * @param {Object} row - строка из SQLite
 * @returns {Object} скважина
 */
function mapWell(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    role: row.role,
    // Расстояние до опытной скважины, м. У самой опытной здесь её радиус r0
    distance: row.distance ?? 0,
    // Понижение на момент остановки насоса, м. Ноль значит «не задано»:
    // тогда его берут из последней строки журнала откачки этой скважины
    finalDrawdown: row.final_drawdown ?? 0,
    // Положение на карте. Пусто, пока скважину туда не поставили
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    order: row.sort_order,
  };
}

/**
 * Возвращает скважины проекта по порядку
 *
 * @param {string} projectId - идентификатор проекта
 * @returns {Promise<Array>} скважины
 */
export async function listWells(projectId) {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    `SELECT * FROM wells WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY sort_order, rowid`,
    [projectId]
  );
  return rows.map(mapWell);
}

/**
 * Добавляет скважину в конец списка
 *
 * @param {string} projectId - идентификатор проекта
 * @param {Object} params
 * @param {string} params.name - название скважины
 * @param {string} [params.role] - роль, см. WELL_ROLES
 * @returns {Promise<Object|null>} созданная скважина; null, если опытная уже
 *   есть, а просят вторую
 */
export async function createWell(
  projectId,
  { name, role = WELL_ROLES.OBSERVATION, distance = 0 }
) {
  const database = await getDatabase();

  if (role === WELL_ROLES.PUMPING) {
    const existing = await database.getFirstAsync(
      `SELECT id FROM wells
        WHERE project_id = ? AND role = ? AND deleted_at IS NULL`,
      [projectId, WELL_ROLES.PUMPING]
    );
    if (existing) return null;
  }

  const row = await database.getFirstAsync(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM wells WHERE project_id = ?',
    [projectId]
  );
  const order = (row?.max_order ?? -1) + 1;

  const id = createId();
  const now = Date.now();
  await database.runAsync(
    `INSERT INTO wells (id, project_id, name, role, distance, sort_order, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, projectId, name, role, distance, order, now]
  );
  await database.runAsync(
    'UPDATE projects SET updated_at = ?, dirty = 1 WHERE id = ?',
    [now, projectId]
  );

  return { id, projectId, name, role, distance, finalDrawdown: 0, order };
}

/**
 * Задаёт расстояние от скважины до опытной
 *
 * У самой опытной скважины это её радиус: расстояние «от опытной до опытной»
 * и есть r0.
 *
 * @param {string} id - идентификатор скважины
 * @param {number} distance - расстояние в базовых единицах (метрах)
 * @returns {Promise<void>}
 */
export async function setWellDistance(id, distance) {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE wells SET distance = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [isFinite(distance) ? distance : 0, Date.now(), id]
  );
}

/**
 * Задаёт понижение на момент остановки насоса у скважины
 *
 * Ноль здесь значит «не задано»: понижение тогда берётся из последней строки
 * журнала откачки этой же скважины, см. finalDrawdownAtStop. Число своё у
 * каждой скважины куста, и общее на весь журнал давало остаточное понижение
 * чужой скважины.
 *
 * @param {string} id - идентификатор скважины
 * @param {number} finalDrawdown - понижение в базовых единицах (метрах)
 * @returns {Promise<void>}
 */
export async function setWellFinalDrawdown(id, finalDrawdown) {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE wells SET final_drawdown = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [isFinite(finalDrawdown) && finalDrawdown > 0 ? finalDrawdown : 0, Date.now(), id]
  );
}

/**
 * Запоминает положение скважины на карте
 *
 * Расстояние здесь не трогается: его пересчитывает экран по координатам всех
 * скважин сразу — сдвинули опытную, и поехали все расстояния до неё.
 *
 * @param {string} id - идентификатор скважины
 * @param {{lat: number, lon: number}} position - координаты
 * @returns {Promise<void>}
 */
export async function setWellPosition(id, { lat, lon }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE wells SET lat = ?, lon = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [lat, lon, Date.now(), id]
  );
}

/**
 * Переименовывает скважину
 *
 * @param {string} id - идентификатор скважины
 * @param {string} name - новое название
 * @returns {Promise<void>}
 */
export async function renameWell(id, name) {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE wells SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [name, Date.now(), id]
  );
}

/**
 * Удаляет скважину вместе с её замерами
 *
 * Опытная скважина не удаляется: без неё в кустовой откачке нет ни дебита,
 * ни точки отсчёта расстояний. Удаление мягкое — физически стёртую строку
 * второе устройство не увидит и зальёт обратно.
 *
 * @param {string} id - идентификатор скважины
 * @returns {Promise<boolean>} удалена ли скважина
 */
export async function deleteWell(id) {
  const database = await getDatabase();
  const well = await database.getFirstAsync('SELECT role FROM wells WHERE id = ?', [id]);
  if (!well || well.role === WELL_ROLES.PUMPING) return false;

  const now = Date.now();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE wells SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [now, now, id]
    );
    await database.runAsync(
      'UPDATE measurements SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE well_id = ?',
      [now, now, id]
    );
  });
  return true;
}
