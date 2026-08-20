/**
 * Репозиторий проектов (журналов ОФР) и их замеров
 *
 * Наружу отдаются объекты в camelCase, внутри база хранит snake_case —
 * преобразование собрано в mapRow, чтобы имена колонок не расползались
 * по экранам.
 */

import { getDatabase, createId } from './index';
import { OFR_TYPES, MEASUREMENT_PHASES, WELL_ROLES } from './schema';

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
    // Понижение на момент остановки насоса, м — от него отсчитывается
    // восстановление уровня
    finalDrawdown: row.final_drawdown ?? 0,
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
    // Замеры до v5 колонки не имели: считаем их откачкой — там они и лежали
    phase: row.phase ?? MEASUREMENT_PHASES.PUMPING,
    // Скважина, к которой относится замер. Пусто у видов ОФР с одной
    // скважиной: там ряд замеров единственный, и делить его не по чему
    wellId: row.well_id ?? null,
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
 * Журналы двух фаз отдаются раздельно: смешивать их нельзя, потому что
 * время в них отсчитывается от разных моментов. Замеры откачки остаются в
 * поле `measurements` — журналы, где фаза одна, читают его как и раньше.
 *
 * @param {string} id - идентификатор проекта
 * @returns {Promise<Object|null>} проект с полями measurements и
 *   recoveryMeasurements или null
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
  const measurements = measurementRows.map(mapMeasurement);

  const wellRows = await database.getAllAsync(
    `SELECT * FROM wells WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY sort_order, rowid`,
    [id]
  );

  return {
    ...mapProject(row),
    // Скважины опробования: у кустовой откачки их несколько, у остальных
    // видов список пуст
    wells: wellRows.map((well) => ({
      id: well.id,
      projectId: well.project_id,
      name: well.name,
      role: well.role,
      // Расстояние до опытной скважины; у самой опытной — её радиус
      distance: well.distance ?? 0,
      // Понижение на момент остановки насоса. Ноль значит «не задано»:
      // тогда его берут из последней строки журнала откачки этой скважины
      finalDrawdown: well.final_drawdown ?? 0,
      lat: well.lat ?? null,
      lon: well.lon ?? null,
      order: well.sort_order,
    })),
    measurements: measurements.filter((m) => m.phase !== MEASUREMENT_PHASES.RECOVERY),
    recoveryMeasurements: measurements.filter((m) => m.phase === MEASUREMENT_PHASES.RECOVERY),
  };
}

/**
 * Создаёт проект
 *
 * Кустовая откачка заводится сразу с парой скважин: опытной и одной
 * наблюдательной. Пустой куст бессмысленен — качать неоткуда и следить
 * не за чем, — поэтому обе создаются здесь, а не по первому нажатию
 * «добавить» на экране обработки.
 *
 * @param {Object} params
 * @param {string} params.name - название
 * @param {string} [params.ofrType] - тип ОФР
 * @param {number} [params.Q] - дебит, м³/сут
 * @param {string} [params.pumpingWellName] - название опытной скважины
 * @param {string} [params.observationWellName] - название наблюдательной
 * @returns {Promise<Object>} созданный проект вместе со скважинами
 */
