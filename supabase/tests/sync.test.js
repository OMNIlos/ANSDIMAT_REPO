/**
 * Проверка синхронизации между двумя устройствами
 *
 * Тест воспроизводит сценарий, ради которого вообще нужен аккаунт: журнал
 * заведён на телефоне, а открывается на планшете. Логика повторяет
 * `sync/engine.js`, но работает поверх обычных объектов вместо SQLite —
 * так проверяется сам протокол обмена, без нативной базы.
 *
 * Запуск: npx supabase start && node supabase/tests/sync.test.js
 */

const API = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

let failures = 0;

function check(name, ok, detail = '') {
  if (ok) console.log('  ✓ ' + name);
  else { failures += 1; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}

async function signUp(email) {
  const res = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test-password-123' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Регистрация не удалась: ' + JSON.stringify(data));
  return { token: data.access_token, id: data.user.id };
}

async function rest(token, path, init = {}) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

/**
 * Модель устройства: локальные записи и отметка последней синхронизации
 */
class Device {
  constructor(name, user) {
    this.name = name;
    this.user = user;
    this.rows = new Map();
    this.lastPulled = '1970-01-01T00:00:00Z';
  }

  /** Локальная правка помечается к отправке */
  edit(row) {
    this.rows.set(row.id, { ...row, dirty: true });
  }

  /** Забирает чужие изменения, возвращает список расхождений */
  async pull() {
    const { body } = await rest(
      this.user.token,
      `projects?updated_at=gt.${encodeURIComponent(this.lastPulled)}&order=updated_at.asc`
    );
    const conflicts = [];
    for (const remote of body ?? []) {
      if (remote.updated_at > this.lastPulled) this.lastPulled = remote.updated_at;
      const local = this.rows.get(remote.id);
      // Обе стороны правили одну запись — решает пользователь
      if (local?.dirty && local.updated_at !== remote.updated_at) {
        conflicts.push({ id: remote.id, local: local.name, remote: remote.name });
        continue;
      }
      this.rows.set(remote.id, { ...remote, dirty: false });
    }
    return conflicts;
  }

  /** Отправляет свои правки */
  async push() {
    const dirty = [...this.rows.values()].filter((r) => r.dirty);
    if (!dirty.length) return 0;
    const payload = dirty.map(({ dirty: _d, ...row }) => ({ ...row, owner_id: this.user.id }));
    const { status, body } = await rest(this.user.token, 'projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (status >= 400) throw new Error(`push ${this.name}: ${JSON.stringify(body)}`);
    for (const row of body) this.rows.set(row.id, { ...row, dirty: false });
    return dirty.length;
  }

  async sync() {
    const conflicts = await this.pull();
    await this.push();
    return conflicts;
  }
}

async function main() {
  const user = await signUp(`sync-${Date.now()}@example.com`);
  const phone = new Device('телефон', user);
  const tablet = new Device('планшет', user);

  console.log('Перенос журнала между устройствами');
  const id = crypto.randomUUID();
  phone.edit({ id, name: 'Скв. 12 — кустовая откачка', q: 864, updated_at: new Date().toISOString() });
  await phone.sync();
  await tablet.sync();
  check('журнал с телефона виден на планшете', tablet.rows.get(id)?.name === 'Скв. 12 — кустовая откачка');
  check('дебит перенёсся', tablet.rows.get(id)?.q === 864);

  console.log('\nПравка на втором устройстве');
  tablet.edit({ ...tablet.rows.get(id), q: 900, updated_at: new Date().toISOString() });
  await tablet.sync();
  await phone.sync();
  check('правка с планшета вернулась на телефон', phone.rows.get(id)?.q === 900);

  console.log('\nОдновременная правка');
  const base = phone.rows.get(id);
  phone.edit({ ...base, name: 'Версия с телефона', updated_at: new Date().toISOString() });
  await new Promise((r) => setTimeout(r, 50));
  tablet.edit({ ...base, name: 'Версия с планшета', updated_at: new Date().toISOString() });
  await tablet.sync();
  const conflicts = await phone.pull();
  check('расхождение замечено, а не потеряно молча', conflicts.length === 1,
    JSON.stringify(conflicts));
  check('обе версии доступны для выбора',
    conflicts[0]?.local === 'Версия с телефона' && conflicts[0]?.remote === 'Версия с планшета');

  console.log('\nУдаление');
  const del = phone.rows.get(id);
  phone.edit({ ...del, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  await phone.push();
  tablet.rows.delete(id);
  tablet.lastPulled = '1970-01-01T00:00:00Z';
  await tablet.pull();
  check('удаление доехало до второго устройства', Boolean(tablet.rows.get(id)?.deleted_at));

  console.log('\nЗамеры');
  const projectId = crypto.randomUUID();
  await rest(user.token, 'projects', {
    method: 'POST',
    body: JSON.stringify({ id: projectId, owner_id: user.id, name: 'Журнал с замерами',
      updated_at: new Date().toISOString() }),
  });
  const rows = [[1, 0.62], [2, 0.92], [5, 1.32]].map(([t, s], i) => ({
    id: crypto.randomUUID(), project_id: projectId, owner_id: user.id,
    t, s, sort_order: i, updated_at: new Date().toISOString(),
  }));
  const up = await rest(user.token, 'measurements', { method: 'POST', body: JSON.stringify(rows) });
  check('замеры уходят пачкой', up.status < 300, `статус ${up.status}`);

  const back = await rest(user.token, `measurements?project_id=eq.${projectId}&order=sort_order.asc`);
  check('замеры возвращаются в том же порядке',
    back.body?.length === 3 && back.body[0].t === 1 && back.body[2].s === 1.32);

  console.log('\nПромокод и права');
  await rest(user.token, 'rpc/get_entitlements', { method: 'POST', body: '{}' });
  const before = await rest(user.token, 'rpc/get_entitlements', { method: 'POST', body: '{}' });
  check('без подписки премиума нет', before.body?.premium === false);

  console.log('\n' + (failures ? `ПРОВАЛОВ: ${failures}` : 'Все проверки пройдены.'));
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
