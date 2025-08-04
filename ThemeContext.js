import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './theme.js';

export const ThemeContext = React.createContext({
  themeMode: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = React.useState('system');
  const [isLoading, setIsLoading] = React.useState(true);

  // Загружаем сохраненную тему при запуске
  React.useEffect(() => {
    loadThemePreference();
  }, []);

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

  const toggleTheme = async () => {
    const newTheme = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light';
    setThemeMode(newTheme);
    try {
      await AsyncStorage.setItem('themeMode', newTheme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  // Определяем текущую тему на основе настроек
  const getCurrentTheme = () => {
    try {
      if (themeMode === 'system') {
        return systemColorScheme === 'dark' ? darkTheme : lightTheme;
      }
      return themeMode === 'dark' ? darkTheme : lightTheme;
    } catch (error) {
      console.error('Error getting current theme:', error);
      return lightTheme; // Fallback к светлой теме
    }
  };

  const value = React.useMemo(() => ({ 
    themeMode, 
    toggleTheme,
    systemColorScheme 
  }), [themeMode, systemColorScheme]);
  
  const currentTheme = getCurrentTheme();
  // Показываем загрузочный экран пока загружаются настройки
  if (isLoading) {
    return (
      <ThemeContext.Provider value={value}>
        <PaperProvider theme={lightTheme}>
          {children}
        </PaperProvider>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={currentTheme}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
} 