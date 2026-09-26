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
import { ImportProvider } from './share/ImportContext.js';
import RootNavigator from './navigation/RootNavigator.js';
import SplashScreen from './components/SplashScreen.js';
import * as NativeSplash from 'expo-splash-screen';
import BottomMenuBar from './components/BottomMenuBar.js';
import ImportProjectDialog from './components/ImportProjectDialog.js';
import { navigationRef } from './navigation/navigationRef.js';
import { installWebGlobalStyles, useWebFontFaces } from './lib/webPolish';
import { loadPrefs } from './lib/appPrefs';
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
 * Пункт нижнего меню, соответствующий разделу
 *
 * Раздел задаёт не открытый экран, а корень стека: меню сбрасывает историю на
 * Главную, Настройки или Справку, и всё, что открыто дальше, лежит в том же
 * разделе. По открытому экрану вход в аккаунт из Настроек и руководство из
 * Справки подсвечивали «Главную» — меню показывало не то место, где человек
 * находится.
 *
 * @param {string} [rootName] - первый маршрут стека
 * @returns {'home'|'settings'|'help'} ключ пункта меню
 */
function menuKeyForRoot(rootName) {
  if (rootName === 'Settings') return 'settings';
  if (rootName === 'About') return 'help';
  return 'home';
}

// Системная заставка держится до тех пор, пока не отрисуется своя:
// без этого между ними мелькает белый экран
NativeSplash.preventAutoHideAsync().catch(() => {});

// Правила браузера, которых нет в StyleSheet: грани шрифтов, кольцо фокуса,
// полосы прокрутки. На нативе — пустая функция
installWebGlobalStyles();

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

  // На вебе у каждого семейства шрифта появляются грани всех весов — без них
  // браузер дорисовывает жирность сам, см. lib/webPolish.web.js. Пока они
  // грузятся, держится заставка: иначе первый экран мелькнул бы синтетикой
  const facesReady = useWebFontFaces(fontsLoaded);

  // Переключатели «Данные и расчёты» читаются один раз, пока идёт заставка:
  // экранам они нужны сразу — ширина колонки, геопозиция дневника
  React.useEffect(() => {
    loadPrefs();
  }, []);

  const handleSplashFinish = () => {
    setIsLoading(false);
  };

  /**
   * Синхронизирует подсветку нижнего меню с разделом, в котором открыт экран
   */
  const handleStateChange = () => {
    const rootName = navigationRef.getRootState()?.routes?.[0]?.name;
    setActiveMenuKey(menuKeyForRoot(rootName));
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
          {/* Провайдер импорта поднят выше заставки намеренно: файл
              «.ansdimat» может открыть само приложение, и ссылку на него
              надо поймать сразу при запуске, а не после того, как заставка
              уступит место навигатору */}
          <ImportProvider>
          <NavigationContainer ref={navigationRef} onStateChange={handleStateChange}>
            {isLoading || (!fontsLoaded && !fontError) || (fontsLoaded && !facesReady) ? (
              <SplashScreen onFinish={handleSplashFinish} />
            ) : (
              <View style={styles.root}>
                <RootNavigator />
                <BottomMenuBar active={activeMenuKey} />
                {/* Поверх навигатора: журнал может приехать на любом экране */}
                <ImportProjectDialog />
              </View>
            )}
          </NavigationContainer>
          </ImportProvider>
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
