/**
 * Репозиторий вложений точек
 *
 * Проверяются два договора, на которые опирается экран: список читается одним
 * запросом на весь дневник (иначе прокрутка даёт запрос на точку), и удаление
 * строки обязательно уносит за собой файл — иначе песочница копит мусор,
 * которого уже ничем не видно.
 *
 * База здесь настоящая — node:sqlite поверх реальных миграций, тот же приём,
 * что и в db/__tests__/repositories.test.js, — а не заглушка с готовыми
 * ответами. Заглушка возвращает канонические строки независимо от текста
 * запроса и не отличит рабочий SQL от такого, который игнорирует pointIds,
 * фильтрует не по той колонке, теряет ORDER BY или путает порядок колонок в
 * INSERT — с ней «список группируется по точкам» проходит даже у
 * listAttachments, которая читает вообще все строки. lib/attachmentStore
 * остаётся мокнутым: файловая система — не то, что здесь проверяется, у неё
 * свой набор в lib/__tests__/attachmentStore.test.js.
 */

const hasNodeSqlite = (() => {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
})();

const describeDb = hasNodeSqlite ? describe : describe.skip;

/** Текущая тестовая база — подменяется в beforeEach, читается моком getDatabase */
let mockDb;

jest.mock('../index', () => ({
  getDatabase: jest.fn(async () => mockDb),
  createId: jest.fn(() => 'generated-id'),
}));

jest.mock('../../lib/attachmentStore', () => ({
  save: jest.fn(async () => 'generated-id.jpg'),
  resolve: jest.fn((source) => `file:///documents/attachments/${source}`),
  remove: jest.fn(async () => {}),
  removeAll: jest.fn(async () => {}),
}));

const store = require('../../lib/attachmentStore');
const {
  listAttachments,
  addAttachment,
  deleteAttachment,
  deleteAttachmentRowsForPoint,
  removeAttachmentFiles,
} = require('../attachments');

/**
 * Оборачивает синхронный node:sqlite в асинхронный интерфейс expo-sqlite
 *
 * Та же обёртка, что в db/__tests__/repositories.test.js. Методы — jest.fn
 * поверх настоящего SQL: так сохраняется возможность проверить «вызывали или
 * нет» (например, что пустой список точек не идёт в базу), не теряя главного
 * — запрос действительно выполняется движком, а не отвечает по шаблону.
 */