export async function createProject({
  name,
  ofrType = OFR_TYPES.SINGLE,
  Q = 0,
  pumpingWellName,
  observationWellName,
}) {
  const database = await getDatabase();
  const id = createId();
  const now = Date.now();

  const wells =
    ofrType === OFR_TYPES.CLUSTER
      ? [
          { id: createId(), name: pumpingWellName || '1w', role: WELL_ROLES.PUMPING },
          { id: createId(), name: observationWellName || '1p', role: WELL_ROLES.OBSERVATION },
        ]
      : [];

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO projects (id, name, ofr_type, q, starred, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, 0, ?, ?, 1)`,
      [id, name, ofrType, Q, now, now]
    );

    for (let index = 0; index < wells.length; index++) {
      const well = wells[index];
      await database.runAsync(
        `INSERT INTO wells (id, project_id, name, role, distance, sort_order, updated_at, dirty)
         VALUES (?, ?, ?, ?, 0, ?, ?, 1)`,
        [well.id, id, well.name, well.role, index, now]
      );
    }
  });

  return {
    id,
    name,
    ofrType,
    Q,
    starred: false,
    wells: wells.map((well, index) => ({ ...well, projectId: id, order: index })),
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
  if (patch.finalDrawdown !== undefined) {
    columns.push('final_drawdown = ?');
    values.push(patch.finalDrawdown);
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
    await database.runAsync(
      'UPDATE wells SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE project_id = ?',
      [now, now, id]
    );
  });
}

/**
 * Заменяет набор замеров проекта в пределах одной фазы
 *
 * Замеры редактируются таблицей целиком, поэтому проще переписать набор
 * одной транзакцией, чем отслеживать добавления и удаления по одному.
 *
 * Фаза и скважина ограничивают и запись, и зачистку: без них сохранение
 * одного журнала помечало бы удалёнными замеры всех остальных — их нет в
 * переданном списке, и они попадали бы под `NOT IN`.
 *
 * @param {string} projectId - идентификатор проекта
 * @param {Array<{t: number, s: number}>} measurements - замеры по порядку
 * @param {string} [phase] - период опробования, см. MEASUREMENT_PHASES
 * @param {string|null} [wellId] - скважина; null у видов ОФР с одной скважиной
 * @returns {Promise<void>}
 */
export async function replaceMeasurements(
  projectId,
  measurements,
  phase = MEASUREMENT_PHASES.PUMPING,
  wellId = null
) {
  const database = await getDatabase();

  const now = Date.now();
  const keep = measurements.map((m) => m.id).filter(Boolean);

  await database.withTransactionAsync(async () => {
    for (let index = 0; index < measurements.length; index++) {
      const m = measurements[index];
      const id = m.id ?? createId();
      await database.runAsync(
        `INSERT INTO measurements
           (id, project_id, well_id, t, s, phase, sort_order, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           well_id = excluded.well_id,
           t = excluded.t, s = excluded.s, phase = excluded.phase,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at, deleted_at = NULL, dirty = 1`,
        [id, projectId, wellId, m.t, m.s, phase, index, now]
      );
      keep.push(id);
    }

    // Строки, которых больше нет в таблице, помечаем удалёнными
    const placeholders = keep.map(() => '?').join(',') || "''";
    // `well_id IS ?` вместо `=`: у видов ОФР с одной скважиной здесь NULL,
    // а обычное сравнение с NULL не истинно никогда — зачистка молча
    // не срабатывала бы, и удалённые строки оставались в журнале
    await database.runAsync(
      `UPDATE measurements SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE project_id = ? AND phase = ? AND well_id IS ? AND deleted_at IS NULL
          AND id NOT IN (${placeholders})`,
      [now, now, projectId, phase, wellId, ...keep]
    );

    await database.runAsync(
      'UPDATE projects SET updated_at = ?, dirty = 1 WHERE id = ?',
      [now, projectId]
    );
  });
}

/**
 * Добавляет один замер в конец списка своей фазы
 *
 * Порядок считается внутри фазы и скважины: журналы нумеруются каждый с
 * нуля, иначе первая строка восстановления получила бы номер после
 * последнего замера откачки и сортировка внутри журнала поехала бы.
 *
 * @param {string} projectId - идентификатор проекта
 * @param {Object} measurement - замер {t, s, phase, wellId}
 * @returns {Promise<Object>} созданный замер
 */
export async function addMeasurement(
  projectId,
  { t = 0, s = 0, phase = MEASUREMENT_PHASES.PUMPING, wellId = null } = {}
) {
  const database = await getDatabase();
  const id = createId();

  const row = await database.getFirstAsync(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM measurements
      WHERE project_id = ? AND phase = ? AND well_id IS ?`,
    [projectId, phase, wellId]
  );
  const order = (row?.max_order ?? -1) + 1;

  await database.runAsync(
    `INSERT INTO measurements
       (id, project_id, well_id, t, s, phase, sort_order, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, projectId, wellId, t, s, phase, order, Date.now()]
  );

  return { id, projectId, wellId, t, s, phase, order };
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
