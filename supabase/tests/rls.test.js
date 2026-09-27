/**
 * Проверка разграничения доступа (RLS)
 *
 * Единственный барьер между данными разных клиентов — политики в базе.
 * Пока этот тест не проходит, синхронизацию включать нельзя: ошибка здесь
 * означает, что чужие журналы видны посторонним.
 *
 * Тест ходит в живой Supabase. Локально:
 *   npx supabase start
 *   node supabase/tests/rls.test.js
 */

const API = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

let failures = 0;

/**
 * Простейшая проверка с понятным выводом
 *
 * @param {string} name - что проверяем
 * @param {boolean} ok - результат
 * @param {string} [detail] - подробности при провале
 */
function check(name, ok, detail = '') {
  if (ok) {
    console.log('  ✓ ' + name);
  } else {
    failures += 1;
    console.log('  ✗ ' + name + (detail ? ' — ' + detail : ''));
  }
}

/**
 * Заводит пользователя и возвращает его токен
 *
 * @param {string} email - адрес
 * @returns {Promise<{token: string, id: string}>} доступ
 */
async function signUp(email) {
  const res = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test-password-123' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Не удалось создать пользователя: ' + JSON.stringify(data));
  return { token: data.access_token, id: data.user.id };
}

/**
 * Запрос к REST от имени пользователя
 *
 * @param {string} token - access token
 * @param {string} path - путь после /rest/v1/
 * @param {Object} [init] - параметры fetch
 * @returns {Promise<{status: number, body: any}>} ответ
 */
async function rest(token, path, init = {}) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

async function main() {
  const stamp = Date.now();
  const alice = await signUp(`alice-${stamp}@example.com`);
  const bob = await signUp(`bob-${stamp}@example.com`);
  console.log('Две учётки созданы.\n');

  console.log('Профиль');
  const aliceProfile = await rest(alice.token, 'profiles?select=id');
  check('заводится сам при регистрации', aliceProfile.body?.length === 1);
  check('чужой профиль не виден',
    (await rest(bob.token, `profiles?id=eq.${alice.id}`)).body?.length === 0);

  console.log('\nЖурналы ОФР');
  const projectId = crypto.randomUUID();
  const created = await rest(alice.token, 'projects', {
    method: 'POST',
    body: JSON.stringify({ id: projectId, owner_id: alice.id, name: 'Скв. 12', q: 864 }),
  });
  check('владелец создаёт журнал', created.status === 201, `статус ${created.status}`);

  const bobSees = await rest(bob.token, `projects?id=eq.${projectId}`);
  check('чужой журнал не виден', Array.isArray(bobSees.body) && bobSees.body.length === 0);

  const bobEdits = await rest(bob.token, `projects?id=eq.${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Взломано' }),
  });
  check('чужой журнал не правится',
    !(Array.isArray(bobEdits.body) && bobEdits.body.length > 0));

  const stolen = await rest(bob.token, 'projects', {
    method: 'POST',
    body: JSON.stringify({ id: crypto.randomUUID(), owner_id: alice.id, name: 'Подлог' }),
  });
  check('нельзя создать журнал от чужого имени', stolen.status >= 400, `статус ${stolen.status}`);

  console.log('\nЗамеры');
  const measure = await rest(alice.token, 'measurements', {
    method: 'POST',
    body: JSON.stringify({ id: crypto.randomUUID(), project_id: projectId, owner_id: alice.id, t: 1, s: 0.62 }),
  });
  check('владелец добавляет замер', measure.status === 201, `статус ${measure.status}`);

  const bobMeasure = await rest(bob.token, 'measurements', {
    method: 'POST',
    body: JSON.stringify({ id: crypto.randomUUID(), project_id: projectId, owner_id: bob.id, t: 5, s: 9 }),
  });
  check('нельзя подложить замер в чужой журнал', bobMeasure.status >= 400, `статус ${bobMeasure.status}`);

  console.log('\nТочки дневника');
  const point = await rest(alice.token, 'observation_points', {
    method: 'POST',
    body: JSON.stringify({
      id: crypto.randomUUID(), owner_id: alice.id, title: 'Скв. 12',
      type: 'well', lat: 59.7103, lon: 30.3841, recorded_at: new Date().toISOString(),
    }),
  });
  check('владелец ставит точку', point.status === 201, `статус ${point.status}`);
  check('чужие точки не видны',
    (await rest(bob.token, 'observation_points?select=id')).body?.length === 0);

  console.log('\nПодписка и права');
  const ent = await rest(alice.token, 'rpc/get_entitlements', { method: 'POST', body: '{}' });
  check('права выдаются сервером', ent.status === 200 && ent.body?.premium === false,
    JSON.stringify(ent.body));

  const writeSub = await rest(alice.token, 'subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      owner_id: alice.id, platform: 'promo', product_id: 'hack',
      original_tx_id: 'hack', status: 'active',
    }),
  });
  check('клиент не может выписать себе подписку', writeSub.status >= 400, `статус ${writeSub.status}`);

  console.log('\nУдаление аккаунта');
  const del = await rest(bob.token, 'rpc/delete_own_account', { method: 'POST', body: '{}' });
  check('учётка удаляется из приложения', del.status < 300, `статус ${del.status}`);
  const afterDelete = await rest(bob.token, 'profiles?select=id');
  // Токен ещё не истёк, но пользователя уже нет: приемлемы и отказ,
  // и пустая выборка — главное, что данные недоступны
  check('после удаления данных нет',
    afterDelete.status >= 400 || (Array.isArray(afterDelete.body) && afterDelete.body.length === 0),
    `статус ${afterDelete.status}, тело ${JSON.stringify(afterDelete.body)}`);

  console.log('\n' + (failures ? `ПРОВАЛОВ: ${failures}` : 'Все проверки пройдены.'));
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
