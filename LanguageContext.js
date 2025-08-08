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
  // Состояние текущего языка (по умолчанию русский)
  const [locale, setLocale] = React.useState("ru");
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
      // Пробуем получить локаль из expo-localization
      if (Localization && Localization.locale) {
        const locale = Localization.locale;
        
        // Проверяем, что locale существует и является строкой
        if (locale && typeof locale === 'string') {
          const languageCode = locale.split('-')[0]; // Получаем код языка (например, 'ru' из 'ru-RU')
          
          // Если язык русский, используем русский, иначе английский
          return languageCode === 'ru' ? 'ru' : 'en';
        }
      }
      
      // Fallback: проверяем доступные локали
      if (Localization && Localization.locales && Localization.locales.length > 0) {
        const firstLocale = Localization.locales[0];
        if (firstLocale && typeof firstLocale === 'string') {
          const languageCode = firstLocale.split('-')[0];
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
    // Добавляем небольшую задержку для инициализации expo-localization
    const timer = setTimeout(() => {
      loadLanguagePreference();
    }, 100);
    
    return () => clearTimeout(timer);
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
        // Если нет сохраненного языка, используем системный
        const systemLanguage = getSystemLanguage();
        setLocale(systemLanguage);
        I18n.locale = systemLanguage;
        await AsyncStorage.setItem('appLocale', systemLanguage);
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

  // Предоставляем контекст всем дочерним компонентам
  return (
    <LanguageContext.Provider value={{ locale, toggleLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};
