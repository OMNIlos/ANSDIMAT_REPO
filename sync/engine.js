/**
 * Синхронизация локальной базы с сервером
 *
 * Порядок: сначала забираем чужие изменения, потом отдаём свои.
 *
 *   1. PULL  — строки, изменённые на сервере после прошлой синхронизации
 *   2. MERGE — сравниваем с локальными, разрешаем расхождения
 *   3. PUSH  — отправляем всё, что помечено dirty
 *
 * Приложение обязано работать в поле без связи, поэтому правки приходят
 * с разных устройств задним числом. Правило разрешения — «выигрывает
 * последняя правка» по серверному времени, но с оговоркой: если запись
 * менялась и там, и здесь, мы не выбираем молча, а сообщаем экрану о
 * расхождении. Потерять замеры, снятые в поле, — худшее, что может
 * сделать приложение для полевых работ.
 */

import { getDatabase } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SYNC_TABLES, toMs } from './tables';

/** Сколько строк отправляем за один запрос */
const BATCH = 200;

/**
 * Читает отметку последней синхронизации таблицы
 *
 * @param {Object} database - соединение SQLite
 * @param {string} table - имя таблицы
 * @returns {Promise<string>} ISO-строка
 */
async function getLastPulled(database, table) {
  const row = await database.getFirstAsync(
    'SELECT last_pulled_at FROM sync_state WHERE table_name = ?',
    [table]
  );
  return row?.last_pulled_at ?? '1970-01-01T00:00:00Z';
}

/**
 * Сохраняет отметку последней синхронизации
 *
 * @param {Object} database - соединение SQLite
 * @param {string} table - имя таблицы
 * @param {string} iso - серверное время
 */
