/**
 * Хранилище вложений в вебе
 *
 * `expo-file-system` на вебе подменён заглушкой: `documentDirectory` там
 * `null`, и запись на диск невозможна в принципе. Поэтому байты сохраняются
 * data-URI прямо в колонку `source`, а `resolve` отдаёт строку как есть.
 *
 * `blob:`-адреса не годятся: они живут только до перезагрузки страницы, и
 * после обновления вкладки миниатюра превратилась бы в битую картинку.
 *
 * Это нужно, чтобы фичу можно было прогнать в браузерном превью — так
 * тестируется остальное приложение. На устройстве работает `attachmentStore.js`.
 */

/**
 * Переводит файл в data-URI
 *
 * @param {string} id - идентификатор вложения (в вебе не используется:
 *   адресом служит само содержимое)
 * @param {'photo'|'audio'} kind - вид вложения (там же)
 * @param {string} sourceUri - blob-, data- или file-адрес источника
 * @returns {Promise<string>} data-URI для колонки `source`
 */
export async function save(id, kind, sourceUri) {
  if (sourceUri.startsWith('data:')) return sourceUri;

  const response = await fetch(sourceUri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * В вебе `source` уже является адресом
 *
 * @param {string} source - data-URI
 * @returns {string} он же
 */
export function resolve(source) {
  return source;
}

/**
 * Ничего не делает: байты лежат в строке базы, и удаление строки —
 * это и есть удаление файла
 *
 * @returns {Promise<void>}
 */
export async function remove() {}

/**
 * Ничего не делает по той же причине, что и `remove`
 *
 * @returns {Promise<void>}
 */
export async function removeAll() {}
