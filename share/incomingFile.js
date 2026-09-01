/**
 * Приём файла `.ansdimat` снаружи
 *
 * Файл попадает в приложение двумя путями: система открыла его по двойному
 * нажатию (тогда приходит ссылка через `Linking`) или пользователь выбрал его
 * сам кнопкой «Импорт». Разница только в том, откуда берётся ссылка, поэтому
 * дальше оба пути идут одним кодом.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

import { parseProjectFile } from './projectFile';
import {
  IMPORT_ERRORS,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME,
  PROJECT_FILE_UTI,
} from './format';

/** Схемы, по которым приходит файл, а не обычная ссылка */
const FILE_SCHEMES = ['file://', 'content://'];

/**
 * Достаёт путь из ссылки без строки запроса
 *
 * @param {string} url - ссылка
 * @returns {string} путь, раскодированный по возможности
 */
function pathOf(url) {
  const withoutQuery = url.split('?')[0].split('#')[0];
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    // Битая процентная последовательность — смотрим по исходной строке:
    // расширение в ней всё равно останется читаемым
    return withoutQuery;
  }
}

/**
 * Определяет, стоит ли разбирать эту ссылку как файл проекта
 *
 * Возвращает признак `certain`. Он отвечает на вопрос, показывать ли ошибку,
 * если разбор не удастся. Ссылка с расширением `.ansdimat` — обещание, и
 * нарушенное обещание надо объяснить. Безымянная `content://` таким обещанием
 * не является: провайдеры Android прячут имя файла, и если внутри окажется
 * не наш файл, правильная реакция — промолчать, а не пугать ошибкой.
 *
 * @param {string} url - входящая ссылка
 * @returns {{uri: string, certain: boolean}|null} что делать со ссылкой
 */
export function classifyIncomingUrl(url) {
  if (typeof url !== 'string' || !url) return null;

  const lower = url.toLowerCase();
  if (!FILE_SCHEMES.some((scheme) => lower.startsWith(scheme))) return null;

  const endsWithExtension = pathOf(lower).endsWith('.' + PROJECT_FILE_EXTENSION);

  // `file://` без нашего расширения нам не адресован: путь виден целиком,
  // и раз расширения в нём нет, файл чужой
  if (lower.startsWith('file://') && !endsWithExtension) return null;

  return { uri: url, certain: endsWithExtension };
}

/**
 * Читает содержимое файла по ссылке
 *
 * `content://` копируется в кэш и читается уже оттуда: прямое чтение таких
 * ссылок в expo-file-system работает не у всех провайдеров Android, а копия
 * снимает вопрос — дальше это обычный файл.
 *
 * @param {string} uri - ссылка на файл
 * @returns {Promise<string>} содержимое
 */
export async function readFileAt(uri) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.text();
  }

  if (uri.toLowerCase().startsWith('content://')) {
    const directory = FileSystem.cacheDirectory + 'ansdimat-import/';
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const copy = directory + 'incoming.' + PROJECT_FILE_EXTENSION;

    // Прошлая копия удаляется явно: copyAsync поверх существующего файла
    // на части версий Android завершается ошибкой
    await FileSystem.deleteAsync(copy, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: copy });

    try {
      return await FileSystem.readAsStringAsync(copy, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } finally {
      await FileSystem.deleteAsync(copy, { idempotent: true }).catch(() => {});
    }
  }

  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

/**
 * Читает и разбирает файл проекта
 *
 * @param {string} uri - ссылка на файл
 * @returns {Promise<Object>} итог разбора, как у `parseProjectFile`
 */
export async function loadProjectFile(uri) {
  let text;
  try {
    text = await readFileAt(uri);
  } catch (error) {
    return { ok: false, error: IMPORT_ERRORS.READ_FAILED, reason: String(error?.message ?? error) };
  }

  return parseProjectFile(text);
}

/**
 * Убирает за собой копию, оставленную системой
 *
 * iOS кладёт открытый файл в `Inbox/` приложения и сам его не удаляет: без
 * этого каталог растёт с каждым импортом. Ссылки `content://` принадлежат
 * чужому приложению — их не трогаем.
 *
 * @param {string} uri - ссылка на файл
 * @returns {Promise<void>}
 */
export async function discardIncomingFile(uri) {
  if (Platform.OS === 'web') return;
  if (typeof uri !== 'string' || !uri.toLowerCase().startsWith('file://')) return;
  if (!uri.includes('/Inbox/')) return;

  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

/**
 * Открывает системный выбор файла
 *
 * Нужен как основной путь на Android: `content://`-ссылки от системного
 * поставщика документов прячут имя файла в непрозрачном пути, и объявленный
 * в манифесте фильтр по расширению до них не достаёт. На iOS выбор ограничен
 * нашим типом — там система знает его по объявлению в Info.plist.
 *
 * @returns {Promise<{uri: string, certain: boolean}|null>} выбранный файл
 */
export async function pickProjectFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: Platform.select({
      ios: [PROJECT_FILE_UTI],
      // Android не знает нашего типа: неизвестное расширение он сводит к
      // октет-потоку, и фильтр по своему mime не показал бы вообще ничего
      android: ['*/*'],
      default: [PROJECT_FILE_MIME, '*/*'],
    }),
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  // Файл выбран вручную — ошибку разбора показываем в любом случае:
  // пользователь указал именно на него и вправе знать, что не так
  return { uri: asset.uri, certain: true, name: asset.name ?? null };
}
