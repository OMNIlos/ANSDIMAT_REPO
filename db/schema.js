import { DEFAULT_UNITS } from '../calc/units';

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

/**
 * Периоды опробования, к которым относится замер
 *
 * Одиночная откачка ведёт два раздельных журнала — как таблицы «Время» /
 * «Понижение» и «Время восстан.» / «Восстановление» в настольном АНСДИМАТ.
 * Общий журнал на обе фазы невозможен: время в них отсчитывается от разных
 * моментов, а ноль восстановления отвечает максимальному понижению.
 */
export const MEASUREMENT_PHASES = {
  PUMPING: 'pumping',     // Понижение уровня, время от начала откачки
  RECOVERY: 'recovery',   // Восстановление уровня, время от остановки насоса
};

/**
 * Роли скважин в опробовании
 *
 * Кустовая откачка — одна опытная скважина и сколько угодно наблюдательных
 * вокруг неё. Опытная в списке одна: две и больше — это уже групповая
 * откачка, отдельная схема со своими решениями.
 *
 * Замеры уровня ведутся по каждой скважине своим рядом: опытная, если в ней
 * следят за уровнем, тоже наблюдательная (см. книгу, разд. 1.1.2).
 */
export const WELL_ROLES = {
  PUMPING: 'pumping',           // Опытная: та, из которой качают
  OBSERVATION: 'observation',   // Наблюдательная: в ней следят за уровнем
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

  // v5 — период опробования у замера.
  //
  // До этой версии журнал был один на обе фазы: строки, введённые как
  // понижение, при переключении на восстановление просто читались по другой
  // формуле. Для одиночной откачки так нельзя — время восстановления
  // отсчитывается от остановки насоса, а не от начала опыта, и одни и те же
  // числа в двух фазах означают разные моменты.
  //
  // Значение по умолчанию 'pumping' оставляет уже введённые замеры там же,
  // где они были: журналы типа «восстановление уровня» держат свои строки
  // в единственном журнале и обрабатываются по-прежнему.
  `
  ALTER TABLE measurements ADD COLUMN phase TEXT NOT NULL DEFAULT 'pumping';

  CREATE INDEX IF NOT EXISTS idx_measurements_project_phase
    ON measurements (project_id, phase, sort_order);

  -- Колонка появилась только локально: на сервере её ещё нет ни у одной строки
  UPDATE measurements SET dirty = 1 WHERE deleted_at IS NULL;
  `,

  // v6 — понижение на момент остановки насоса (табл. «Окончание»).
  //
  // Точка, от которой отсчитывается восстановление: ноль в журнале
  // восстановления отвечает именно этому понижению. Без него нельзя сказать,
  // восстановился ли уровень — остаточное понижение не с чем сравнивать.
  `
  ALTER TABLE projects ADD COLUMN final_drawdown REAL NOT NULL DEFAULT 0;

  UPDATE projects SET dirty = 1 WHERE deleted_at IS NULL;
  `,

  // v7 — скважины опробования.
  //
  // До этой версии журнал был на один ряд замеров, то есть на одну скважину.
  // Кустовая откачка так не описывается: вокруг опытной скважины стоит
  // несколько наблюдательных, у каждой свой ряд «время — понижение» и своя
  // кривая на графике.
  //
  // Замер привязан к скважине через well_id. У видов ОФР с одной скважиной он
  // остаётся пустым: заводить им скважину-пустышку значило бы усложнить
  // экраны ради строки в таблице.
  //
  // Кустовым журналам, заведённым до этой версии, выдаём пару скважин по
  // умолчанию и отдаём их замеры наблюдательной: иначе журнал открылся бы
  // пустым. Имена — по соглашению АНСДИМАТ: «w» у опытной, «p» у
  // наблюдательной.
  `
  CREATE TABLE IF NOT EXISTS wells (
    id          TEXT PRIMARY KEY NOT NULL,
    project_id  TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'observation',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL DEFAULT 0,
    deleted_at  INTEGER,
    dirty       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_wells_project ON wells (project_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_wells_dirty ON wells (dirty);

  ALTER TABLE measurements ADD COLUMN well_id TEXT;

  CREATE INDEX IF NOT EXISTS idx_measurements_well
    ON measurements (well_id, phase, sort_order);

  CREATE TABLE _well_seed AS
  SELECT id AS project_id,
         lower(
           substr(hex(randomblob(4)), 1, 8) || '-' ||
           substr(hex(randomblob(2)), 1, 4) || '-4' ||
           substr(hex(randomblob(2)), 2, 3) || '-' ||
           substr('89ab', (random() & 3) + 1, 1) ||
           substr(hex(randomblob(2)), 2, 3) || '-' ||
           substr(hex(randomblob(6)), 1, 12)
         ) AS pumping_id,
         lower(
           substr(hex(randomblob(4)), 1, 8) || '-' ||
           substr(hex(randomblob(2)), 1, 4) || '-4' ||
           substr(hex(randomblob(2)), 2, 3) || '-' ||
           substr('89ab', (random() & 3) + 1, 1) ||
           substr(hex(randomblob(2)), 2, 3) || '-' ||
           substr(hex(randomblob(6)), 1, 12)
         ) AS observation_id
    FROM projects
   WHERE ofr_type = 'cluster' AND deleted_at IS NULL;

  INSERT INTO wells (id, project_id, name, role, sort_order, updated_at, dirty)
  SELECT pumping_id, project_id, '1w', 'pumping', 0, 0, 1 FROM _well_seed;

  INSERT INTO wells (id, project_id, name, role, sort_order, updated_at, dirty)
  SELECT observation_id, project_id, '1p', 'observation', 1, 0, 1 FROM _well_seed;

  UPDATE measurements
     SET well_id = (SELECT observation_id FROM _well_seed
                     WHERE project_id = measurements.project_id),
         dirty = 1
   WHERE project_id IN (SELECT project_id FROM _well_seed);

  DROP TABLE _well_seed;
  `,

  // v8 — расстояние от скважины до опытной.
  //
  // Расчётные схемы кустовой откачки строятся на расстоянии r между опытной
  // и наблюдательной скважиной: без него по кусту нельзя ни провести площадное
  // прослеживание, ни сопоставить кривые скважин между собой.
  //
  // У самой опытной скважины в этой же колонке лежит её радиус: расстояние
  // «от опытной до опытной» — это и есть r0. Так же поступает настольный
  // АНСДИМАТ: «при наблюдении за изменением уровня в опытной скважине
  // в качестве расстояния обычно принимается её радиус».
  `
  ALTER TABLE wells ADD COLUMN distance REAL NOT NULL DEFAULT 0;

  UPDATE wells SET dirty = 1 WHERE deleted_at IS NULL;
  `,

  // v9 — положение скважины на карте.
  //
  // Расстояния до опытной скважины удобнее расставлять на карте, чем
  // набирать числами: куст рисуется как есть, а расстояние считается по
  // координатам. Координаты пустые, пока скважину не разложили по карте, —
  // поэтому колонки допускают NULL, а не заводят ложный ноль у экватора.
  `
  ALTER TABLE wells ADD COLUMN lat REAL;
  ALTER TABLE wells ADD COLUMN lon REAL;

  UPDATE wells SET dirty = 1 WHERE deleted_at IS NULL;
  `,

  // v10 — понижение на момент остановки насоса у каждой скважины куста.
  //
  // До этой версии оно было одно на весь проект (v6). Одиночной откачке
  // этого хватает: журнал там один. У куста журналов пара на каждую
  // скважину, и понижение на остановке своё у каждой — опытная садится на
  // метры, дальняя наблюдательная на сантиметры.
  //
  // Общее число давало остаточное понижение чужой скважины: разница
  // «понижение на остановке минус подъём уровня» выходила отрицательной,
  // обрезалась нулём, и кривая восстановления ложилась горизонталью по нулю.
  //
  // Ноль здесь значит «не задано»: понижение берётся из последней строки
  // журнала откачки этой же скважины, см. finalDrawdownAtStop.
  `
  ALTER TABLE wells ADD COLUMN final_drawdown REAL NOT NULL DEFAULT 0;

  UPDATE wells SET dirty = 1 WHERE deleted_at IS NULL;
  `,
];

/** Значения настроек по умолчанию */
export const DEFAULT_SETTINGS = {
  theme: 'system',        // light | dark | system
  locale: 'ru',           // ru | en
  tablet: true,           // адаптация под планшет
  autoLocation: true,     // автоопределение координат
  tabularNums: true,      // моноширинные цифры
  // Размерности ввода и вывода. Расчёты и хранение всегда в базовых
  // единицах, см. calc/units.js
  units: DEFAULT_UNITS,
};
