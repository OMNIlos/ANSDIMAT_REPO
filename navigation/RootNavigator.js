/**
 * Корневая навигация приложения
 *
 * Стек-навигатор без бокового меню (drawer). Как в дизайн-прототипе:
 * - переходы между разделами — через нижнее меню (Главная/Настройки/Справка/Выход)
 *   и переходы «вглубь» с экрана;
 * - топ-бар показывает логотип на корневых экранах и стрелку «назад» на вложенных.
 *
 * Нижнее меню (BottomMenuBar) живёт в App поверх навигатора — здесь его нет.
 */

import React from 'react';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import ProjectsScreen from '../screens/PumpingTestProcessing/ProjectsScreen';
import DataProcessingScreen from '../screens/PumpingTestProcessing/DataProcessingScreen';
import SlugTestScreen from '../screens/PumpingTestProcessing/SlugTestScreen';
import LugeonScreen from '../screens/PumpingTestProcessing/LugeonScreen';
import VadoseFillScreen from '../screens/PumpingTestProcessing/VadoseFillScreen';
import FieldDiaryScreen from '../screens/FieldDiaryScreen';
import MapsScreen from '../screens/MapsScreen';
import ExamplesAndVideos from '../screens/ExamplesAndVideos';
import UserManualScreen from '../screens/UserManualScreen';
import AboutScreen from '../screens/AboutScreen';
import ContactUs from '../screens/ContactUs';
import OrderScreen from '../screens/OrderScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import AccountScreen from '../screens/AccountScreen';
import TopBar from '../components/TopBar';
import I18n from '../Localization';
import { PREMIUM_ENABLED } from '../billing/config';

const Stack = createStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        header: (props) => <TopBar {...props} />,
        ...TransitionPresets.SlideFromRightIOS,
        // Карточка экрана обязана держать высоту окна. Без этого на вебе
        // react-navigation ставит ей minHeight: 100% без flex, карточка
        // растягивается по содержимому, и внутренний ScrollView перестаёт
        // быть прокруткой: длинные экраны (калькулятор) просто обрезались
        cardStyle: { flex: 1, minHeight: 0 },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: I18n.t('homeTitle', { defaultValue: 'АНСДИМАТ' }) }}
      />
      <Stack.Screen
        name="Calculator"
        component={CalculatorScreen}
        options={{ title: I18n.t('calculator', { defaultValue: 'Калькулятор' }) }}
      />
      {/* Модуль обработки откачек — плоско в корневом стеке,
          чтобы кнопка «назад» работала на его главном экране */}
      <Stack.Screen
        name="PumpingMain"
        component={ProjectsScreen}
        options={{ title: I18n.t('pumpingTest', { defaultValue: 'Обработка откачек' }) }}
      />
      <Stack.Screen
        name="DataProcessing"
        component={DataProcessingScreen}
        options={{ title: I18n.t('dataProcessing', { defaultValue: 'Обработка ОФР' }) }}
      />
      {/* Виды ОФР со своей расчётной схемой. Каждому свой экран: у одного
          график lg(s⁰/s) — t, у другого таблица ступеней давления, у третьего
          расчёт по одной формуле без журнала — общего интерфейса у них нет */}
      <Stack.Screen
        name="SlugTest"
        component={SlugTestScreen}
        options={{ title: I18n.t('slugTitle', { defaultValue: 'Экспресс-опробование' }) }}
      />
      <Stack.Screen
        name="LugeonTest"
        component={LugeonScreen}
        options={{ title: I18n.t('lugeonTitle', { defaultValue: 'Поинтервальное нагнетание' }) }}
      />
      <Stack.Screen
        name="VadoseFill"
        component={VadoseFillScreen}
        options={{ title: I18n.t('vadoseTitle', { defaultValue: 'Налив в шурф' }) }}
      />
      <Stack.Screen
        name="FieldDiary"
        component={FieldDiaryScreen}
        options={{ title: I18n.t('field', { defaultValue: 'Полевой дневник' }) }}
      />
      {/* Построитель карт гидроизогипс. Отдельным маршрутом, а не вкладкой
          калькулятора: он занимает экран целиком и держит своё состояние —
          построенную карту нельзя терять при переключении вкладок */}
      <Stack.Screen
        name="Maps"
        component={MapsScreen}
        options={{ title: I18n.t('maps', { defaultValue: 'Карты гидроизогипс' }) }}
      />
      <Stack.Screen
        name="ExamplesAndVideos"
        component={ExamplesAndVideos}
        options={{ title: I18n.t('examples', { defaultValue: 'Примеры и видео' }) }}
      />
      <Stack.Screen
        name="UserManual"
        component={UserManualScreen}
        options={{ title: I18n.t('aboutManual', { defaultValue: 'Руководство пользователя' }) }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: I18n.t('help', { defaultValue: 'Справка' }) }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: I18n.t('settings', { defaultValue: 'Настройки' }) }}
      />
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ title: I18n.t('accountTitle', { defaultValue: 'Аккаунт' }) }}
      />
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{ title: I18n.t('accountTitle', { defaultValue: 'Аккаунт' }) }}
      />
      {/* Тарифы. Пока премиум выключен, маршрут не регистрируется: вести на
          него неоткуда, а живой экран покупки посреди бесплатного приложения
          обещал бы то, чего нет */}
      {PREMIUM_ENABLED && (
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{ title: I18n.t('subscription', { defaultValue: 'Подписка' }) }}
        />
      )}
      <Stack.Screen
        name="Order"
        component={OrderScreen}
        options={{ title: I18n.t('order', { defaultValue: 'Заказать' }) }}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUs}
        options={{ title: I18n.t('contacts', { defaultValue: 'Контакты' }) }}
      />
    </Stack.Navigator>
  );
}
