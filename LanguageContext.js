/**
 * Контекст для управления языком приложения
 * 
 * Этот файл обеспечивает:
 * - Автоматическое определение системного языка устройства
 * - Сохранение выбранного языка в AsyncStorage
 * - Переключение между русским и английским языками
 * - Предоставление текущего языка всем компонентам приложения
 * 
 * Поддерживаемые языки: русский (ru), английский (en)
 * 
 */

// LanguageContext.js
import React from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import I18n from "./Localization.js";

// Создаем контекст с дефолтными значениями
export const LanguageContext = React.createContext({
  locale: "ru", // Текущий язык приложения
  toggleLanguage: () => {}, // Функция для переключения языка
});

export const LanguageProvider = ({ children }) => {
  // Системный язык уже определён и выставлен в I18n при загрузке модуля,
  // отсюда и берём начальное значение: иначе первый рендер шёл бы по-русски
  // независимо от языка устройства
  const [locale, setLocale] = React.useState(I18n.locale);
  // Состояние загрузки (используется для предотвращения мерцания при инициализации)
  const [isLoading, setIsLoading] = React.useState(true);

  /**
   * Определяет системный язык устройства
   * 
   * Алгоритм определения:
   * 1. Пытается получить локаль из expo-localization
   * 2. Извлекает код языка (например, 'ru' из 'ru-RU')
   * 3. Если язык русский - возвращает 'ru', иначе 'en'
   * 4. В случае ошибки возвращает английский как fallback
   * 
   * @returns {string} Код языка ('ru' или 'en')
   */
  const getSystemLanguage = () => {
    try {
      const locales = Localization.getLocales();
      if (Array.isArray(locales) && locales.length > 0) {
        const languageCode = locales[0]?.languageCode;
        if (languageCode && typeof languageCode === 'string') {
          return languageCode === 'ru' ? 'ru' : 'en';
        }
      }

      console.warn('Could not determine system language, using default');
      return 'en'; // По умолчанию английский
    } catch (error) {
      console.error('Error getting system language:', error);
      return 'en'; // По умолчанию английский в случае ошибки
    }
  };

  /**
   * Загружает сохраненный язык при запуске приложения
   * Вызывается один раз при инициализации компонента
   */
  React.useEffect(() => {
    // Задержка на инициализацию expo-localization больше не нужна: язык
    // устройства определяется синхронно в Localization.js
    loadLanguagePreference();
  }, []);

  /**
   * Загружает предпочтения языка из AsyncStorage
   * 
   * Логика загрузки:
   * 1. Пытается загрузить сохраненный язык из AsyncStorage
   * 2. Если сохраненного языка нет - определяет системный язык
   * 3. Сохраняет определенный язык в AsyncStorage
   * 4. Устанавливает язык в I18n и состояние компонента
   */
  const loadLanguagePreference = async () => {
    try {
      const savedLocale = await AsyncStorage.getItem('appLocale');
      if (savedLocale) {
        // Если есть сохраненный язык - используем его
        setLocale(savedLocale);
        I18n.locale = savedLocale;
      } else {
        // Своего выбора пользователь не делал — идём за системой и НЕ пишем
        // язык в хранилище: записанный, он навсегда закрепил бы язык первого
        // запуска, и смена языка телефона на приложение уже не влияла бы
        const systemLanguage = getSystemLanguage();
        setLocale(systemLanguage);
        I18n.locale = systemLanguage;
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
      // В случае ошибки используем английский как fallback
      setLocale('en');
      I18n.locale = 'en';
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Переключает язык приложения между русским и английским
   * 
   * Действия:
   * 1. Определяет новый язык (противоположный текущему)
   * 2. Обновляет состояние компонента
   * 3. Устанавливает новый язык в I18n
   * 4. Сохраняет выбор в AsyncStorage
   */
  const toggleLanguage = async () => {
    const newLocale = locale === "ru" ? "en" : "ru";
    setLocale(newLocale);
    I18n.locale = newLocale;
    try {
      await AsyncStorage.setItem('appLocale', newLocale);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  /**
   * Устанавливает конкретный язык напрямую
   *
   * Нужен экрану настроек с сегментами RU/EN, где язык выбирается явно,
   * а не переключается по кругу.
   *
   * @param {'ru'|'en'} newLocale - выбранный язык
   */
  const setLanguage = async (newLocale) => {
    if (newLocale !== 'ru' && newLocale !== 'en') return;
    setLocale(newLocale);
    I18n.locale = newLocale;
    try {
      await AsyncStorage.setItem('appLocale', newLocale);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  // Предоставляем контекст всем дочерним компонентам
  return (
    <LanguageContext.Provider value={{ locale, toggleLanguage, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};
