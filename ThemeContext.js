/**
 * Контекст для управления темой приложения
 * 
 * Этот файл обеспечивает:
 * - Поддержку светлой, темной и системной темы
 * - Автоматическое определение системной темы устройства
 * - Сохранение выбранной темы в AsyncStorage
 * - Переключение между темами (светлая -> темная -> системная -> светлая)
 * - Предоставление текущей темы всем компонентам через PaperProvider
 * 
 * Поддерживаемые темы: light (светлая), dark (темная), system (системная)
 * 
 */

import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './theme.js';

// Создаем контекст с дефолтными значениями
export const ThemeContext = React.createContext({
  themeMode: 'light', // Текущий режим темы
  toggleTheme: () => {}, // Функция для переключения темы
});

export function ThemeProvider({ children }) {
  // Получаем системную цветовую схему устройства (light/dark)
  const systemColorScheme = useColorScheme();
  // Состояние текущего режима темы (по умолчанию системная)
  const [themeMode, setThemeMode] = React.useState('system');
  // Состояние загрузки (используется для предотвращения мерцания при инициализации)
  const [isLoading, setIsLoading] = React.useState(true);

  /**
   * Загружает сохраненную тему при запуске приложения
   * Вызывается один раз при инициализации компонента
   */
  React.useEffect(() => {
    loadThemePreference();
  }, []);

  /**
   * Загружает предпочтения темы из AsyncStorage
   * 
   * Логика загрузки:
   * 1. Пытается загрузить сохраненную тему из AsyncStorage
   * 2. Если сохраненной темы нет - используется системная тема (по умолчанию)
   * 3. Устанавливает тему в состояние компонента
   */
  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');
      if (savedTheme) {
        setThemeMode(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Переключает тему приложения
   * 
   * Цикл переключения: светлая -> темная -> системная -> светлая
   * 
   * Действия:
   * 1. Определяет следующую тему в цикле
   * 2. Обновляет состояние компонента
   * 3. Сохраняет выбор в AsyncStorage
   */
  const toggleTheme = async () => {
    const newTheme = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light';
    setThemeMode(newTheme);
    try {
      await AsyncStorage.setItem('themeMode', newTheme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  /**
   * Определяет текущую тему на основе настроек пользователя
   * 
   * Логика определения:
   * 1. Если выбрана системная тема - использует системную цветовую схему
   * 2. Если выбрана конкретная тема - использует её
   * 3. В случае ошибки возвращает светлую тему как fallback
   * 
   * @returns {Object} Объект темы (lightTheme или darkTheme)
   */
  const getCurrentTheme = () => {
    try {
      if (themeMode === 'system') {
        // Если выбрана системная тема, используем системную цветовую схему
        return systemColorScheme === 'dark' ? darkTheme : lightTheme;
      }
      // Если выбрана конкретная тема, используем её
      return themeMode === 'dark' ? darkTheme : lightTheme;
    } catch (error) {
      console.error('Error getting current theme:', error);
      return lightTheme; // Fallback к светлой теме
    }
  };

  // Мемоизируем значение контекста для оптимизации производительности
  const value = React.useMemo(() => ({ 
    themeMode, 
    toggleTheme,
    systemColorScheme 
  }), [themeMode, systemColorScheme]);
  
  // Получаем текущую тему для применения
  const currentTheme = getCurrentTheme();
  
  // Показываем загрузочный экран пока загружаются настройки
  // Используем светлую тему как fallback во время загрузки
  if (isLoading) {
    return (
      <ThemeContext.Provider value={value}>
        <PaperProvider theme={lightTheme}>
          {children}
        </PaperProvider>
      </ThemeContext.Provider>
    );
  }

  // Предоставляем контекст и тему всем дочерним компонентам
  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={currentTheme}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
} 