async function setLastPulled(database, table, iso) {
  await database.runAsync(
    `INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    [table, iso]
  );
}

/**
 * Забирает изменения сервера и вносит их в локальную базу
 *
 * @param {Object} ctx - соединения и параметры
 * @param {Object} spec - описание таблицы из SYNC_TABLES
 * @returns {Promise<{pulled: number, conflicts: Array}>} итог шага
 */
async function pullTable({ database, supabase }, spec) {
  const since = await getLastPulled(database, spec.name);

  const { data, error } = await supabase
    .from(spec.remote)
    .select('*')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(1000);

  if (error) throw new Error(`Не удалось получить ${spec.name}: ${error.message}`);
  if (!data?.length) return { pulled: 0, conflicts: [] };

  const conflicts = [];
  // Отметка двигается только по применённым строкам. Раньше она поднималась
  // и на конфликтных: те пропускались, но следующий pull их уже не запрашивал
  // (`.gt(updated_at, since)`), список конфликтов живёт только в памяти — и
  // после перезапуска серверная правка исчезала молча, а локальная затирала
  // её при первой же отправке. Поэтому останавливаем отметку перед первым
  // нерешённым конфликтом: строки идут по возрастанию updated_at, значит
  // всё спорное и всё, что за ним, придёт снова
  let newest = since;
  let blocked = false;

  for (const remoteRow of data) {
    const local = await database.getFirstAsync(
      `SELECT updated_at, dirty, remote_updated_at FROM ${spec.name} WHERE id = ?`,
      [remoteRow.id]
    );
    const incoming = spec.toLocal(remoteRow);

    if (local?.dirty === 1) {
      // Обе стороны меняли запись, если сервер ушёл от версии, с которой
      // начиналась местная правка. С местным updated_at сравнивать нельзя:
      // серверное время ставит триггер, и своя же отправленная строка
      // выглядела бы чужой правкой
      if (local.remote_updated_at !== incoming.updated_at) {
        conflicts.push({
          table: spec.name,
          id: remoteRow.id,
          localUpdatedAt: local.updated_at,
          remoteUpdatedAt: incoming.updated_at,
        });
        blocked = true;
        continue;
      }
      // Иначе пришла та самая версия, от которой идёт правка, — её отправит push
    } else {
      const cols = spec.columns;
      const placeholders = cols.map(() => '?').join(', ');
      const updates = cols
        .filter((c) => c !== 'id')
        .map((c) => `${c} = excluded.${c}`)
        .join(', ');

      await database.runAsync(
        `INSERT INTO ${spec.name} (${cols.join(', ')}, dirty, remote_updated_at)
         VALUES (${placeholders}, 0, ?)
         ON CONFLICT(id) DO UPDATE SET ${updates}, dirty = 0,
           remote_updated_at = excluded.remote_updated_at`,
        [...cols.map((c) => incoming[c] ?? null), incoming.updated_at]
      );
    }

    if (!blocked && remoteRow.updated_at > newest) newest = remoteRow.updated_at;
  }

  await setLastPulled(database, spec.name, newest);
  return { pulled: data.length - conflicts.length, conflicts };
}

/**
 * Отправляет локальные изменения на сервер
 *
 * Спорные строки пропускаются. Иначе выходит бессмыслица: шаг pull заметил
 * расхождение, не тронул локальную запись и доложил о нём — а следующий за
 * ним push тут же отправил её на сервер и стёр там чужую правку. Расхождение
 * оставалось бы на экране, но решать было бы уже нечего.
 *
 * @param {Object} ctx - соединения и параметры
 * @param {Object} spec - описание таблицы из SYNC_TABLES
 * @param {string[]} [skipIds] - строки с нерешённым расхождением
 * @returns {Promise<number>} сколько строк отправлено
 */
async function pushTable({ database, supabase, ownerId }, spec, skipIds = []) {
  const exclude = skipIds.length
    ? ` AND id NOT IN (${skipIds.map(() => '?').join(',')})`
    : '';
  const rows = await database.getAllAsync(
    `SELECT * FROM ${spec.name} WHERE dirty = 1${exclude} LIMIT ${BATCH}`,
    skipIds
  );
  if (!rows.length) return 0;

  const payload = rows.map((row) => spec.toRemote(row, ownerId));
  const { data, error } = await supabase
    .from(spec.remote)
    .upsert(payload, { onConflict: 'id' })
    .select('id, updated_at');
  if (error) throw new Error(`Не удалось отправить ${spec.name}: ${error.message}`);

  // Время, поставленное сервером, становится базой следующей правки. Метку
  // снимаем, только если строку не тронули, пока шёл запрос: иначе правка,
  // сделанная во время отправки, считалась бы отправленной и не уехала бы
  const sent = new Map(rows.map((r) => [r.id, r.updated_at]));
  for (const { id, updated_at } of data) {
    await database.runAsync(
      `UPDATE ${spec.name}
          SET remote_updated_at = ?,
              dirty = CASE WHEN updated_at = ? THEN 0 ELSE dirty END
        WHERE id = ?`,
      [toMs(updated_at), sent.get(id), id]
    );
  }
  return rows.length;
}

/**
 * Полный цикл синхронизации
 *
 * @param {Object} [options]
 * @param {string} [options.ownerId] - идентификатор пользователя
 * @returns {Promise<{ok: boolean, pulled: number, pushed: number,
 *   conflicts: Array, reason?: string}>} итог
 */
export async function synchronize({ ownerId } = {}) {
  if (!isSupabaseConfigured) {
    return { ok: false, pulled: 0, pushed: 0, conflicts: [], reason: 'notConfigured' };
  }

  const { data: auth } = await supabase.auth.getUser();
  const uid = ownerId ?? auth?.user?.id;
  if (!uid) {
    return { ok: false, pulled: 0, pushed: 0, conflicts: [], reason: 'notSignedIn' };
  }

  const database = await getDatabase();
  const ctx = { database, supabase, ownerId: uid };
  const ordered = [...SYNC_TABLES].sort((a, b) => a.order - b.order);

  let pulled = 0;
  let pushed = 0;
  const conflicts = [];

  for (const spec of ordered) {
    const res = await pullTable(ctx, spec);
    pulled += res.pulled;
    conflicts.push(...res.conflicts);
  }
  for (const spec of ordered) {
    const disputed = conflicts.filter((c) => c.table === spec.name).map((c) => c.id);
    pushed += await pushTable(ctx, spec, disputed);
  }

  return { ok: true, pulled, pushed, conflicts };
}

/**
 * Разрешает конфликт в пользу выбранной стороны
 *
 * @param {Object} conflict - описание из synchronize()
 * @param {'local'|'remote'} winner - чья версия остаётся
 * @returns {Promise<void>}
 */
export async function resolveConflict(conflict, winner) {
  const database = await getDatabase();
  const spec = SYNC_TABLES.find((t) => t.name === conflict.table);
  if (!spec) return;

  if (winner === 'local') {
    // Оставляем свою версию. Серверную, которую пользователь видел и
    // отверг, делаем базой правки: pull её больше не оспорит, и при
    // следующей отправке своя версия её перезапишет
    await database.runAsync(
      `UPDATE ${spec.name} SET dirty = 1, updated_at = ?, remote_updated_at = ? WHERE id = ?`,
      [Date.now(), conflict.remoteUpdatedAt, conflict.id]
    );
    return;
  }

  // Берём серверную: снимаем dirty и откатываем отметку, чтобы строка
  // пришла заново на ближайшем pull. Только назад: отметка стоит перед
  // первым нерешённым расхождением, и сдвиг вперёд спрятал бы остальные
  await database.runAsync(`UPDATE ${spec.name} SET dirty = 0 WHERE id = ?`, [conflict.id]);
  const before = conflict.remoteUpdatedAt - 1000;
  if (Date.parse(await getLastPulled(database, spec.name)) > before) {
    await setLastPulled(database, spec.name, new Date(before).toISOString());
  }
}

/**
 * Сколько записей ждут отправки
 *
 * @returns {Promise<number>} количество несинхронизированных строк
 */
export async function countPending() {
  const database = await getDatabase();
  let total = 0;
  for (const spec of SYNC_TABLES) {
    const row = await database.getFirstAsync(
      `SELECT COUNT(*) AS n FROM ${spec.name} WHERE dirty = 1`
    );
    total += row?.n ?? 0;
  }
  return total;
}

/**
 * Сбрасывает отметки синхронизации и помечает всё к отправке
 *
 * Нужен при входе в другой аккаунт: чужие отметки времени сделали бы часть
 * своих записей «уже синхронизированными».
 *
 * @returns {Promise<void>}
 */
export async function resetSyncState() {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sync_state');
  for (const spec of SYNC_TABLES) {
    await database.runAsync(`UPDATE ${spec.name} SET dirty = 1`);
  }
}
