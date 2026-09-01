/**
 * Выгрузка журнала в файл `.ansdimat` и передача его наружу
 *
 * Файл пишется в кэш, а не в документы: он нужен ровно на время показа
 * системного окна «Поделиться». Система сама вычистит кэш, когда место
 * понадобится, — иначе каждая отправка оставляла бы копию журнала навсегда.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getProject } from '../db/projects';
import { buildProjectFile } from './projectFile';
import { PROJECT_FILE_MIME, PROJECT_FILE_UTI, suggestFileName } from './format';

/**
 * Версия приложения — попадает в файл как справка о том, чем он создан
 *
 * Читается лениво: `expo-constants` в проекте нет, а тянуть его ради одной
 * строки незачем. Если версию достать неоткуда, в файле будет null — на
 * разбор это не влияет.
 *
 * @returns {string|null} версия или null
 */
function appVersion() {
  try {
    // eslint-disable-next-line global-require
    return require('../app.json')?.expo?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Отдаёт файл в веб-сборке
 *
 * `expo-sharing` в браузере недоступен, поэтому здесь обычное скачивание.
 *
 * @param {string} fileName - имя файла
 * @param {string} contents - содержимое
 * @returns {boolean} удалось ли отдать
 */
function downloadInBrowser(fileName, contents) {
  if (typeof document === 'undefined') return false;

  const blob = new Blob([contents], { type: PROJECT_FILE_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Отзыв откладывается: Safari успевает начать скачивание не сразу, и
  // немедленный revoke обрывает его на пустом файле
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Собирает файл проекта в кэше
 *
 * @param {string} projectId - идентификатор журнала
 * @returns {Promise<{uri: string, fileName: string, contents: string, project: Object}>}
 */
export async function writeProjectFile(projectId) {
  const project = await getProject(projectId);
  if (!project) throw new Error('exportProject: project not found');

  const contents = buildProjectFile(project, {
    appVersion: appVersion(),
    platform: Platform.OS,
  });
  const fileName = suggestFileName(project.name);

  if (Platform.OS === 'web') {
    return { uri: null, fileName, contents, project };
  }

  // Отдельный каталог под выгрузки: имя файла берётся от названия журнала,
  // и два журнала с похожими названиями в общем кэше затирали бы друг друга
  // тем реже, чем аккуратнее их назвали. Проще дать выгрузкам своё место
  const directory = FileSystem.cacheDirectory + 'ansdimat-export/';
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const uri = directory + encodeURIComponent(fileName);
  await FileSystem.writeAsStringAsync(uri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { uri, fileName, contents, project };
}

/**
 * Выгружает журнал и открывает системное окно «Поделиться»
 *
 * @param {string} projectId - идентификатор журнала
 * @returns {Promise<{shared: boolean}>} удалось ли передать файл
 */
export async function shareProjectFile(projectId) {
  const { uri, fileName, contents, project } = await writeProjectFile(projectId);

  if (Platform.OS === 'web' || !uri) {
    return { shared: downloadInBrowser(fileName, contents) };
  }

  if (!(await Sharing.isAvailableAsync())) {
    return { shared: false };
  }

  // mimeType нужен Android, UTI — iOS: по ним принимающее приложение
  // понимает, что за файл ему дали, ещё до чтения содержимого
  await Sharing.shareAsync(uri, {
    mimeType: PROJECT_FILE_MIME,
    UTI: PROJECT_FILE_UTI,
    dialogTitle: project.name,
  });

  return { shared: true };
}
