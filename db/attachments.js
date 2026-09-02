/**
 * Репозиторий вложений точек наблюдения
 *
 * Метаданные живут здесь, файлы — в lib/attachmentStore. Разделение нужно
 * потому, что в вебе файлов нет вовсе: там `source` — это data-URI, и весь
 * платформенный разнобой заперт в хранилище, а этот модуль про него не знает.
 */

import { getDatabase, createId } from './index';
import * as attachmentStore from '../lib/attachmentStore';

/** Виды вложений */
export const ATTACHMENT_KINDS = { PHOTO: 'photo', AUDIO: 'audio' };

/**
 * Разбирает волну из базы
 *
 * Строка могла испортиться при сбое записи. Дневник должен открыться в любом
 * случае — пусть эта запись и покажется без картинки волны.
 *
 * @param {string|null} json - содержимое колонки `waveform`
 * @returns {number[]} уровни 0..1
 */
function parseWaveform(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Преобразует строку таблицы во вложение
 *
 * @param {Object} row - строка из SQLite
 * @returns {Object} вложение с разрешённым адресом файла
 */
function mapAttachment(row) {
  return {
    id: row.id,
    pointId: row.point_id,
    kind: row.kind,
    source: row.source,
    uri: attachmentStore.resolve(row.source),
    durationMillis: row.duration ?? 0,
    waveform: parseWaveform(row.waveform),
    recordedAt: row.recorded_at,
  };
}

/**
 * Возвращает вложения указанных точек, старые первыми
 *
 * Один запрос на весь дневник, а не запрос на точку: экран перечитывается при
 * каждом возврате, и запрос на точку дал бы столько обращений к базе, сколько
 * в дневнике точек.
 *
 * @param {string[]} pointIds - идентификаторы точек
 * @returns {Promise<Object>} карта «точка → вложения»
 */
export async function listAttachments(pointIds) {
  if (pointIds.length === 0) return {};

  const database = await getDatabase();
  const placeholders = pointIds.map(() => '?').join(', ');
  const rows = await database.getAllAsync(
    `SELECT * FROM point_attachments
      WHERE point_id IN (${placeholders})
      ORDER BY recorded_at ASC`,
    pointIds
  );

  const byPoint = {};
  for (const row of rows) {
    const attachment = mapAttachment(row);
    if (!byPoint[attachment.pointId]) byPoint[attachment.pointId] = [];
    byPoint[attachment.pointId].push(attachment);
  }
  return byPoint;
}

/**
 * Прикрепляет к точке снимок или голосовую заметку
 *
 * Файл переносится в хранилище раньше записи в базу: если перенос сорвётся,
 * в дневнике не появится строки, которой не соответствует файл.
 *
 * @param {Object} params
 * @param {string} params.pointId - точка
 * @param {'photo'|'audio'} params.kind - вид вложения
 * @param {string} params.uri - откуда взять файл
 * @param {number} [params.durationMillis] - длительность записи
 * @param {number[]} [params.waveform] - уровни сигнала 0..1
 * @returns {Promise<Object>} созданное вложение
 */
export async function addAttachment({ pointId, kind, uri, durationMillis = null, waveform = null }) {
  const database = await getDatabase();
  const id = createId();
  const recordedAt = Date.now();

  const source = await attachmentStore.save(id, kind, uri);

  await database.runAsync(
    `INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, pointId, kind, source, durationMillis, waveform ? JSON.stringify(waveform) : null, recordedAt]
  );

  return {
    id,
    pointId,
    kind,
    source,
    uri: attachmentStore.resolve(source),
    durationMillis: durationMillis ?? 0,
    waveform: waveform ?? [],
    recordedAt,
  };
}

/**
 * Удаляет вложение вместе с файлом
 *
 * Удаление жёсткое: вложения не синхронизируются и с сервера вернуться не
 * могут, поэтому мягкому удалению нечего защищать — оно только оставляло бы
 * мегабайты, которых уже ничем не видно.
 *
 * @param {string} id - идентификатор вложения
 * @returns {Promise<void>}
 */
export async function deleteAttachment(id) {
  const database = await getDatabase();
  const row = await database.getFirstAsync(
    'SELECT source FROM point_attachments WHERE id = ?',
    [id]
  );
  if (!row) return;

  await database.runAsync('DELETE FROM point_attachments WHERE id = ?', [id]);
  await attachmentStore.remove(row.source);
}

/**
 * Удаляет все вложения точки вместе с файлами
 *
 * Вызывается из deletePoint: точка удаляется мягко, DELETE по ней не идёт, и
 * ON DELETE CASCADE не срабатывает.
 *
 * @param {string} pointId - точка
 * @returns {Promise<void>}
 */
export async function deleteAttachmentsForPoint(pointId) {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    'SELECT source FROM point_attachments WHERE point_id = ?',
    [pointId]
  );
  if (rows.length === 0) return;

  await database.runAsync('DELETE FROM point_attachments WHERE point_id = ?', [pointId]);
  await attachmentStore.removeAll(rows.map((row) => row.source));
}
