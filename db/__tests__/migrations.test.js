/**
 * Проверка миграций схемы на настоящем SQLite
 *
 * Здесь важен не текущий вид таблиц, а переход между версиями: база у
 * пользователя уже заполнена, и миграция обязана донести данные без потерь.
 * Поэтому набор поднимает старую версию схемы, кладёт в неё записи и
 * применяет следующую миграцию — как это произойдёт при обновлении приложения.
 */

const hasNodeSqlite = (() => {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
})();

const { MIGRATIONS } = require('../schema');

const describeDb = hasNodeSqlite ? describe : describe.skip;

/** Форма UUID: 8-4-4-4-12 шестнадцатеричных знаков */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Поднимает базу на указанной версии схемы
 *
 * @param {number} version - сколько миграций применить
 * @returns {Object} соединение node:sqlite
 */
function openAt(version) {
  const { DatabaseSync } = require('node:sqlite');
  const database = new DatabaseSync(':memory:');
  for (let i = 0; i < version; i++) database.exec(MIGRATIONS[i]);
  return database;
}

describeDb('v4 — перевод идентификаторов на UUID', () => {
  let database;

  beforeAll(() => {
    // Версия 3 — состояние базы у пользователя, который уже обновился до
    // синхронизации, но заводил журналы ещё старой сборкой
    database = openAt(3);

    database.exec(`
      INSERT INTO projects (id, name, created_at, updated_at, dirty)
      VALUES ('ms4fm6bq-njzw6zg7', 'Скв. 7Ц отк', 1000, 1000, 1),
             ('kq1zzz00-aab7ccdd', 'Скв. 12 налив', 2000, 2000, 1);

      INSERT INTO measurements (id, project_id, t, s, sort_order, updated_at, dirty)
      VALUES ('m1-legacy', 'ms4fm6bq-njzw6zg7', 1, 0.5, 0, 1000, 1),
             ('m2-legacy', 'ms4fm6bq-njzw6zg7', 2, 0.9, 1, 1000, 1),
             ('m3-legacy', 'kq1zzz00-aab7ccdd', 1, 0.2, 0, 2000, 1);

      INSERT INTO observation_points (id, title, lat, lon, recorded_at, updated_at, dirty)
      VALUES ('p1-legacy', 'Родник у дороги', 59.7, 30.4, 3000, 3000, 1);
    `);

    // Уже корректный UUID: миграция не должна его трогать
    database.exec(`
      INSERT INTO projects (id, name, created_at, updated_at, dirty)
      VALUES ('11111111-2222-4333-8444-555555555555', 'Свежий журнал', 4000, 4000, 0);
    `);

    database.exec('PRAGMA foreign_keys = OFF');
    database.exec(MIGRATIONS[3]);
    database.exec('PRAGMA foreign_keys = ON');
  });

  afterAll(() => {
    if (database) database.close();
  });

  test('старые идентификаторы стали UUID', () => {
    const rows = database.prepare('SELECT id FROM projects').all();
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.id).toMatch(UUID);
  });

  test('замеры и точки тоже переведены', () => {
    const measurements = database.prepare('SELECT id FROM measurements').all();
    const points = database.prepare('SELECT id FROM observation_points').all();

    expect(measurements).toHaveLength(3);
    for (const row of measurements) expect(row.id).toMatch(UUID);
    for (const row of points) expect(row.id).toMatch(UUID);
  });

  test('идентификаторы не совпадают между собой', () => {
    const ids = database
      .prepare(
        `SELECT id FROM projects
         UNION ALL SELECT id FROM measurements
         UNION ALL SELECT id FROM observation_points`
      )
      .all()
      .map((row) => row.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test('замеры остались при своих журналах', () => {
    const rows = database
      .prepare(
        `SELECT p.name AS project, count(*) AS n
           FROM measurements m
           JOIN projects p ON p.id = m.project_id
          GROUP BY p.name
          ORDER BY p.name`
      )
      .all();

    expect(rows).toEqual([
      { project: 'Скв. 12 налив', n: 1 },
      { project: 'Скв. 7Ц отк', n: 2 },
    ]);
  });

  test('висячих ссылок не осталось', () => {
    const orphans = database
      .prepare(
        `SELECT count(*) AS n FROM measurements m
          WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = m.project_id)`
      )
      .get();

    expect(orphans.n).toBe(0);
  });

  test('уже корректный UUID не изменился', () => {
    const row = database
      .prepare('SELECT id FROM projects WHERE name = ?')
      .get('Свежий журнал');

    expect(row.id).toBe('11111111-2222-4333-8444-555555555555');
  });

  test('переименованные записи помечены к отправке', () => {
    const row = database.prepare('SELECT count(*) AS n FROM projects WHERE dirty = 1').get();
    expect(row.n).toBe(3);
  });

  test('повторный прогон ничего не меняет', () => {
    const before = database.prepare('SELECT id FROM projects ORDER BY id').all();

    database.exec('PRAGMA foreign_keys = OFF');
    database.exec(MIGRATIONS[3]);
    database.exec('PRAGMA foreign_keys = ON');

    const after = database.prepare('SELECT id FROM projects ORDER BY id').all();
    expect(after).toEqual(before);
  });
});

describeDb('v13 — вложения точек', () => {
  let database;

  beforeAll(() => {
    database = openAt(MIGRATIONS.length);

    database.exec(`
      INSERT INTO observation_points (id, title, lat, lon, recorded_at, updated_at, dirty)
      VALUES ('11111111-2222-4333-8444-555555555555', 'Скважина 3', 59.7, 30.4, 3000, 3000, 1);
    `);
  });

  afterAll(() => {
    if (database) database.close();
  });

  test('вложение ложится в таблицу', () => {
    database.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, recorded_at)
      VALUES ('a1', '11111111-2222-4333-8444-555555555555', 'photo', 'a1.jpg', 4000);
    `);

    const row = database
      .prepare('SELECT kind, source, duration, waveform FROM point_attachments WHERE id = ?')
      .get('a1');

    expect(row.kind).toBe('photo');
    expect(row.source).toBe('a1.jpg');
    // У снимка нет ни длительности, ни волны
    expect(row.duration).toBeNull();
    expect(row.waveform).toBeNull();
  });

  test('вложение чужой точки не проходит', () => {
    database.exec('PRAGMA foreign_keys = ON');

    expect(() =>
      database.exec(`
        INSERT INTO point_attachments (id, point_id, kind, source, recorded_at)
        VALUES ('a2', 'нет-такой-точки', 'audio', 'a2.m4a', 5000);
      `)
    ).toThrow();
  });
});

describeDb('v14 — серверная версия строки', () => {
  test('у существующих строк базой становится местное время', () => {
    const database = openAt(13);
    database.exec(`
      INSERT INTO projects (id, name, created_at, updated_at, dirty)
      VALUES ('p1', 'Скв. 7Ц отк', 1000, 5000, 1);
      INSERT INTO wells (id, project_id, name, updated_at, dirty)
      VALUES ('w1', 'p1', 'p', 6000, 0);
      INSERT INTO measurements (id, project_id, t, s, sort_order, updated_at, dirty)
      VALUES ('m1', 'p1', 1, 0.5, 0, 7000, 0);
      INSERT INTO observation_points (id, title, lat, lon, recorded_at, updated_at, dirty)
      VALUES ('o1', 'Родник у дороги', 59.7, 30.4, 3000, 8000, 1);
    `);

    database.exec(MIGRATIONS[13]);

    for (const table of ['projects', 'wells', 'measurements', 'observation_points']) {
      const row = database.prepare(`SELECT updated_at, remote_updated_at FROM ${table}`).get();
      expect(row.remote_updated_at).toBe(row.updated_at);
    }
    database.close();
  });
});
