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
  Pressable,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import I18n from '../Localization';
import { useAuth } from '../AuthContext';
import ConfirmDialog from './ui/ConfirmDialog';
import { navigationRef } from '../navigation/navigationRef';
import { useMenuHidden } from './chromeVisibility';
import useReduceMotion from '../hooks/useReduceMotion';
import { palette, fontFamily, elevation, MENU_BAR_HEIGHT } from '../theme';

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

// Высота полосы меню объявлена в дизайн-системе; здесь переизлучается,
// чтобы прежние ссылки на неё продолжали работать
export { MENU_BAR_HEIGHT };

/**
 * Шире этого меню не растягивается
 *
 * На телефоне оно и так уже, а в широком окне браузера и на планшете полоса
 * во всю ширину разносила три пункта на метр друг от друга: меню читалось как
 * подвал сайта, а не как панель прибора. Ограниченное, оно стоит по центру
 * под колонкой содержимого.
 */
const MENU_MAX_WIDTH = 520;

/** Цвета подписи и значка: выбранный пункт белый, прочие приглушены */
const INK_ACTIVE = '#FFFFFF';
const INK_IDLE = 'rgba(255,255,255,0.58)';
const INK_HOVER = 'rgba(255,255,255,0.86)';

/** Длительность смены выбранного пункта, мс */
const SWITCH_MS = 240;

/** Пружина отклика на нажатие: без раскачки, как у карточек */
const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.5 };

/**
 * Пункт меню
 *
 * Выбранный пункт лежит на светлой подложке-«таблетке». Подложка своя у
 * каждого пункта и проявляется прозрачностью, а не едет общей меткой: общей
 * метке нужны замеры соседей, а onLayout на вебе приходит не всегда — тот же
 * приём, что у вкладок калькулятора.
 *
 * @param {Object} props
 * @param {Object} props.item - пункт: key, label, icon, onPress
 * @param {boolean} props.active - пункт выбран
 * @returns {React.ReactElement} пункт
 */
function MenuItem({ item, active }) {
  const reduceMotion = useReduceMotion();
  const on = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(0);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    const target = active ? 1 : 0;
    on.value = reduceMotion
      ? target
      : withTiming(target, { duration: SWITCH_MS, easing: Easing.out(Easing.cubic) });
  }, [active, reduceMotion, on]);

  const pill = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scaleX: 0.86 + on.value * 0.14 }, { scaleY: 0.9 + on.value * 0.1 }],
  }));

  const body = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.06 }],
  }));

  const setPressed = (next) => {
    if (reduceMotion) return;
    press.value = next
      ? withTiming(1, { duration: 90 })
      : withSpring(0, PRESS_SPRING);
  };

  const ink = active ? INK_ACTIVE : hovered ? INK_HOVER : INK_IDLE;

  return (
    <Pressable
      style={styles.item}
      onPress={item.onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.itemBody, body]}>
        <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
        <MaterialIcons name={item.icon} size={22} color={ink} />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: ink, fontFamily: active ? fontFamily.bold : fontFamily.semibold },
          ]}
        >
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

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
        прижималось к краю и полоса жеста ложилась прямо на подписи.
        Внешний слой во всю ширину только центрирует полосу и пропускает
        касания мимо неё к содержимому */}
    <View
      pointerEvents="box-none"
      style={[styles.dock, { bottom: Math.max(insets.bottom, 26) }]}
    >
      <View style={[styles.bar, elevation.brandButton]}>
        {items.map((item) => (
          <MenuItem key={item.key} item={item} active={item.key === active} />
        ))}
      </View>
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
  dock: {
    // На web — fixed: absolute там считается от документа, и в мобильных
    // браузерах бар уезжает вместе со страницей при скролле.
    // На нативе fixed не поддерживается, absolute внутри корневого View
    // и так прибит к экрану.
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 20,
  },
  bar: {
    width: '100%',
    maxWidth: MENU_MAX_WIDTH,
    flexDirection: 'row',
    backgroundColor: palette.wine,
    borderRadius: 26,
    paddingVertical: 6,
    paddingHorizontal: 6,
    // Тонкая светлая кромка сверху отделяет полосу от бордовой карточки или
    // шапки, если та окажется под ней
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  item: {
    flex: 1,
  },
  itemBody: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
    minHeight: MENU_BAR_HEIGHT - 12,
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    left: 6,
    right: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  label: {
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.1,
  },
});
