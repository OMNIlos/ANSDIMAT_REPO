/**
 * Файловое хранилище вложений точек полевого дневника
 *
 * В базе лежит имя файла, а не абсолютный путь. Каталог приложения на iOS
 * содержит UUID контейнера, и этот UUID меняется при переустановке и части
 * обновлений: сохранённый `file:///var/mobile/.../Documents/...` наутро ведёт
 * в никуда, а строка в базе остаётся — точка показывает вложение, которого
 * нет. Поэтому абсолютный адрес собирается при чтении.
 *
 * И пикер, и рекордер отдают файл в кэше, который система вправе вычистить в
 * любой момент, поэтому файл переносится в `documents`, а не остаётся по
 * исходному адресу.
 */

import * as FileSystem from 'expo-file-system';

const DIRECTORY = `${FileSystem.documentDirectory}attachments/`;

/** Расширение файла по виду вложения */
const EXTENSION = { photo: 'jpg', audio: 'm4a' };

/**
 * Заводит каталог вложений, если его ещё нет
 *
 * @returns {Promise<void>}
 */
async function ensureDirectory() {
  const info = await FileSystem.getInfoAsync(DIRECTORY);
  if (info.exists) return;
  await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });
}

/**
 * Переносит файл в хранилище вложений
 *
 * @param {string} id - идентификатор вложения, он же имя файла
 * @param {'photo'|'audio'} kind - вид вложения
 * @param {string} sourceUri - откуда взять файл
 * @returns {Promise<string>} значение для колонки `source`
 */
export async function save(id, kind, sourceUri) {
  await ensureDirectory();
  const name = `${id}.${EXTENSION[kind]}`;
  await FileSystem.copyAsync({ from: sourceUri, to: `${DIRECTORY}${name}` });
  return name;
}

/**
 * Собирает адрес, пригодный для `<Image>` и плеера
 *
 * @param {string} source - значение колонки `source`
 * @returns {string} абсолютный адрес файла
 */
export function resolve(source) {
  return `${DIRECTORY}${source}`;
}

/**
 * Стирает файл вложения
 *
 * @param {string} source - значение колонки `source`
 * @returns {Promise<void>}
 */
export async function remove(source) {
  // idempotent: файл мог не доехать до диска — например, приложение убили
  // между записью в базу и копированием, — а строку чистить всё равно надо
  await FileSystem.deleteAsync(`${DIRECTORY}${source}`, { idempotent: true });
}

/**
 * Стирает пачку файлов — при удалении точки со всеми вложениями
 *
 * @param {string[]} sources - значения колонки `source`
 * @returns {Promise<void>}
 */
export async function removeAll(sources) {
  await Promise.all(sources.map((source) => remove(source)));
}
