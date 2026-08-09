/**
 * Описание таблиц для синхронизации
 *
 * Здесь и только здесь задано соответствие между локальными колонками
 * SQLite и полями серверной таблицы. Всё остальное в `sync/` работает
 * с этим описанием и не знает про конкретные поля журналов или точек.
 */

/**
 * Переводит момент времени в ISO-строку для сервера
 *
 * @param {number|null} ms - миллисекунды epoch
 * @returns {string|null} ISO-строка или null
 */
const toIso = (ms) => (ms ? new Date(ms).toISOString() : null);

/**
 * Переводит серверную метку времени в миллисекунды
 *
 * @param {string|null} iso - ISO-строка
 * @returns {number|null} миллисекунды epoch или null
 */
const toMs = (iso) => (iso ? new Date(iso).getTime() : null);

export const SYNC_TABLES = [
  {
    name: 'projects',
    remote: 'projects',
    // Порядок важен: журнал должен уехать раньше своих замеров,
    // иначе внешний ключ на сервере отклонит вставку
    order: 1,
    toRemote: (row, ownerId) => ({
      id: row.id,
      owner_id: ownerId,
      name: row.name,
      ofr_type: row.ofr_type,
      q: row.q,
      pumping_duration: row.pumping_duration,
      starred: row.starred === 1,
      result_t: row.result_t,
      result_slope: row.result_slope,
      result_method: row.result_method,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
      deleted_at: toIso(row.deleted_at),
    }),
    toLocal: (row) => ({
      id: row.id,
      name: row.name,
      ofr_type: row.ofr_type,
      q: row.q,
      pumping_duration: row.pumping_duration,
      starred: row.starred ? 1 : 0,
      result_t: row.result_t,
      result_slope: row.result_slope,
      result_method: row.result_method,
      created_at: toMs(row.created_at) ?? Date.now(),
      updated_at: toMs(row.updated_at) ?? Date.now(),
      deleted_at: toMs(row.deleted_at),
    }),
    columns: [
      'id', 'name', 'ofr_type', 'q', 'pumping_duration', 'starred',
      'result_t', 'result_slope', 'result_method',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    name: 'measurements',
    remote: 'measurements',
    order: 2,
    toRemote: (row, ownerId) => ({
      id: row.id,
      project_id: row.project_id,
      owner_id: ownerId,
      t: row.t,
      s: row.s,
      sort_order: row.sort_order,
      updated_at: toIso(row.updated_at),
      deleted_at: toIso(row.deleted_at),
    }),
    toLocal: (row) => ({
      id: row.id,
      project_id: row.project_id,
      t: row.t,
      s: row.s,
      sort_order: row.sort_order,
      updated_at: toMs(row.updated_at) ?? Date.now(),
      deleted_at: toMs(row.deleted_at),
    }),
    columns: ['id', 'project_id', 't', 's', 'sort_order', 'updated_at', 'deleted_at'],
  },
  {
    name: 'observation_points',
    remote: 'observation_points',
    order: 3,
    toRemote: (row, ownerId) => ({
      id: row.id,
      owner_id: ownerId,
      title: row.title,
      type: row.type,
      lat: row.lat,
      lon: row.lon,
      note: row.note,
      recorded_at: toIso(row.recorded_at),
      updated_at: toIso(row.updated_at),
      deleted_at: toIso(row.deleted_at),
    }),
    toLocal: (row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      lat: row.lat,
      lon: row.lon,
      note: row.note,
      recorded_at: toMs(row.recorded_at) ?? Date.now(),
      updated_at: toMs(row.updated_at) ?? Date.now(),
      deleted_at: toMs(row.deleted_at),
    }),
    columns: ['id', 'title', 'type', 'lat', 'lon', 'note', 'recorded_at', 'updated_at', 'deleted_at'],
  },
];
