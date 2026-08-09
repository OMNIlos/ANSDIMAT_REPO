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
import FieldDiaryScreen from '../screens/FieldDiaryScreen';
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

const Stack = createStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        header: (props) => <TopBar {...props} />,
        ...TransitionPresets.SlideFromRightIOS,
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
      <Stack.Screen
        name="FieldDiary"
        component={FieldDiaryScreen}
        options={{ title: I18n.t('field', { defaultValue: 'Полевой дневник' }) }}
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
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: I18n.t('subscription', { defaultValue: 'Подписка' }) }}
      />
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
