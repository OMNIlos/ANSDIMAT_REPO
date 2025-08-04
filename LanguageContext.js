// LanguageContext.js
import React from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import I18n from "./Localization.js";

export const LanguageContext = React.createContext({
  locale: "ru",
  toggleLanguage: () => {},
});

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = React.useState("ru");
  const [isLoading, setIsLoading] = React.useState(true);

  // Определяем системный язык
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

  // Загружаем сохраненный язык при запуске
  React.useEffect(() => {
    // Добавляем небольшую задержку для инициализации expo-localization
    const timer = setTimeout(() => {
      loadLanguagePreference();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const loadLanguagePreference = async () => {
    try {
      const savedLocale = await AsyncStorage.getItem('appLocale');
      if (savedLocale) {
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

  return (
    <LanguageContext.Provider value={{ locale, toggleLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};
