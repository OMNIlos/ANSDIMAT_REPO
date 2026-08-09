/**
 * Репозиторий проектов (журналов ОФР) и их замеров
 *
 * Наружу отдаются объекты в camelCase, внутри база хранит snake_case —
 * преобразование собрано в mapRow, чтобы имена колонок не расползались
 * по экранам.
 */

import { getDatabase, createId } from './index';
import { OFR_TYPES } from './schema';

/**
 * Преобразует строку таблицы в объект проекта
 *
 * @param {Object} row - строка из SQLite
 * @returns {Object} проект
 */
function mapProject(row) {
  return {
    id: row.id,
    name: row.name,
    ofrType: row.ofr_type,
    Q: row.q,
    // Продолжительность откачки, мин — точка отсчёта для восстановления
    pumpingDuration: row.pumping_duration ?? 0,
    starred: row.starred === 1,
    results: {
      T: row.result_t ?? null,
      slope: row.result_slope ?? null,
      method: row.result_method ?? null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Есть только в списке: getProject отдаёт сами замеры, и считать их там
    // отдельно незачем
    ...(row.measurements_count != null ? { measurementsCount: row.measurements_count } : {}),
  };
}

/**
 * Преобразует строку таблицы в объект замера
 *
 * @param {Object} row - строка из SQLite
 * @returns {Object} замер
 */
function mapMeasurement(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    t: row.t,
    s: row.s,
    order: row.sort_order,
  };
}

/**
 * Возвращает список проектов
 *
 * Избранные показываются первыми — в поле обычно работают с парой
 * закреплённых журналов.
 *
 * @param {Object} [options]
 * @param {number} [options.limit] - ограничить количество
 * @returns {Promise<Array>} проекты
 */
export async function listProjects({ limit } = {}) {
  const database = await getDatabase();
  // Число замеров считается здесь же: в списке по нему видно, заполнен
  // журнал или заведён и брошен. Отдельным запросом на каждую строку это
  // вылилось бы в десятки обращений к базе при открытии экрана
  const sql =
    `SELECT p.*,
            (SELECT count(*) FROM measurements m
              WHERE m.project_id = p.id AND m.deleted_at IS NULL) AS measurements_count
       FROM projects p
      WHERE p.deleted_at IS NULL
      ORDER BY p.starred DESC, p.updated_at DESC` + (limit ? ' LIMIT ?' : '');
  const rows = limit
    ? await database.getAllAsync(sql, [limit])
    : await database.getAllAsync(sql);
  return rows.map(mapProject);
}

/**
 * Возвращает проект вместе с замерами
 *
 * @param {string} id - идентификатор проекта
 * @returns {Promise<Object|null>} проект с полем measurements или null
 */
