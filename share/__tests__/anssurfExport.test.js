/**
 * Выгрузка карт AnsSurf
 *
 * Главное, что здесь ловится, — потеря файлов-спутников. Растр уезжает
 * тройкой: сама картинка, файл привязки `.jgw` и система координат `.prj`.
 * Отдать одну картинку значит отдать изображение без места на земле, и
 * заметить это можно только открыв её в ГИС — то есть уже не в поле.
 */

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///data/app/Caches/',
  makeDirectoryAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

const FileSystem = require('expo-file-system');
const Sharing = require('expo-sharing');
const { parseExportFiles, saveAnsSurfExport } = require('../anssurfExport');

/** Выгрузка растра так, как её присылает страница */
const RASTER = JSON.stringify([
  { name: 'map-300dpi.jpg', b64: 'AQID' },
  { name: 'map-300dpi.jgw', b64: 'BAUG' },
  { name: 'map-300dpi.prj', b64: 'BwgJ' },
]);

beforeEach(() => {
  jest.clearAllMocks();
  Sharing.isAvailableAsync.mockResolvedValue(true);
});

test('разбирает список файлов из строки JSON', () => {
  expect(parseExportFiles(RASTER)).toEqual([
    { name: 'map-300dpi.jpg', b64: 'AQID' },
    { name: 'map-300dpi.jgw', b64: 'BAUG' },
    { name: 'map-300dpi.prj', b64: 'BwgJ' },
  ]);
});

test('файл без имени или содержимого — сбой обмена, а не пустая выгрузка', () => {
  expect(() => parseExportFiles('[{"name":"a.jpg"}]')).toThrow();
  expect(() => parseExportFiles('{"name":"a.jpg"}')).toThrow();
  expect(() => parseExportFiles('не json')).toThrow();
});

test('записывает все файлы выгрузки, а не только основной', async () => {
  const result = await saveAnsSurfExport('map-300dpi.jpg', RASTER);

  expect(result.saved).toBe(3);
  expect(result.names).toEqual([
    'map-300dpi.jpg',
    'map-300dpi.jgw',
    'map-300dpi.prj',
  ]);
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(3);
});

test('содержимое пишется как base64, а не как текст', async () => {
  await saveAnsSurfExport('map.jpg', '[{"name":"map.jpg","b64":"AQID"}]');

  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
    'file:///data/app/Caches/anssurf-export/map.jpg',
    'AQID',
    { encoding: 'base64' }
  );
});

test('спутники растра отдаются вместе с ним', async () => {
  await saveAnsSurfExport('map-300dpi.jpg', RASTER);

  const shared = Sharing.shareAsync.mock.calls.map(([uri]) => uri);
  expect(shared).toHaveLength(3);
  expect(shared.join(' ')).toContain('map-300dpi.jgw');
  expect(shared.join(' ')).toContain('map-300dpi.prj');
});

test('тип содержимого проставляется по расширению', async () => {
  await saveAnsSurfExport('map-300dpi.jpg', RASTER);

  const types = Sharing.shareAsync.mock.calls.map(([, options]) => options.mimeType);
  // По типу принимающее приложение понимает, что ему дали, ещё до чтения
  expect(types).toEqual(['image/jpeg', 'text/plain', 'text/plain']);
});

test('без системного окна файлы всё равно записаны', async () => {
  Sharing.isAvailableAsync.mockResolvedValue(false);

  const result = await saveAnsSurfExport('map.dxf', '[{"name":"map.dxf","b64":"AQ=="}]');

  expect(result).toEqual({ saved: 1, names: ['map.dxf'], shared: false });
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test('пустая выгрузка не открывает окно и не пишет файлов', async () => {
  const result = await saveAnsSurfExport('ничего', '[]');

  expect(result).toEqual({ saved: 0, names: [], shared: false });
  expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
