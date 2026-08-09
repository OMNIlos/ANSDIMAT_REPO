/**
 * Состояние синхронизации для экранов
 *
 * Держит статус, время последнего обмена и очередь неотправленных записей.
 * Синхронизация запускается сама: при входе в аккаунт, при возвращении
 * приложения из фона и через паузу после правок — но не чаще, чем нужно:
 * полевые работы часто идут на дорогом мобильном трафике.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { countPending, resolveConflict, synchronize } from './engine';
import { useAuth } from '../AuthContext';
import { getSetting, setSetting } from '../db/settings';

/** Не синхронизируем чаще, чем раз в 15 минут при обычном открытии экрана */
const MIN_INTERVAL_MS = 15 * 60 * 1000;

/** Пауза после последней правки, через которую уходит отложенная отправка */
const DEBOUNCE_MS = 30 * 1000;

const SyncContext = createContext({
  status: 'idle',
  lastSyncedAt: null,
  pending: 0,
  conflicts: [],
  error: null,
  syncNow: async () => {},
  resolve: async () => {},
  scheduleSync: () => {},
});

export function SyncProvider({ children }) {
  const { session } = useAuth();
  const [status, setStatus] = useState('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const runningRef = useRef(false);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await countPending());
    } catch {
      // Счётчик — справочная величина: его сбой не должен ломать экран
    }
  }, []);

  useEffect(() => {
    getSetting('lastSyncedAt').then((v) => {
      if (v) setLastSyncedAt(Number(v));
    });
    refreshPending();
  }, [refreshPending]);

  const syncNow = useCallback(async () => {
    if (runningRef.current || !session) return null;
    runningRef.current = true;
    setStatus('syncing');
    setError(null);
    try {
      const result = await synchronize({ ownerId: session.user.id });
      if (!result.ok) {
        setStatus(result.reason === 'notConfigured' ? 'notConfigured' : 'idle');
        return result;
      }
      const now = Date.now();
      setLastSyncedAt(now);
      await setSetting('lastSyncedAt', String(now));
      setConflicts(result.conflicts);
      setStatus(result.conflicts.length ? 'conflicts' : 'done');
      await refreshPending();
      return result;
    } catch (err) {
      setError(err.message);
      setStatus('error');
      return null;
    } finally {
      runningRef.current = false;
    }
  }, [session, refreshPending]);

  /** Откладывает отправку: правки идут пачкой, а не по одной */
  const scheduleSync = useCallback(() => {
    refreshPending();
    if (!session) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(syncNow, DEBOUNCE_MS);
  }, [session, syncNow, refreshPending]);

  // Вход в аккаунт — полный обмен
  useEffect(() => {
    if (session) syncNow();
  }, [session, syncNow]);

  // Возврат из фона: обмениваемся, если прошло достаточно времени
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !session) return;
      if (lastSyncedAt && Date.now() - lastSyncedAt < MIN_INTERVAL_MS) return;
      syncNow();
    });
    return () => sub.remove();
  }, [session, lastSyncedAt, syncNow]);

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const resolve = useCallback(
    async (conflict, winner) => {
      await resolveConflict(conflict, winner);
      setConflicts((prev) => prev.filter((c) => !(c.table === conflict.table && c.id === conflict.id)));
      await syncNow();
    },
    [syncNow]
  );

  const value = {
    status,
    lastSyncedAt,
    pending,
    conflicts,
    error,
    syncNow,
    resolve,
    scheduleSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/**
 * Доступ к состоянию синхронизации
 *
 * @returns {Object} статус, счётчики и методы запуска
 */
export function useSync() {
  return useContext(SyncContext);
}