export async function getProject(id) {
  const database = await getDatabase();
  const row = await database.getFirstAsync(
    'SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  if (!row) return null;

  const measurementRows = await database.getAllAsync(
    'SELECT * FROM measurements WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order, t',
    [id]
  );

  return {
    ...mapProject(row),
    measurements: measurementRows.map(mapMeasurement),
  };
}

/**
 * Создаёт проект
 *
 * @param {Object} params
 * @param {string} params.name - название
 * @param {string} [params.ofrType] - тип ОФР
 * @param {number} [params.Q] - дебит, м³/сут
 * @returns {Promise<Object>} созданный проект
 */
export async function createProject({ name, ofrType = OFR_TYPES.SINGLE, Q = 0 }) {
  const database = await getDatabase();
  const id = createId();
  const now = Date.now();

  await database.runAsync(
    `INSERT INTO projects (id, name, ofr_type, q, starred, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, 0, ?, ?, 1)`,
    [id, name, ofrType, Q, now, now]
  );

  return {
    id,
    name,
    ofrType,
    Q,
    starred: false,
    results: { T: null, slope: null, method: null },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Обновляет поля проекта
 *
 * @param {string} id - идентификатор
 * @param {Object} patch - изменяемые поля: name, ofrType, Q, starred, results
 * @returns {Promise<void>}
 */
export async function updateProject(id, patch) {
  const database = await getDatabase();

  const columns = [];
  const values = [];

  if (patch.name !== undefined) {
    columns.push('name = ?');
    values.push(patch.name);
  }
  if (patch.ofrType !== undefined) {
    columns.push('ofr_type = ?');
    values.push(patch.ofrType);
  }
  if (patch.Q !== undefined) {
    columns.push('q = ?');
    values.push(patch.Q);
  }
  if (patch.pumpingDuration !== undefined) {
    columns.push('pumping_duration = ?');
    values.push(patch.pumpingDuration);
  }
  if (patch.starred !== undefined) {
    columns.push('starred = ?');
    values.push(patch.starred ? 1 : 0);
  }
  if (patch.results !== undefined) {
    columns.push('result_t = ?', 'result_slope = ?', 'result_method = ?');
    values.push(
      patch.results.T ?? null,
      patch.results.slope ?? null,
      patch.results.method ?? null
    );
  }

  if (columns.length === 0) return;

  // dirty = 1: запись изменена локально и ждёт отправки на сервер
  columns.push('updated_at = ?', 'dirty = 1');
  values.push(Date.now(), id);

  await database.runAsync(`UPDATE projects SET ${columns.join(', ')} WHERE id = ?`, values);
}

/**
 * Переключает признак «избранное»
 *
 * @param {string} id - идентификатор проекта
 * @returns {Promise<boolean>} новое состояние
 */
export async function toggleStarred(id) {
  const database = await getDatabase();
  const row = await database.getFirstAsync('SELECT starred FROM projects WHERE id = ?', [id]);
  if (!row) return false;

  const next = row.starred === 1 ? 0 : 1;
  await database.runAsync(
    'UPDATE projects SET starred = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [next, Date.now(), id]
  );
  return next === 1;
}

/**
 * Удаляет проект вместе с замерами (каскадом)
 *
 * @param {string} id - идентификатор проекта
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  const database = await getDatabase();
  const now = Date.now();
  // Удаляем мягко: физически стёртую строку второе устройство не увидит
  // и при следующей синхронизации зальёт обратно
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE projects SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [now, now, id]
    );
    await database.runAsync(
      'UPDATE measurements SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE project_id = ?',
      [now, now, id]
    );
  });
}

/**
 * Заменяет весь набор замеров проекта
 *
 * Замеры редактируются таблицей целиком, поэтому проще переписать набор
 * одной транзакцией, чем отслеживать добавления и удаления по одному.
 *
 * @param {string} projectId - идентификатор проекта
 * @param {Array<{t: number, s: number}>} measurements - замеры по порядку
 * @returns {Promise<void>}
 */
export async function replaceMeasurements(projectId, measurements) {
  const database = await getDatabase();

  const now = Date.now();
  const keep = measurements.map((m) => m.id).filter(Boolean);

  await database.withTransactionAsync(async () => {
    for (let index = 0; index < measurements.length; index++) {
      const m = measurements[index];
      const id = m.id ?? createId();
      await database.runAsync(
        `INSERT INTO measurements (id, project_id, t, s, sort_order, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           t = excluded.t, s = excluded.s, sort_order = excluded.sort_order,
           updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
        [id, projectId, m.t, m.s, index, now]
      );
      keep.push(id);
    }

    // Строки, которых больше нет в таблице, помечаем удалёнными
    const placeholders = keep.map(() => '?').join(',') || "''";
    await database.runAsync(
      `UPDATE measurements SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE project_id = ? AND deleted_at IS NULL AND id NOT IN (${placeholders})`,
      [now, now, projectId, ...keep]
    );

    await database.runAsync(
      'UPDATE projects SET updated_at = ?, dirty = 1 WHERE id = ?',
      [now, projectId]
    );
  });
}

/**
 * Добавляет один замер в конец списка
 *
 * @param {string} projectId - идентификатор проекта
 * @param {Object} measurement - замер {t, s}
 * @returns {Promise<Object>} созданный замер
 */
export async function addMeasurement(projectId, { t = 0, s = 0 } = {}) {
  const database = await getDatabase();
  const id = createId();

  const row = await database.getFirstAsync(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM measurements WHERE project_id = ?',
    [projectId]
  );
  const order = (row?.max_order ?? -1) + 1;

  await database.runAsync(
    `INSERT INTO measurements (id, project_id, t, s, sort_order, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, projectId, t, s, order, Date.now()]
  );

  return { id, projectId, t, s, order };
}

/**
 * Удаляет замер
 *
 * @param {string} id - идентификатор замера
 * @returns {Promise<void>}
 */
export async function deleteMeasurement(id) {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    'UPDATE measurements SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [now, now, id]
  );
}
