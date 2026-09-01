/**
 * Файловое хранилище вложений
 *
 * Проверяется договор, на который опирается вся остальная фича: имя файла в
 * базе, а не абсолютный путь. Контейнер приложения на iOS меняет UUID при
 * переустановке, и сохранённый абсолютный адрес после неё ведёт в никуда.
 */

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/app/Documents/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

const FileSystem = require('expo-file-system');
const store = require('../attachmentStore');

beforeEach(() => {
  jest.clearAllMocks();
  FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
});

test('save возвращает имя файла, а не абсолютный путь', async () => {
  const source = await store.save('abc-123', 'photo', 'file:///cache/IMG_0001.jpg');

  expect(source).toBe('abc-123.jpg');
  expect(source).not.toContain('/');
});

test('save кладёт файл в каталог вложений', async () => {
  await store.save('abc-123', 'audio', 'file:///cache/rec.m4a');

  expect(FileSystem.copyAsync).toHaveBeenCalledWith({
    from: 'file:///cache/rec.m4a',
    to: 'file:///data/app/Documents/attachments/abc-123.m4a',
  });
});

test('каталог заводится один раз, а не при каждом сохранении', async () => {
  await store.save('a', 'photo', 'file:///cache/a.jpg');
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
  await store.save('b', 'photo', 'file:///cache/b.jpg');

  expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledTimes(1);
});

test('resolve собирает абсолютный адрес из имени', () => {
  expect(store.resolve('abc-123.jpg')).toBe(
    'file:///data/app/Documents/attachments/abc-123.jpg'
  );
});

test('remove не падает на уже удалённом файле', async () => {
  await store.remove('abc-123.jpg');

  // idempotent: файл мог не доехать до диска, а строку в базе всё равно чистим
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    'file:///data/app/Documents/attachments/abc-123.jpg',
    { idempotent: true }
  );
});

test('removeAll стирает всю пачку', async () => {
  await store.removeAll(['a.jpg', 'b.m4a']);

  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
});
