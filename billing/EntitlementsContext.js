/**
 * Права доступа к премиум-функциям
 *
 * Решение о премиуме принимает сервер: функция `get_entitlements` смотрит
 * таблицу подписок и возвращает список открытых возможностей. Раньше статус
 * лежал в памяти устройства, и премиум включался правкой одного значения.
 *
 * Ответ кэшируется на сутки — в поле связи может не быть, и подписка не
 * должна отключаться посреди работы. Подделать кэш бессмысленно: в нём
 * лежит срок, выданный сервером, и при первом же выходе в сеть подмена
 * вскроется.
 *
 * Что закрыто подпиской, а что нет: обработка ОФР и базовый калькулятор
 * бесплатны — это ядро продукта. Платными становятся синхронизация,
 * расширенные расчёты и экспорт.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getSetting, setSetting } from '../db/settings';
import { useAuth } from '../AuthContext';

/** Сколько кэш считается свежим без связи с сервером */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const FREE = {
  premium: false,
  source: 'none',
  expiresAt: null,
  features: { sync: false, advancedCalc: false, exportPdf: false, unlimitedProjects: false },
};

const EntitlementsContext = createContext({
  entitlements: FREE,
  loading: false,
  refresh: async () => {},
  redeemPromo: async () => ({ ok: false }),
  has: () => false,
});

export function EntitlementsProvider({ children }) {
  const { session } = useAuth();
  const [entitlements, setEntitlements] = useState(FREE);
  const [loading, setLoading] = useState(false);

  /** Достаёт из кэша, если он ещё свежий */
  const loadCache = useCallback(async () => {
    const raw = await getSetting('entitlements');
    if (!raw) return null;
    try {
      const cached = JSON.parse(raw);
      if (!cached.checkedAt || Date.now() - cached.checkedAt > CACHE_TTL_MS) return null;
      // Срок подписки мог истечь, пока кэш ещё считался свежим
      if (cached.expiresAt && new Date(cached.expiresAt).getTime() < Date.now()) return null;
      return cached;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !session) {
      setEntitlements(FREE);
      return FREE;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_entitlements');
      if (error) throw error;

      const next = { ...FREE, ...data, checkedAt: Date.now() };
      setEntitlements(next);
      await setSetting('entitlements', JSON.stringify(next));
      return next;
    } catch {
      // Нет связи — работаем по кэшу, чтобы премиум не отвалился в поле
      const cached = await loadCache();
      const next = cached ?? FREE;
      setEntitlements(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [session, loadCache]);

  useEffect(() => {
    if (!session) {
      setEntitlements(FREE);
      return;
    }
    loadCache().then((cached) => {
      if (cached) setEntitlements(cached);
      refresh();
    });
  }, [session, loadCache, refresh]);

  /**
   * Активирует промокод
   *
   * @param {string} code - код
   * @returns {Promise<{ok: boolean, error?: string, expiresAt?: string}>} итог
   */
  const redeemPromo = useCallback(
    async (code) => {
      if (!isSupabaseConfigured) return { ok: false, error: 'notConfigured' };
      if (!session) return { ok: false, error: 'notSignedIn' };

      const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: code });
      if (error) return { ok: false, error: error.message };

      await refresh();
      return { ok: true, expiresAt: data?.[0]?.expires_at ?? null };
    },
    [session, refresh]
  );

  /**
   * Открыта ли возможность
   *
   * @param {string} feature - ключ из features
   * @returns {boolean} доступна ли функция
   */
  const has = useCallback(
    (feature) => Boolean(entitlements?.features?.[feature]),
    [entitlements]
  );

  return (
    <EntitlementsContext.Provider value={{ entitlements, loading, refresh, redeemPromo, has }}>
      {children}
    </EntitlementsContext.Provider>
  );
}

/**
 * Доступ к правам пользователя
 *
 * @returns {Object} права и методы обновления
 */
export function useEntitlements() {
  return useContext(EntitlementsContext);
}
