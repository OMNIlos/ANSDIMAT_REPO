/**
 * Контекст аутентификации
 *
 * Держит текущую сессию Supabase и даёт экранам операции входа, регистрации
 * и выхода. Приложение остаётся работоспособным без сервера: если ключи не
 * заданы, состояние просто «не вошёл», а все данные лежат в локальной SQLite.
 *
 * Ошибки возвращаются вызывающему коду, а не бросаются: на экранах входа их
 * нужно показать текстом рядом с полями, а не падать.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import I18n from './Localization';

export const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  configured: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

/**
 * Переводит ошибку Supabase в понятное пользователю сообщение
 *
 * @param {Object} error - ошибка от supabase-js
 * @returns {string} текст для показа на экране
 */
function describeError(error) {
  if (!error) return '';
  const message = String(error.message || '');

  // Подтверждение почты проверяется раньше пароля: при включённых
  // подтверждениях сервер отклоняет вход до тех пор, пока по ссылке из письма
  // не перешли, и без этой ветки пользователь видел бы «неверный пароль»
  // и менял бы правильный пароль на другой правильный
  if (/not confirmed|email_not_confirmed/i.test(message)) {
    return I18n.t('authEmailNotConfirmed', {
      defaultValue:
        'Почта не подтверждена. Откройте ссылку из письма — или выключите подтверждение почты в настройках проекта Supabase.',
    });
  }
  if (/Invalid login credentials/i.test(message)) {
    return I18n.t('authInvalidCredentials', { defaultValue: 'Неверная почта или пароль' });
  }
  if (/already registered|already exists/i.test(message)) {
    return I18n.t('authEmailTaken', { defaultValue: 'Такая почта уже зарегистрирована' });
  }
  if (/Password should be at least/i.test(message)) {
    return I18n.t('authWeakPassword', { defaultValue: 'Пароль короче 6 символов' });
  }
  if (/Unable to validate email|invalid format/i.test(message)) {
    return I18n.t('authBadEmail', { defaultValue: 'Проверьте адрес почты' });
  }
  if (/network|fetch/i.test(message)) {
    return I18n.t('authNetwork', { defaultValue: 'Нет связи с сервером' });
  }
  return message;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    });

    // Подписка держит состояние в согласии с сервером: продление токена,
    // выход на другом устройстве, подтверждение почты
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      active = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      return { error: I18n.t('syncNotConfigured', { defaultValue: 'Синхронизация не настроена' }) };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: describeError(error) };
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) {
      return { error: I18n.t('syncNotConfigured', { defaultValue: 'Синхронизация не настроена' }) };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    // Если в проекте включено подтверждение почты, сессии сразу не будет
    const needsConfirmation = !error && !data.session;
    return { error: describeError(error), needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  /**
   * Отправляет письмо для сброса пароля
   *
   * @param {string} email - адрес учётной записи
   * @returns {Promise<{error: string|null}>} результат
   */
  const resetPassword = useCallback(async (email) => {
    if (!supabase) {
      return { error: I18n.t('syncNotConfigured', { defaultValue: 'Синхронизация не настроена' }) };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // По ссылке из письма приложение открывается на экране смены пароля
      redirectTo: 'ansdimat://reset-password',
    });
    return { error: describeError(error) };
  }, []);

  /**
   * Меняет пароль текущего пользователя
   *
   * @param {string} password - новый пароль
   * @returns {Promise<{error: string|null}>} результат
   */
  const changePassword = useCallback(async (password) => {
    if (!supabase) {
      return { error: I18n.t('syncNotConfigured', { defaultValue: 'Синхронизация не настроена' }) };
    }
    const { error } = await supabase.auth.updateUser({ password });
    return { error: describeError(error) };
  }, []);

  /**
   * Удаляет учётную запись вместе со всеми данными на сервере
   *
   * Возможность удалить аккаунт из самого приложения — обязательное
   * требование App Store и Google Play. Локальная база не трогается:
   * журналы остаются на устройстве, как и обещано пользователю.
   *
   * @returns {Promise<{error: string|null}>} результат
   */
  const deleteAccount = useCallback(async () => {
    if (!supabase) {
      return { error: I18n.t('syncNotConfigured', { defaultValue: 'Синхронизация не настроена' }) };
    }
    const { error } = await supabase.rpc('delete_own_account');
    if (error) return { error: describeError(error) };
    await supabase.auth.signOut();
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      resetPassword,
      changePassword,
      deleteAccount,
    }),
    [session, loading, signIn, signUp, signOut, resetPassword, changePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Доступ к состоянию аутентификации
 *
 * @returns {Object} сессия, пользователь и операции входа/выхода
 */
export function useAuth() {
  return useContext(AuthContext);
}
