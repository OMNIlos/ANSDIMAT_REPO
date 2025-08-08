/**
 * Навигационный компонент с боковым меню (Drawer Navigator)
 * 
 * Этот файл определяет основную навигационную структуру приложения:
 * - Боковое меню с основными разделами приложения
 * - Кастомный дизайн заголовка с логотипом
 * - Поддержка светлой и темной темы
 * - Интернационализация всех элементов меню
 * - Информация о языке и теме в футере
 * 
 * Структура меню:
 * - Основные разделы: Главная, Калькулятор, Обработка откачек, Полевой дневник, Примеры
 * - Дополнительные разделы: О программе, Контакты, Заказать, Подписка, Настройки
 */

// DrawerNavigator.js
import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import {
  useTheme,
  Divider,
  Surface,
  IconButton,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// Импорт всех экранов приложения
import HomeScreen from '../screens/HomeScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import PumpingTestProcessing from '../screens/PumpingTestProcessing';
import FieldDiaryScreen from '../screens/FieldDiaryScreen';
import ExamplesAndVideos from '../screens/ExamplesAndVideos';
import AboutScreen from '../screens/AboutScreen';
import ContactUs from '../screens/ContactUs';
import OrderScreen from '../screens/OrderScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { LanguageContext } from '../LanguageContext';
import { ThemeContext } from '../ThemeContext';
import I18n from '../Localization';

// Создаем экземпляр drawer navigator
const Drawer = createDrawerNavigator();

/**
 * Кастомный компонент содержимого бокового меню
 * 
 * Отвечает за отображение:
 * - Заголовка с логотипом и информацией о приложении
 * - Списка основных разделов меню
 * - Списка дополнительных разделов
 * - Футера с информацией о языке и теме
 * 
 * @param {Object} props - Свойства навигатора
 */
function CustomDrawerContent(props) {
  // Получаем текущую тему для адаптивного дизайна
  const theme = useTheme();
  // Получаем текущий язык из контекста
  const { locale } = useContext(LanguageContext);
  // Получаем текущий режим темы из контекста
  const { themeMode } = useContext(ThemeContext);

  /**
   * Основные пункты меню приложения
   * 
   * Содержит основные разделы, которые пользователь использует чаще всего
   * Каждый пункт имеет название, иконку и маршрут для навигации
   */
  const menuItems = [
    {
      name: 'Home',
      title: I18n.t('home', { defaultValue: 'Главная' }),
      icon: 'home',
      iconFamily: 'material', // Семейство иконок MaterialIcons
      route: 'Home',
    },
    {
      name: 'Calculator',
      title: I18n.t('calculator', { defaultValue: 'Калькулятор' }),
      icon: 'calculate',
      iconFamily: 'material',
      route: 'Calculator',
    },
    {
      name: 'PumpingTestProcessing',
      title: I18n.t('pumpingTest', { defaultValue: 'Обработка откачек' }),
      icon: 'water-pump',
      iconFamily: 'community', // Семейство иконок MaterialCommunityIcons
      route: 'PumpingTestProcessing',
    },
    {
      name: 'FieldDiary',
      title: I18n.t('field', { defaultValue: 'Полевой дневник' }),
      icon: 'map-outline',
      iconFamily: 'community',
      route: 'FieldDiary',
    },
    {
      name: 'ExamplesAndVideos',
      title: I18n.t('examples', { defaultValue: 'Примеры и видео' }),
      icon: 'play-circle-outline',
      iconFamily: 'community',
      route: 'ExamplesAndVideos',
    },
  ];

  /**
   * Дополнительные пункты меню
   * 
   * Содержит вспомогательные разделы, которые используются реже
   * Включает информацию о приложении, контакты, настройки и т.д.
   */
  const additionalItems = [
    {
      name: 'About',
      title: I18n.t('about', { defaultValue: 'О программе' }),
      icon: 'info-outline',
      iconFamily: 'material',
      route: 'About',
    },
    {
      name: 'ContactUs',
      title: I18n.t('contacts', { defaultValue: 'Контакты' }),
      icon: 'contacts',
      iconFamily: 'community',
      route: 'ContactUs',
    },
    {
      name: 'Order',
      title: I18n.t('order', { defaultValue: 'Заказать' }),
      icon: 'shopping-cart',
      iconFamily: 'material',
      route: 'Order',
    },
    {
      name: 'Subscription',
      title: I18n.t('subscription', { defaultValue: 'Подписка' }),
      icon: 'star',
      iconFamily: 'material',
      route: 'Subscription',
    },
    {
      name: 'Settings',
      title: I18n.t('settings', { defaultValue: 'Настройки' }),
      icon: 'settings',
      iconFamily: 'material',
      route: 'Settings',
    },
  ];

  const renderMenuItem = (item, isMainItem = true) => (
      <TouchableOpacity
      key={item.name}
          style={[
        styles.drawerItem,
        props.state.routeNames[props.state.index] === item.route && 
        [styles.activeDrawerItem, { backgroundColor: theme.colors.primary + '15' }]
      ]}
      onPress={() => props.navigation.navigate(item.route)}
    >
      <Surface style={[
        styles.iconContainer,
        { backgroundColor: isMainItem ? theme.colors.primary : theme.colors.surface }
      ]}>
        {item.iconFamily === 'community' ? (
          <MaterialCommunityIcons name={item.icon} size={20} color={isMainItem ? theme.colors.white : theme.colors.textSecondary} />
        ) : (
          <MaterialIcons name={item.icon} size={20} color={isMainItem ? theme.colors.white : theme.colors.textSecondary} />
        )}
      </Surface>
      
      <Text style={[
        styles.drawerItemText,
        { color: theme.colors.text },
        props.state.routeNames[props.state.index] === item.route && 
        { color: theme.colors.primary, fontWeight: '600' }
      ]}>
        {item.title}
        </Text>
      </TouchableOpacity>
  );

  return (
    <View style={[styles.drawerContainer, { backgroundColor: theme.colors.background }]}>
      {/* Заголовок drawer */}
      <View style={[styles.drawerHeader, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/splash.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerText}>
            <Text style={[styles.appTitle, { color: theme.colors.white }]}>
              {I18n.t('homeTitle', { defaultValue: 'АНСДИМАТ' })}
            </Text>
            <Text style={[styles.appSubtitle, { color: theme.colors.white }]}>
              v1.0.0
            </Text>
          </View>
        </View>
      </View>

      <DrawerContentScrollView 
        {...props} 
        showsVerticalScrollIndicator={false}
        style={styles.drawerContent}
        contentContainerStyle={styles.drawerContentContainer}
      >
        {/* Основные пункты меню */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {I18n.t('mainMenu', { defaultValue: 'Основное меню' })}
        </Text>
          {menuItems.map(item => renderMenuItem(item, true))}
        </View>

        <Divider style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Дополнительные пункты */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {I18n.t('additional', { defaultValue: 'Дополнительно' })}
        </Text>
          {additionalItems.map(item => renderMenuItem(item, false))}
        </View>
      </DrawerContentScrollView>

      {/* Информация о языке и теме */}
      <View style={[styles.drawerFooter, { borderTopColor: theme.colors.border }]}>
        <View style={styles.footerInfo}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            {I18n.t('language', { defaultValue: 'Язык' })}: {locale === 'ru' ? 'Русский' : 'English'}
        </Text>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            {I18n.t('theme', { defaultValue: 'Тема' })}: {themeMode === 'light' ? 'Светлая' : 'Тёмная'}
        </Text>
        </View>

        <Text style={[styles.copyright, { color: theme.colors.textSecondary }]}>
          © 2024 ansdimat.com
        </Text>
      </View>
    </View>
  );
}

export default function DrawerNavigator() {
  const theme = useTheme();

  return (
      <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: {
          backgroundColor: theme.colors.primary,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          },
        headerTintColor: 'white',
          headerTitleStyle: {
          fontWeight: 'bold',
        },
        drawerStyle: {
          backgroundColor: theme.colors.background,
          width: 300,
          },
        overlayColor: 'rgba(0, 0, 0, 0.5)',
      }}
      >
        <Drawer.Screen
          name="Home"
          component={HomeScreen}
        options={{
          title: I18n.t('homeTitle', { defaultValue: 'АНСДИМАТ' })
        }}
      />
      <Drawer.Screen
        name="Calculator"
        component={CalculatorScreen}
        options={{
          title: I18n.t('calculator', { defaultValue: 'Калькулятор' }),
        }}
      />
      <Drawer.Screen
        name="PumpingTestProcessing"
        component={PumpingTestProcessing}
        options={{
          title: I18n.t('pumpingTest', { defaultValue: 'Обработка откачек' }),
        }}
      />
      <Drawer.Screen
        name="FieldDiary"
        component={FieldDiaryScreen}
        options={{
          title: I18n.t('field', { defaultValue: 'Полевой дневник' }),
        }}
      />
      <Drawer.Screen
        name="ExamplesAndVideos"
        component={ExamplesAndVideos}
        options={{
          title: I18n.t('examples', { defaultValue: 'Примеры и видео' }),
        }}
        />
        <Drawer.Screen
          name="About"
          component={AboutScreen}
        options={{
          title: I18n.t('about', { defaultValue: 'О программе' }),
        }}
      />
      <Drawer.Screen
        name="ContactUs"
        component={ContactUs}
        options={{
          title: I18n.t('contacts', { defaultValue: 'Контакты' }),
        }}
        />
        <Drawer.Screen
          name="Order"
          component={OrderScreen}
        options={{
          title: I18n.t('order', { defaultValue: 'Заказать' }),
        }}
        />
        <Drawer.Screen
          name="Subscription"
          component={SubscriptionScreen}
        options={{
          title: I18n.t('subscription', { defaultValue: 'Подписка' }),
        }}
        />
        <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
          options={{
          title: I18n.t('settings', { defaultValue: 'Настройки' }),
          }}
        />
      </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
  },
  drawerHeader: { 
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 16,
    borderRadius: 15,
  },
  headerText: {
    flex: 1,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  appSubtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  drawerContent: {
    flex: 1,
    paddingHorizontal: 12
  },
  drawerContentContainer: {
    flexGrow: 0,
    justifyContent: 'flex-start',
  },
  menuSection: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 16,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  activeDrawerItem: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  drawerItemText: {
    fontSize: 16,
    flex: 1,
  },
  divider: {
    marginVertical: 8,
    height: 1,
  },
  drawerFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footerInfo: {
    marginBottom: 12,
  },
  footerText: {
    fontSize: 12,
    marginBottom: 4,
  },
  copyright: {
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.7,
  },
});
