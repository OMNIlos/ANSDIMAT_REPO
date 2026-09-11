/**
 * Выгрузка того, что построил AnsSurf
 *
 * Построитель карт живёт в WebView и отдаёт готовое обычным браузерным
 * скачиванием — `<a download>`. В WebView такая ссылка не делает ничего:
 * человек жмёт «Экспорт», окно закрывается, файла нет и ошибки нет. Поэтому
 * страница получает хост-обработчик `hydroSaveExport`, а он приводит сюда.
 *
 * Выгрузка бывает из нескольких файлов, и это не мелочь: JPG идёт вместе
 * с `.jgw` и `.prj`, сеточный `.grd` — с `.prj`, DXF — с `.prj`. Без них
 * растр перестаёт быть привязанным к местности и превращается в картинку.
 * Поэтому файлы отдаются все, по очереди: одним системным окном несколько
 * файлов не передать.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Каталог под выгрузки карт; чистится системой вместе с остальным кэшем */
const DIRECTORY = FileSystem.cacheDirectory + 'anssurf-export/';

/** Тип содержимого по расширению — по нему принимающее приложение узнаёт файл */
const MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  zip: 'application/zip',
  dxf: 'application/dxf',
  grd: 'text/plain',
  jgw: 'text/plain',
  prj: 'text/plain',
};

/**
 * Тип содержимого файла выгрузки
 *
 * @param {string} name - имя файла
 * @returns {string} MIME-тип
 */
function mimeOf(name) {
  const extension = String(name).split('.').pop().toLowerCase();
  return MIME[extension] || 'application/octet-stream';
}

/**
 * Разбирает список файлов, пришедший из страницы
 *
 * Страница присылает его строкой JSON: `[{name, b64}]`. Испорченная строка —
 * это сбой обмена, а не пустая выгрузка, и молчать о ней нельзя.
 *
 * @param {string|Array} files - список файлов или его JSON
 * @returns {Array<{name: string, b64: string}>} файлы выгрузки
 */
export function parseExportFiles(files) {
  const list = typeof files === 'string' ? JSON.parse(files) : files;
  if (!Array.isArray(list)) throw new Error('anssurfExport: ожидался список файлов');

  return list.map((file) => {
    if (!file || typeof file.name !== 'string' || typeof file.b64 !== 'string') {
      throw new Error('anssurfExport: в списке файл без имени или содержимого');
    }
    return { name: file.name, b64: file.b64 };
  });
}

/**
 * Пишет файлы выгрузки в кэш
 *
 * @param {Array<{name: string, b64: string}>} files - файлы выгрузки
 * @returns {Promise<Array<{name: string, uri: string}>>} записанное
 */
async function writeFiles(files) {
  await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });

  const written = [];
  for (const file of files) {
    const uri = DIRECTORY + encodeURIComponent(file.name);
    await FileSystem.writeAsStringAsync(uri, file.b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    written.push({ name: file.name, uri });
  }
  return written;
}

/**
 * Сохраняет выгрузку карты и передаёт файлы наружу
 *
 * @param {string} defaultName - имя основного файла, его предлагает страница
 * @param {string|Array} files - список файлов или его JSON
 * @returns {Promise<{saved: number, names: Array<string>, shared: boolean}>} итог
 */
export async function saveAnsSurfExport(defaultName, files) {
  const list = parseExportFiles(files);
  if (list.length === 0) return { saved: 0, names: [], shared: false };

  const written = await writeFiles(list);
  const names = written.map((file) => file.name);

  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
    return { saved: written.length, names, shared: false };
  }

  // По очереди, а не только первый: спутники растра (.jgw, .prj) и есть
  // привязка к местности. Отдать один JPG значит отдать картинку без координат
  for (const file of written) {
    await Sharing.shareAsync(file.uri, {
      mimeType: mimeOf(file.name),
      dialogTitle: file.name || defaultName,
    });
  }

  return { saved: written.length, names, shared: true };
}
