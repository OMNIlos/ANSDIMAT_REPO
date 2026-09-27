/**
 * Проверка разрешения расхождений при синхронизации
 *
 * Самая дорогая ошибка синхронизации — молча потерять правку. Здесь
 * проверяется именно это: строка, по которой стороны разошлись, обязана
 * прийти с сервера ещё раз, пока пользователь не решит, чья версия остаётся,
 * а своя же отправленная правка расхождением не считается.
 *
 * Сервер подменён хранилищем в памяти. Как и настоящий триггер
 * touch_updated_at, оно само ставит время правки, а присланное клиентом
 * отбрасывает — на этом движок и спотыкался. База — настоящий SQLite.
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
/** Строки, которые «лежат на сервере», см. createServer */
let mockServer;

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
            limit: async () => ({ data: mockServer.changedSince(table, since), error: null }),
          }),
        }),
      }),
      // Как у supabase-js: запрос уходит по await, а .select() просит строки в ответ
      upsert: (payload) => {
        const send = async () => {
          const data = mockServer.upsert(table, payload);
          await mockServer.reply();
          return { data, error: null };
        };
        return { select: send, then: (resolve, reject) => send().then(resolve, reject) };
      },
    }),
  },
}));

/**
 * Сервер в памяти
 *
 * Время правки ставит как touch_updated_at: и при вставке, и при
 * обновлении, присланное клиентом отбрасывает. Часы идут шагом в минуту,
 * чтобы соседние правки не слипались при сравнении отметок.
 *
 * @returns {Object} хранилище с интерфейсом для заглушки supabase
 */
function createServer() {
  let clock = Date.parse('2026-09-27T12:00:00.000Z');
  const tables = {};
  const table = (name) => (tables[name] ??= new Map());
  const now = () => new Date((clock += 60 * 1000)).toISOString();

  return {
    /** Срабатывает один раз: после записи на сервере, до ответа клиенту */
    beforeReply: null,

    async reply() {
      const hook = this.beforeReply;
      this.beforeReply = null;
      if (hook) await hook();
    },

    get: (name, id) => table(name).get(id),

    seed: (name, row) => table(name).set(row.id, row),

    /** Правка с другого устройства */
    edit(name, id, patch) {
      table(name).set(id, { ...table(name).get(id), ...patch, updated_at: now() });
    },

    changedSince: (name, since) =>
      [...table(name).values()]
        .filter((r) => r.updated_at > since)
        .sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1)),

    upsert(name, payload) {
      const at = now();
      for (const row of payload) {
        table(name).set(row.id, { ...table(name).get(row.id), ...row, updated_at: at });
      }
      return payload.map(({ id }) => ({ id, updated_at: table(name).get(id).updated_at }));
    },
  };
}

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
    mockServer = createServer();
    ({ synchronize } = require('../engine'));

    // Локально журнал правили и ещё не отправили
    mockDatabase.runAsync(
      `INSERT INTO projects (id, name, ofr_type, q, starred, created_at, updated_at, dirty)
       VALUES (?, 'местная правка', 'single', 100, 0, 1, ?, 1)`,
      [ID, Date.parse('2026-08-09T09:00:00.000Z')]
    );

    // На сервере тот же журнал правили с другого устройства
    mockServer.seed('projects', {
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
    });
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

describeSync('сервер сам ставит время правки', () => {
  const ID = '22222222-2222-4222-8222-222222222222';
  const OTHER = '33333333-3333-4333-8333-333333333333';
  const LOCAL = Date.parse('2026-08-09T09:00:00.000Z');

  let synchronize;
  let resolveConflict;

  beforeEach(() => {
    jest.resetModules();
    mockDatabase = openDatabase();
    mockServer = createServer();
    ({ synchronize, resolveConflict } = require('../engine'));
  });

  /** Новый журнал — так его заводит createProject */
  const createLocally = (id, name = 'журнал') =>
    mockDatabase.runAsync(
      `INSERT INTO projects (id, name, ofr_type, q, starred, created_at, updated_at, dirty)
       VALUES (?, ?, 'single', 100, 0, 1, ?, 1)`,
      [id, name, LOCAL]
    );

  /** Журналы, которые уже съездили на сервер и вернулись оттуда */
  async function synced(...ids) {
    for (const id of ids) await createLocally(id);
    await synchronize();
    await synchronize();
  }

  /** Местная правка — так её пишут репозитории в db/ */
  const editLocally = (id, name, at) =>
    mockDatabase.runAsync(
      'UPDATE projects SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [name, at, id]
    );

  const localRow = (id) =>
    mockDatabase.getFirstAsync('SELECT name, dirty FROM projects WHERE id = ?', [id]);

  test('своя отправленная правка не считается чужой', async () => {
    await synced(ID);
    await editLocally(ID, 'первая правка', LOCAL + 1000);
    await synchronize();
    await editLocally(ID, 'вторая правка', LOCAL + 2000);

    const result = await synchronize();

    expect(result.conflicts).toHaveLength(0);
    expect(mockServer.get('projects', ID).name).toBe('вторая правка');
  });

  test('«Эту» отправляет свою версию на сервер', async () => {
    await synced(ID);
    mockServer.edit('projects', ID, { name: 'с планшета' });
    await editLocally(ID, 'с телефона', LOCAL + 1000);

    const [conflict] = (await synchronize()).conflicts;
    await resolveConflict(conflict, 'local');
    const after = await synchronize();

    expect(after.conflicts).toHaveLength(0);
    expect(mockServer.get('projects', ID).name).toBe('с телефона');
  });

  test('правка во время отправки не теряется', async () => {
    await synced(ID);
    await editLocally(ID, 'до отправки', LOCAL + 1000);
    mockServer.beforeReply = () => editLocally(ID, 'во время отправки', LOCAL + 2000);
    await synchronize();

    expect((await localRow(ID)).dirty).toBe(1);

    const after = await synchronize();
    expect(after.conflicts).toHaveLength(0);
    expect((await localRow(ID)).name).toBe('во время отправки');
    expect(mockServer.get('projects', ID).name).toBe('во время отправки');
  });

  test('выбор серверной версии не прячет соседнее расхождение', async () => {
    await synced(ID, OTHER);
    mockServer.edit('projects', ID, { name: 'первый с планшета' });
    mockServer.edit('projects', OTHER, { name: 'второй с планшета' });
    await editLocally(ID, 'первый с телефона', LOCAL + 1000);
    await editLocally(OTHER, 'второй с телефона', LOCAL + 1000);

    const { conflicts } = await synchronize();
    await resolveConflict(conflicts.find((c) => c.id === OTHER), 'remote');
    const after = await synchronize();

    expect(after.conflicts.map((c) => c.id)).toEqual([ID]);
    expect(mockServer.get('projects', ID).name).toBe('первый с планшета');
    expect((await localRow(OTHER)).name).toBe('второй с планшета');
  });

  test('журнал с телефона, у которого отстают часы, доходит до планшета', async () => {
    const phone = mockDatabase;
    const tablet = openDatabase();

    // Планшет уже забрал свежую правку: его отметка стоит на серверном времени
    await synced(ID);
    mockServer.edit('projects', ID, { name: 'правка с сервера' });
    mockDatabase = tablet;
    await synchronize();

    // Часы телефона на семь недель позади серверных
    mockDatabase = phone;
    await createLocally(OTHER, 'новый журнал');
    await synchronize();

    mockDatabase = tablet;
    await synchronize();

    const row = await tablet.getFirstAsync('SELECT name FROM projects WHERE id = ?', [OTHER]);
    expect(row?.name).toBe('новый журнал');
  });
});