function wrap(database) {
  return {
    runAsync: jest.fn(async (sql, params = []) => {
      const result = database.prepare(sql).run(...params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
    }),
    getAllAsync: jest.fn(async (sql, params = []) => database.prepare(sql).all(...params)),
    getFirstAsync: jest.fn(async (sql, params = []) => {
      const rows = database.prepare(sql).all(...params);
      return rows[0] ?? null;
    }),
    withTransactionAsync: jest.fn(async (callback) => {
      database.exec('BEGIN');
      try {
        await callback();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }),
  };
}

describeDb('репозиторий вложений (настоящий SQLite)', () => {
  /** Сырой node:sqlite — для прямых вставок и проверок в обход репозитория */
  let raw;

  beforeEach(() => {
    jest.clearAllMocks();
    store.resolve.mockImplementation((source) => `file:///documents/attachments/${source}`);

    const { DatabaseSync } = require('node:sqlite');
    const { MIGRATIONS } = require('../schema');
    raw = new DatabaseSync(':memory:');
    // node:sqlite, в отличие от голого SQLite, включает внешние ключи по
    // умолчанию. Тут проверяется SQL репозитория, а не FK (для него есть
    // отдельный тест в migrations.test.js) — точки в этих тестах условные
    // ('p1', 'p2'), без настоящих строк в observation_points
    raw.exec('PRAGMA foreign_keys = OFF');
    for (const migration of MIGRATIONS) raw.exec(migration);
    mockDb = wrap(raw);
  });

  afterEach(() => {
    if (raw) raw.close();
  });

  test('список группируется по точкам и не тянет чужие', async () => {
    raw.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
      VALUES ('a1', 'p1', 'photo', 'a1.jpg', NULL, NULL, 1),
             ('a2', 'p1', 'audio', 'a2.m4a', 14000, '[0.2,0.8]', 2),
             ('a3', 'p2', 'photo', 'a3.jpg', NULL, NULL, 3),
             ('a4', 'p3', 'photo', 'a4.jpg', NULL, NULL, 4);
    `);

    // p3 нарочно не запрошен: если фильтр по pointIds сломан или снят,
    // его вложение всё равно всплывёт в ответе
    const byPoint = await listAttachments(['p1', 'p2']);

    expect(byPoint.p1).toHaveLength(2);
    expect(byPoint.p2).toHaveLength(1);
    expect(byPoint.p3).toBeUndefined();
  });

  test('внутри точки вложения идут от старых к новым', async () => {
    // Порядок вставки намеренно обратный ожидаемому в ответе — если ORDER BY
    // потерян или перепутан на DESC, тест это заметит только по порядку id
    raw.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
      VALUES ('new', 'p1', 'photo', 'new.jpg', NULL, NULL, 200),
             ('old', 'p1', 'photo', 'old.jpg', NULL, NULL, 100);
    `);

    const byPoint = await listAttachments(['p1']);

    expect(byPoint.p1.map((a) => a.id)).toEqual(['old', 'new']);
  });

  test('адрес файла разрешается на чтении, а не хранится в базе', async () => {
    raw.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
      VALUES ('a1', 'p1', 'photo', 'a1.jpg', NULL, NULL, 1);
    `);

    const byPoint = await listAttachments(['p1']);

    expect(byPoint.p1[0].source).toBe('a1.jpg');
    expect(byPoint.p1[0].uri).toBe('file:///documents/attachments/a1.jpg');
  });

  test('волна приезжает массивом, а не строкой', async () => {
    raw.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
      VALUES ('a2', 'p1', 'audio', 'a2.m4a', 14000, '[0.2,0.8]', 2);
    `);

    const byPoint = await listAttachments(['p1']);

    expect(byPoint.p1[0].waveform).toEqual([0.2, 0.8]);
    expect(byPoint.p1[0].durationMillis).toBe(14000);
  });

  test('битая волна не роняет экран', async () => {
    // Строка могла испортиться при сбое записи: дневник должен открыться,
    // пусть и без картинки волны у этой записи
    raw.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
      VALUES ('a2', 'p1', 'audio', 'a2.m4a', 14000, 'не json', 2);
    `);

    const byPoint = await listAttachments(['p1']);

    expect(byPoint.p1[0].waveform).toEqual([]);
  });

  test('пустой список точек в базу не ходит', async () => {
    const byPoint = await listAttachments([]);

    expect(byPoint).toEqual({});
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  test('добавление кладёт файл в хранилище, потом пишет строку в базу', async () => {
    const created = await addAttachment({
      pointId: 'p1',
      kind: 'photo',
      uri: 'file:///cache/IMG_0001.jpg',
    });

    expect(store.save).toHaveBeenCalledWith('generated-id', 'photo', 'file:///cache/IMG_0001.jpg');
    expect(created.source).toBe('generated-id.jpg');
    expect(created.uri).toBe('file:///documents/attachments/generated-id.jpg');

    // И не только в возвращённом объекте — строка действительно легла в базу,
    // с той же самой парой колонка/значение, что вернул addAttachment
    const row = raw.prepare('SELECT * FROM point_attachments WHERE id = ?').get('generated-id');
    expect(row).toBeTruthy();
    expect(row.point_id).toBe('p1');
    expect(row.kind).toBe('photo');
    expect(row.source).toBe('generated-id.jpg');
    expect(row.duration).toBeNull();
    expect(row.waveform).toBeNull();
  });

  test('длительность и волна переживают запись и чтение неизменными', async () => {
    await addAttachment({
      pointId: 'p1',
      kind: 'audio',
      uri: 'file:///cache/REC_0001.m4a',
      durationMillis: 4200,
      waveform: [0.1, 0.5, 0.9],
    });

    // Перечитано через listAttachments, а не через addAttachment же —
    // проверяется настоящий путь SELECT, а не только то, что вернул INSERT
    const byPoint = await listAttachments(['p1']);

    expect(byPoint.p1[0].durationMillis).toBe(4200);
    expect(byPoint.p1[0].waveform).toEqual([0.1, 0.5, 0.9]);
  });

  test('удаление уносит за собой файл и саму строку', async () => {
    raw.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
      VALUES ('a1', 'p1', 'photo', 'a1.jpg', NULL, NULL, 1);
    `);

    await deleteAttachment('a1');

    expect(store.remove).toHaveBeenCalledWith('a1.jpg');
    const row = raw.prepare('SELECT * FROM point_attachments WHERE id = ?').get('a1');
    expect(row).toBeUndefined();
  });

  test('удаление точки: строки уходят сразу, файлы — отдельным шагом', async () => {
    raw.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
      VALUES ('a1', 'p1', 'photo', 'a1.jpg', NULL, NULL, 1),
             ('a2', 'p1', 'audio', 'a2.m4a', 14000, '[]', 2),
             ('a3', 'p2', 'photo', 'a3.jpg', NULL, NULL, 3);
    `);

    const sources = await deleteAttachmentRowsForPoint('p1');

    expect(sources.slice().sort()).toEqual(['a1.jpg', 'a2.m4a']);
    // Строки чужой точки p2 не тронуты
    const remaining = raw.prepare('SELECT id FROM point_attachments ORDER BY id').all();
    expect(remaining.map((r) => r.id)).toEqual(['a3']);
    // Файловое хранилище на этом шаге ещё не тронуто — это отдельный вызов
    expect(store.removeAll).not.toHaveBeenCalled();

    await removeAttachmentFiles(sources);
    expect(store.removeAll).toHaveBeenCalledWith(['a1.jpg', 'a2.m4a']);
  });

  test('удаление точки без вложений не дёргает файловое хранилище', async () => {
    const sources = await deleteAttachmentRowsForPoint('точка-без-вложений');
    expect(sources).toEqual([]);

    await removeAttachmentFiles(sources);
    expect(store.removeAll).not.toHaveBeenCalled();
  });
});
