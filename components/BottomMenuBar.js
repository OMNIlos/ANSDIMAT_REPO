/**
 * Нижнее меню приложения (по дизайн-прототипу)
 *
 * Плавающий бордовый бар: Главная / Настройки / Справка, а для вошедших —
 * ещё и Выход. Это единственная навигация между разделами — бокового меню
 * (drawer) в приложении нет.
 *
 * - Главная / Настройки / Справка сбрасывают стек на выбранный экран,
 *   поэтому на них в топ-баре показывается логотип, а не стрелка «назад».
 * - Выход завершает сессию аккаунта. Пункт появляется только при активной
 *   сессии: гостю выходить неоткуда, а закрывать приложение кнопкой внутри
 *   интерфейса — не то, чего от неё ждут.
 *
 * @param {string} active - ключ активного пункта ('home' | 'settings' | 'help')
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import I18n from '../Localization';
import { useAuth } from '../AuthContext';
import ConfirmDialog from './ui/ConfirmDialog';
import { navigationRef } from '../navigation/navigationRef';
import { useMenuHidden } from './chromeVisibility';
import { palette, fontFamily, elevation } from '../theme';

/**
 * Переходит на корневой экран раздела и сбрасывает историю переходов,
 * чтобы в топ-баре показывался логотип, а не стрелка «назад».
 */
function resetTo(routeName) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(
    CommonActions.reset({ index: 0, routes: [{ name: routeName }] })
  );
}

/**
 * Высота полосы меню без отступа снизу
 *
 * Нужна экранам, которые кладут поверх содержимого свои плавающие кнопки:
 * без общей константы приходилось подбирать отступ на глаз, и на телефонах
 * с жестовой навигацией кнопки наезжали на меню.
 */
export const MENU_BAR_HEIGHT = 61;

export default function BottomMenuBar({ active = 'home' }) {
  const insets = useSafeAreaInsets();
  // Экран с развёрнутым содержимым просит убрать меню совсем: там оно
  // закрывает низ и отнимает высоту у того, ради чего разворот и нажат
  const menuHidden = useMenuHidden();
  const { session, signOut } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const [signOutAsked, setSignOutAsked] = React.useState(false);

  // Скрываем бар при открытой клавиатуре, чтобы он не перекрывал поля ввода
  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const confirmSignOut = async () => {
    setSignOutAsked(false);
    await signOut();
    resetTo('Home');
  };

  const items = [
    { key: 'home', label: I18n.t('home', { defaultValue: 'Главная' }), icon: 'home', onPress: () => resetTo('Home') },
    { key: 'settings', label: I18n.t('settings', { defaultValue: 'Настройки' }), icon: 'settings', onPress: () => resetTo('Settings') },
    { key: 'help', label: I18n.t('help', { defaultValue: 'Справка' }), icon: 'help', onPress: () => resetTo('About') },
  ];

  if (session) {
    items.push({
      key: 'exit',
      label: I18n.t('exit', { defaultValue: 'Выход' }),
      icon: 'logout',
      onPress: () => setSignOutAsked(true),
    });
  }

  if (keyboardVisible || menuHidden) return null;

  return (
    <>
    {/* Минимум 26: на устройствах без системного отступа меню иначе
        прижималось к краю и полоса жеста ложилась прямо на подписи */}
    <View style={[styles.bar, elevation.brandButton, { bottom: Math.max(insets.bottom, 26) }]}>
      {items.map((item) => {
        const isActive = item.key === active;
        const color = isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)';
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={item.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isActive }}
          >
            <MaterialIcons name={item.icon} size={22} color={color} />
            <Text numberOfLines={1} style={[styles.label, { color, fontWeight: isActive ? '700' : '500' }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>

    <ConfirmDialog
      visible={signOutAsked}
      title={I18n.t('signOutTitle', { defaultValue: 'Выйти из аккаунта?' })}
      message={I18n.t('signOutMessage', {
        defaultValue: 'Журналы и точки останутся на устройстве. Синхронизация остановится до следующего входа.',
      })}
      confirmLabel={I18n.t('exit', { defaultValue: 'Выход' })}
      destructive
      onConfirm={confirmSignOut}
      onCancel={() => setSignOutAsked(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    // На web — fixed: absolute там считается от документа, и в мобильных
    // браузерах бар уезжает вместе со страницей при скролле.
    // На нативе fixed не поддерживается, absolute внутри корневого View
    // и так прибит к экрану.
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: palette.wine,
    borderRadius: 26,
    paddingVertical: 11,
    paddingHorizontal: 8,
    zIndex: 1000,
    elevation: 20,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 10.5,
  },
});
