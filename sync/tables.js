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
      final_drawdown: row.final_drawdown,
      // Исходные данные видов ОФР со своей схемой — строка JSON, см.
      // db/params.js. У откачек тут null
      params: row.params ?? null,
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
      // Журналы, уехавшие до появления колонки, приходят без неё
      final_drawdown: row.final_drawdown ?? 0,
      params: row.params ?? null,
      starred: row.starred ? 1 : 0,
      result_t: row.result_t,
      result_slope: row.result_slope,
      result_method: row.result_method,
      created_at: toMs(row.created_at) ?? Date.now(),
      updated_at: toMs(row.updated_at) ?? Date.now(),
      deleted_at: toMs(row.deleted_at),
    }),
    columns: [
      'id', 'name', 'ofr_type', 'q', 'pumping_duration', 'final_drawdown', 'params',
      'starred', 'result_t', 'result_slope', 'result_method',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    name: 'wells',
    remote: 'wells',
    // Между журналом и замерами: на скважину ссылается measurements.well_id,
    // и уехать она должна раньше, иначе внешний ключ отклонит вставку
    order: 2,
    toRemote: (row, ownerId) => ({
      id: row.id,
      project_id: row.project_id,
      owner_id: ownerId,
      name: row.name,
      role: row.role,
      distance: row.distance,
      final_drawdown: row.final_drawdown,
      lat: row.lat,
      lon: row.lon,
      sort_order: row.sort_order,
      updated_at: toIso(row.updated_at),
      deleted_at: toIso(row.deleted_at),
    }),
    toLocal: (row) => ({
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      role: row.role,
      // Скважины, уехавшие до появления колонок, приходят без них
      distance: row.distance ?? 0,
      final_drawdown: row.final_drawdown ?? 0,
      lat: row.lat ?? null,
      lon: row.lon ?? null,
      sort_order: row.sort_order,
      updated_at: toMs(row.updated_at) ?? Date.now(),
      deleted_at: toMs(row.deleted_at),
    }),
    columns: [
      'id', 'project_id', 'name', 'role', 'distance', 'final_drawdown', 'lat', 'lon',
      'sort_order', 'updated_at', 'deleted_at',
    ],
  },
  {
    name: 'measurements',
    remote: 'measurements',
    order: 3,
    toRemote: (row, ownerId) => ({
      id: row.id,
      project_id: row.project_id,
      well_id: row.well_id,
      owner_id: ownerId,
      t: row.t,
      s: row.s,
      phase: row.phase,
      sort_order: row.sort_order,
      updated_at: toIso(row.updated_at),
      deleted_at: toIso(row.deleted_at),
    }),
    toLocal: (row) => ({
      id: row.id,
      project_id: row.project_id,
      // Замеры, уехавшие до появления скважин, скважины не имеют: они
      // создавались единственным рядом
      well_id: row.well_id ?? null,
      t: row.t,
      s: row.s,
      // Записи, уехавшие на сервер до появления колонки, приходят без фазы:
      // они создавались единственным журналом, то есть журналом откачки
      phase: row.phase ?? 'pumping',
      sort_order: row.sort_order,
      updated_at: toMs(row.updated_at) ?? Date.now(),
      deleted_at: toMs(row.deleted_at),
    }),
    columns: [
      'id', 'project_id', 'well_id', 't', 's', 'phase', 'sort_order',
      'updated_at', 'deleted_at',
    ],
  },
  {
    name: 'observation_points',
    remote: 'observation_points',
    order: 4,
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
