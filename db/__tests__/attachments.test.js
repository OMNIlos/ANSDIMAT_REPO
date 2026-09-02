/**
 * Репозиторий вложений точек
 *
 * Проверяются два договора, на которые опирается экран: список читается одним
 * запросом на весь дневник (иначе прокрутка даёт запрос на точку), и удаление
 * строки обязательно уносит за собой файл — иначе песочница копит мусор,
 * которого уже ничем не видно.
 */

const rows = [];

jest.mock('../index', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: jest.fn(async () => rows),
    getFirstAsync: jest.fn(async () => rows[0] ?? null),
    runAsync: jest.fn(async () => {}),
  })),
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
  deleteAttachmentsForPoint,
} = require('../attachments');

beforeEach(() => {
  jest.clearAllMocks();
  rows.length = 0;
  store.resolve.mockImplementation((source) => `file:///documents/attachments/${source}`);
});

test('список группируется по точкам', async () => {
  rows.push(
    { id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 },
    { id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: '[0.2,0.8]', recorded_at: 2 },
    { id: 'a3', point_id: 'p2', kind: 'photo', source: 'a3.jpg', duration: null, waveform: null, recorded_at: 3 }
  );

  const byPoint = await listAttachments(['p1', 'p2']);

  expect(byPoint.p1).toHaveLength(2);
  expect(byPoint.p2).toHaveLength(1);
});

test('адрес файла разрешается на чтении, а не хранится в базе', async () => {
  rows.push({ id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 });

  const byPoint = await listAttachments(['p1']);

  expect(byPoint.p1[0].source).toBe('a1.jpg');
  expect(byPoint.p1[0].uri).toBe('file:///documents/attachments/a1.jpg');
});

test('волна приезжает массивом, а не строкой', async () => {
  rows.push({ id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: '[0.2,0.8]', recorded_at: 2 });

  const byPoint = await listAttachments(['p1']);

  expect(byPoint.p1[0].waveform).toEqual([0.2, 0.8]);
  expect(byPoint.p1[0].durationMillis).toBe(14000);
});

test('битая волна не роняет экран', async () => {
  // Строка могла испортиться при сбое записи: дневник должен открыться,
  // пусть и без картинки волны у этой записи
  rows.push({ id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: 'не json', recorded_at: 2 });

  const byPoint = await listAttachments(['p1']);

  expect(byPoint.p1[0].waveform).toEqual([]);
});

test('пустой список точек в базу не ходит', async () => {
  const byPoint = await listAttachments([]);

  expect(byPoint).toEqual({});
});

test('добавление сначала кладёт файл, потом пишет строку', async () => {
  const created = await addAttachment({
    pointId: 'p1',
    kind: 'photo',
    uri: 'file:///cache/IMG_0001.jpg',
  });

  expect(store.save).toHaveBeenCalledWith('generated-id', 'photo', 'file:///cache/IMG_0001.jpg');
  expect(created.source).toBe('generated-id.jpg');
  expect(created.uri).toBe('file:///documents/attachments/generated-id.jpg');
});

test('удаление уносит за собой файл', async () => {
  rows.push({ id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 });

  await deleteAttachment('a1');

  expect(store.remove).toHaveBeenCalledWith('a1.jpg');
});

test('удаление точки уносит все её файлы', async () => {
  rows.push(
    { id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 },
    { id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: '[]', recorded_at: 2 }
  );

  await deleteAttachmentsForPoint('p1');

  expect(store.removeAll).toHaveBeenCalledWith(['a1.jpg', 'a2.m4a']);
});
