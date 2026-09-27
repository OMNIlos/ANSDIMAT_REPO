/**
 * Проверка разрешения расхождений при синхронизации
 *
 * Самая дорогая ошибка синхронизации — молча потерять правку. Здесь
 * проверяется именно это: строка, по которой стороны разошлись, обязана
 * прийти с сервера ещё раз, пока пользователь не решит, чья версия остаётся.
 * Соединение с Supabase подменено заглушкой, база — настоящий SQLite.
 */

const hasNodeSqlite = (() => {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
})();

const { MIGRATIONS } = require('../../db/schema');

let mockDatabase;
/** Строки, которые «лежат на сервере» */
let mockRemoteRows = [];

// Заглушки модулей: движок берёт базу из db, а клиента — из lib/supabase
jest.mock('../../db', () => ({
  getDatabase: async () => mockDatabase,
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } } }) },
    from: (table) => ({
      select: () => ({
        gt: (_column, since) => ({
          order: () => ({
            limit: async () => ({
              data: table === 'projects' ? mockRemoteRows.filter((r) => r.updated_at > since) : [],
              error: null,
            }),
          }),
        }),
      }),
      // push в этих проверках не участвует
      upsert: async () => ({ error: null }),
    }),
  },
}));

/**
 * Поднимает локальную базу с полной схемой
 *
 * @returns {Object} соединение node:sqlite с интерфейсом expo-sqlite
 */
function openDatabase() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) db.exec(migration);

  // Минимальная обёртка под API expo-sqlite, которым пользуется движок
  return {
    getFirstAsync: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql, params = []) => db.prepare(sql).all(...params),
    runAsync: async (sql, params = []) => db.prepare(sql).run(...params),
    withTransactionAsync: async (fn) => fn(),
  };
}

const describeSync = hasNodeSqlite ? describe : describe.skip;

describeSync('расхождение локальной и серверной правок', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const REMOTE_TIME = '2026-08-09T10:00:00.000Z';

  let synchronize;

  beforeEach(() => {
    jest.resetModules();
    mockDatabase = openDatabase();
    ({ synchronize } = require('../engine'));

    // Локально журнал правили и ещё не отправили
    mockDatabase.runAsync(
      `INSERT INTO projects (id, name, ofr_type, q, starred, created_at, updated_at, dirty)
       VALUES (?, 'местная правка', 'single', 100, 0, 1, ?, 1)`,
      [ID, Date.parse('2026-08-09T09:00:00.000Z')]
    );

    // На сервере тот же журнал правили с другого устройства
    mockRemoteRows = [
      {
        id: ID,
        name: 'серверная правка',
        ofr_type: 'single',
        q: 200,
        pumping_duration: 0,
        starred: false,
        result_t: null,
        result_slope: null,
        result_method: null,
        created_at: '2026-08-09T08:00:00.000Z',
        updated_at: REMOTE_TIME,
        deleted_at: null,
      },
    ];
  });

  test('расхождение попадает в отчёт, локальная запись не затирается', async () => {
    const result = await synchronize();

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].id).toBe(ID);

    const row = await mockDatabase.getFirstAsync('SELECT name FROM projects WHERE id = ?', [ID]);
    expect(row.name).toBe('местная правка');
  });

  test('нерешённое расхождение приходит снова на следующей синхронизации', async () => {
    // Без остановки отметки времени вторая синхронизация не увидела бы строку,
    // и серверная правка пропала бы навсегда
    await synchronize();
    const second = await synchronize();

    expect(second.conflicts).toHaveLength(1);
    expect(second.conflicts[0].id).toBe(ID);
  });

  test('отметка синхронизации не перескакивает через спорную строку', async () => {
    await synchronize();
    const state = await mockDatabase.getFirstAsync(
      "SELECT last_pulled_at FROM sync_state WHERE table_name = 'projects'"
    );
    expect(state.last_pulled_at < REMOTE_TIME).toBe(true);
  });

  test('после согласия с сервером расхождения больше нет', async () => {
    await synchronize();

    // Пользователь выбрал серверную версию: снимаем локальную метку правки
    await mockDatabase.runAsync('UPDATE projects SET dirty = 0 WHERE id = ?', [ID]);
    const after = await synchronize();

    expect(after.conflicts).toHaveLength(0);
    const row = await mockDatabase.getFirstAsync('SELECT name FROM projects WHERE id = ?', [ID]);
    expect(row.name).toBe('серверная правка');
  });
});
