/**
 * Схема локальной базы данных
 *
 * SQLite — источник истины: приложение работает в поле без связи, поэтому
 * всё пишется локально, а синхронизация с сервером (если появится) будет
 * надстройкой над этими же таблицами.
 *
 * Миграции применяются по порядку и отслеживаются через `PRAGMA user_version`.
 * Чтобы изменить схему, добавьте новую миграцию в конец массива — уже
 * применённые не трогайте, иначе установленные приложения не обновятся.
 */

/** Типы опытно-фильтрационных работ */
export const OFR_TYPES = {
  SINGLE: 'single',       // Одиночная откачка
  CLUSTER: 'cluster',     // Кустовая откачка
  FILL: 'fill',           // Налив
  RECOVERY: 'recovery',   // Восстановление уровня
};

/** Типы точек полевого дневника */
export const POINT_TYPES = {
  WELL: 'well',                 // Скважина
  SPRING: 'spring',             // Родник
  PIT: 'pit',                   // Шурф
  OBSERVATION: 'observation',   // Точка наблюдения
};

/**
 * Миграции. Индекс в массиве + 1 = целевая версия схемы.
 */
export const MIGRATIONS = [
  // v1 — базовые таблицы
  `
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    ofr_type    TEXT NOT NULL DEFAULT 'single',
    q           REAL NOT NULL DEFAULT 0,
    starred     INTEGER NOT NULL DEFAULT 0,
    result_t    REAL,
    result_slope REAL,
    result_method TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id          TEXT PRIMARY KEY NOT NULL,
    project_id  TEXT NOT NULL,
    t           REAL NOT NULL,
    s           REAL NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_measurements_project
    ON measurements (project_id, sort_order);

  CREATE TABLE IF NOT EXISTS observation_points (
    id          TEXT PRIMARY KEY NOT NULL,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'observation',
    lat         REAL NOT NULL,
    lon         REAL NOT NULL,
    note        TEXT,
    recorded_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_points_recorded
    ON observation_points (recorded_at DESC);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
  `,

  // v2 — продолжительность откачки: нужна для обработки восстановления
  // уровня, где время отсчитывается от момента остановки насоса
  `
  ALTER TABLE projects ADD COLUMN pumping_duration REAL NOT NULL DEFAULT 0;
  `,

  // v3 — поля синхронизации.
  //
  // updated_at хранит серверное время последней правки, dirty помечает
  // записи, ещё не отправленные на сервер, deleted_at даёт мягкое удаление:
  // без него второе устройство, бывшее офлайн, зальёт удалённую строку обратно.
  `
  -- updated_at у projects есть с первой версии, здесь только новые поля
  ALTER TABLE projects ADD COLUMN deleted_at INTEGER;
  ALTER TABLE projects ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;

  ALTER TABLE measurements ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE measurements ADD COLUMN deleted_at INTEGER;
  ALTER TABLE measurements ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;

  ALTER TABLE observation_points ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE observation_points ADD COLUMN deleted_at INTEGER;
  ALTER TABLE observation_points ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;

  CREATE TABLE IF NOT EXISTS sync_state (
    table_name     TEXT PRIMARY KEY NOT NULL,
    last_pulled_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z'
  );

  CREATE INDEX IF NOT EXISTS idx_projects_dirty ON projects (dirty);
  CREATE INDEX IF NOT EXISTS idx_measurements_dirty ON measurements (dirty);
  CREATE INDEX IF NOT EXISTS idx_points_dirty ON observation_points (dirty);
  `,

  // v4 — перевод старых идентификаторов на UUID.
  //
  // До синхронизации идентификаторы были короткими строками вида
  // «ms4fm6bq-njzw6zg7». Серверные таблицы объявлены как uuid, поэтому первая
  // же отправка таких записей падает с «invalid input syntax for type uuid».
  // Переписываем их здесь: журналы, созданные до подключения аккаунтов, должны
  // уехать на сервер, а не остаться навсегда в очереди.
  //
  // Условие NOT LIKE отбирает записи по форме 8-4-4-4-12: подчёркивание в LIKE
  // означает любой одиночный символ, поэтому уже корректные UUID не трогаются
  // и повторный прогон миграции ничего не сломает.
  //
  // Внешние ключи на время миграции выключены (см. migrate в index.js):
  // при переименовании ключа проекта промежуточное состояние неизбежно
  // нарушает связь с замерами, в каком бы порядке ни шли UPDATE.
  `
  CREATE TABLE _uuid_remap (
    old_id TEXT PRIMARY KEY NOT NULL,
    new_id TEXT NOT NULL
  );

  INSERT INTO _uuid_remap (old_id, new_id)
  SELECT id, lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', (random() & 3) + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    )
  FROM projects
  WHERE id NOT LIKE '________-____-____-____-____________';

  UPDATE measurements
     SET project_id = (SELECT new_id FROM _uuid_remap WHERE old_id = project_id)
   WHERE project_id IN (SELECT old_id FROM _uuid_remap);

  UPDATE projects
     SET id = (SELECT new_id FROM _uuid_remap WHERE old_id = id)
   WHERE id IN (SELECT old_id FROM _uuid_remap);

  DROP TABLE _uuid_remap;

  UPDATE measurements
     SET id = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', (random() & 3) + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    )
   WHERE id NOT LIKE '________-____-____-____-____________';

  UPDATE observation_points
     SET id = lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-4' ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', (random() & 3) + 1, 1) ||
      substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    )
   WHERE id NOT LIKE '________-____-____-____-____________';

  -- Переименованные записи на сервере ещё не появлялись: помечаем к отправке
  UPDATE projects           SET dirty = 1 WHERE deleted_at IS NULL;
  UPDATE measurements       SET dirty = 1;
  UPDATE observation_points SET dirty = 1 WHERE deleted_at IS NULL;
  `,
];

/** Значения настроек по умолчанию */
export const DEFAULT_SETTINGS = {
  theme: 'system',        // light | dark | system
  locale: 'ru',           // ru | en
  tablet: true,           // адаптация под планшет
  autoLocation: true,     // автоопределение координат
  tabularNums: true,      // моноширинные цифры
};
