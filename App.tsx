/**
 * Главный компонент приложения АНСДИМАТ
 * 
 * Этот файл является точкой входа в приложение и определяет основную структуру:
 * - Провайдеры для языка и темы
 * - Навигационный контейнер
 * - Экран загрузки (SplashScreen)
 * - Основную навигацию (DrawerNavigator)
 * 
 */

// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { LanguageProvider } from './LanguageContext.js';
import { ThemeProvider } from './ThemeContext.js';
import DrawerNavigator from './navigation/DrawerNavigator.js';
import SplashScreen from './components/SplashScreen.js';

export default function App() {
  // Состояние для управления отображением экрана загрузки
  // true - показываем SplashScreen, false - показываем основное приложение
  const [isLoading, setIsLoading] = React.useState(true);

  /**
   * Обработчик завершения экрана загрузки
   * Вызывается после истечения таймера в SplashScreen (2.5 секунды)
   * Переключает приложение на основной интерфейс
   */
  const handleSplashFinish = () => {
    setIsLoading(false);
  };

  return (
    // Провайдер языка - обеспечивает поддержку интернационализации (русский/английский)
    <LanguageProvider>
      {/* Провайдер темы - обеспечивает поддержку светлой и темной темы */}
      <ThemeProvider>
        {/* Навигационный контейнер - управляет навигацией между экранами */}
        <NavigationContainer>
          {/* Условный рендеринг: показываем SplashScreen или основное приложение */}
          {isLoading ? (
            // Экран загрузки с логотипом и информацией о приложении
            <SplashScreen onFinish={handleSplashFinish} />
          ) : (
            // Основная навигация приложения с боковым меню
            <DrawerNavigator />
          )}
        </NavigationContainer>
      </ThemeProvider>
    </LanguageProvider>
  );
}
