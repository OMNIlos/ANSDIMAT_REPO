/**
 * Клиент Supabase
 *
 * Ключи берутся из переменных окружения EXPO_PUBLIC_* — они попадают в бандл,
 * поэтому здесь может лежать только публичный anon-ключ. Доступ к чужим данным
 * закрывается политиками Row Level Security на стороне базы, а не секретностью
 * ключа (см. docs/supabase-setup.md).
 *
 * Если ключи не заданы, клиент не создаётся: приложение продолжает работать
 * полностью локально, а экраны входа показывают, что синхронизация не настроена.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Приводит значение переменной окружения к пригодному виду
 *
 * Значение приезжает из `.env` или из переменных EAS, и там легко оказывается
 * лишнее: пробелы по краям, кавычки, а при неудачном копировании — вторая
 * строка следом за первой. Берём первую непустую строку и чистим её.
 *
 * @param {string|undefined} raw - значение из окружения
 * @returns {string} очищенное значение
 */
function readEnv(raw) {
  if (typeof raw !== 'string') return '';
  const firstLine = raw.split(/[\r\n]+/).find((line) => line.trim() !== '') ?? '';
  return firstLine.trim().replace(/^['"]|['"]$/g, '');
}

const supabaseUrl = readEnv(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = readEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Похоже ли значение на адрес проекта
 *
 * supabase-js на кривом адресе бросает исключение прямо при создании клиента.
 * Здесь это происходит на верхнем уровне модуля, то есть до отрисовки первого
 * экрана, — и в собранном приложении такое падение выглядит как мгновенный
 * вылет без всяких объяснений. Поэтому проверяем сами и заранее.
 */
function looksLikeUrl(value) {
  return /^https?:\/\/[^\s/]+/i.test(value);
}

const hasKeys = Boolean(supabaseUrl && supabaseAnonKey);

if (hasKeys && !looksLikeUrl(supabaseUrl)) {
  // eslint-disable-next-line no-console
  console.warn(
    'EXPO_PUBLIC_SUPABASE_URL не похож на адрес проекта — синхронизация выключена. ' +
      'Ожидается https://<ref>.supabase.co'
  );
}

/**
 * Клиент Supabase или null, если ключи не заданы либо заданы неверно
 *
 * Сессия хранится в AsyncStorage, поэтому вход переживает перезапуск
 * приложения. autoRefreshToken продлевает её в фоне.
 *
 * Создание обёрнуто в try: приложение обязано запускаться при любом
 * содержимом переменных. Неверный адрес отключает синхронизацию, а не ломает
 * работу в поле, ради которой всё и считается на устройстве.
 */
function createSupabaseClient() {
  if (!hasKeys || !looksLikeUrl(supabaseUrl)) return null;

  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // В мобильном приложении нет URL с токеном, который надо разбирать
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Не удалось создать клиент Supabase, синхронизация выключена:', error?.message);
    return null;
  }
}

export const supabase = createSupabaseClient();

/** Настроена ли синхронизация с сервером */
export const isSupabaseConfigured = supabase !== null;
