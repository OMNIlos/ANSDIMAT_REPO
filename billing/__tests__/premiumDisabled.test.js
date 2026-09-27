/**
 * Проверка того, что премиум действительно выключен
 *
 * Платный доступ снят до выяснения, нужно ли приложение вообще (billing/config,
 * PREMIUM_ENABLED). Сама премиум-логика при этом осталась в коде и ждёт
 * возврата — а значит, её легко случайно включить обратно: хватит одной ветки,
 * забывшей спросить флаг.
 *
 * Здесь сторожится ровно то, что видит пользователь: открыто всё и всем, даже
 * без входа в аккаунт, и права не зависят от ответа сервера. Права запрашивают
 * с настоящего провайдера — подменены только вход и Supabase.
 *
 * Когда премиум вернут, эти проверки обязаны покраснеть: они описывают
 * отключённое состояние, а не вечное правило.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { PREMIUM_ENABLED } from '../config';

/** Права не должны зависеть ни от входа, ни от связи */
jest.mock('../../AuthContext', () => ({
  useAuth: () => ({ session: null }),
}));

/** Имя с префиксом mock — иначе jest.mock не пустит переменную внутрь фабрики */
const mockRpc = jest.fn(async () => ({ data: null, error: null }));
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args) => mockRpc(...args) },
}));

jest.mock('../../db/settings', () => ({
  getSetting: jest.fn(async () => null),
  setSetting: jest.fn(async () => {}),
}));

const { EntitlementsProvider, useEntitlements } = require('../EntitlementsContext');

/**
 * Поднимает провайдер и отдаёт то, что видит экран
 *
 * @returns {Promise<Object>} значение контекста
 */
async function readEntitlements() {
  let seen = null;
  const Probe = () => {
    seen = useEntitlements();
    return null;
  };

  await act(async () => {
    renderer.create(
      <EntitlementsProvider>
        <Probe />
      </EntitlementsProvider>
    );
  });

  return seen;
}

beforeEach(() => {
  mockRpc.mockClear();
});

test('премиум выключен', () => {
  expect(PREMIUM_ENABLED).toBe(false);
});

test('все возможности открыты без входа в аккаунт', async () => {
  const { entitlements } = await readEntitlements();

  expect(Object.values(entitlements.features)).not.toContain(false);
  expect(entitlements.source).toBe('disabled');
  // Подписки нет ни у кого: открыто не по ней, а потому что платного больше нет
  expect(entitlements.premium).toBe(false);
});

test('запертых возможностей не осталось, включая ещё не описанные', async () => {
  const { has } = await readEntitlements();

  expect(has('clusterMap')).toBe(true);
  expect(has('sync')).toBe(true);
  // Возможность, которую в список забыли внести, тоже обязана быть открытой —
  // иначе новая функция тихо окажется за снятым барьером
  expect(has('featureAddedLater')).toBe(true);
});

test('сервер о правах не спрашивается', async () => {
  const { refresh } = await readEntitlements();
  await act(async () => {
    await refresh();
  });

  expect(mockRpc).not.toHaveBeenCalled();
});

test('промокод не активируется: открывать ему нечего', async () => {
  const { redeemPromo } = await readEntitlements();

  let result;
  await act(async () => {
    result = await redeemPromo('ANY-CODE');
  });

  expect(result).toEqual({ ok: false, error: 'disabled' });
  expect(mockRpc).not.toHaveBeenCalled();
});
