/**
 * Главный компонент приложения АНСДИМАТ
 *
 * Определяет основную структуру:
 * - Провайдеры safe-area, языка и темы
 * - Навигационный контейнер
 * - Экран загрузки (SplashScreen)
 * - Основную стековую навигацию (RootNavigator) — бокового меню нет
 * - Плавающее нижнее меню поверх всей навигации
 *
 * Нижнее меню живёт здесь, а не внутри экранов: так оно всегда прижато
 * к нижней границе окна, не зависит от переходов и существует
 * в единственном экземпляре.
 */

// App.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './LanguageContext.js';
import { ThemeProvider } from './ThemeContext.js';
import { UnitsProvider } from './UnitsContext.js';
import { AuthProvider } from './AuthContext.js';
import { SyncProvider } from './sync/SyncContext.js';
import { EntitlementsProvider } from './billing/EntitlementsContext.js';
import RootNavigator from './navigation/RootNavigator.js';
import SplashScreen from './components/SplashScreen.js';
import * as NativeSplash from 'expo-splash-screen';
import BottomMenuBar from './components/BottomMenuBar.js';
import { navigationRef } from './navigation/navigationRef.js';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';

/**
 * Пункт нижнего меню, соответствующий текущему маршруту.
 * Настройки и Справка подсвечивают свои пункты; все остальные экраны
 * (Главная и разделы, открытые из неё) держат активной «Главную» —
 * как в дизайн-прототипе.
 */
function menuKeyForRoute(routeName) {
  if (routeName === 'Settings') return 'settings';
  if (routeName === 'About') return 'help';
  return 'home';
}

// Системная заставка держится до тех пор, пока не отрисуется своя:
// без этого между ними мелькает белый экран
NativeSplash.preventAutoHideAsync().catch(() => {});

export default function App() {
  // true — показываем SplashScreen, false — основное приложение
  const [isLoading, setIsLoading] = React.useState(true);
  // Активный пункт нижнего меню, выводится из текущего маршрута
  const [activeMenuKey, setActiveMenuKey] = React.useState('home');

  // Manrope (интерфейс) + JetBrains Mono (числа) — фирменная типографика.
  // Пока грузятся, держим JS-сплэш; он всё равно показывается ≥ 2.2 с.
  //
  // Ошибку загрузки обязательно разбираем: без неё сбойный шрифт оставляет
  // fontsLoaded навсегда равным false, и приложение зависает на заставке
  // без единого способа выйти. Системная гарнитура вместо фирменной — куда
  // меньшая беда, чем экран, с которого нельзя уйти
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  const handleSplashFinish = () => {
    setIsLoading(false);
  };

  /**
   * Синхронизирует подсветку нижнего меню с текущим экраном
   */
  const handleStateChange = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    setActiveMenuKey(menuKeyForRoute(routeName));
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LanguageProvider>
        <ThemeProvider>
        <UnitsProvider>
          <AuthProvider>
          <SyncProvider>
          <EntitlementsProvider>
          <NavigationContainer ref={navigationRef} onStateChange={handleStateChange}>
            {isLoading || (!fontsLoaded && !fontError) ? (
              <SplashScreen onFinish={handleSplashFinish} />
            ) : (
              <View style={styles.root}>
                <RootNavigator />
                <BottomMenuBar active={activeMenuKey} />
              </View>
            )}
          </NavigationContainer>
          </EntitlementsProvider>
          </SyncProvider>
          </AuthProvider>
          </UnitsProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
