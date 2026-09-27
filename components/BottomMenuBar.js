/**
 * Нижнее меню приложения (по дизайн-прототипу)
 *
 * Плавающий бордовый бар: Главная / Настройки / Справка. Это единственная
 * навигация между разделами — бокового меню (drawer) в приложении нет.
 *
 * Пункты сбрасывают стек на выбранный экран, поэтому на них в топ-баре
 * показывается логотип, а не стрелка «назад».
 *
 * «Выхода» здесь нет: в меню он читался как выход из программы, хотя
 * завершал сессию аккаунта синхронизации. Выход из аккаунта — в «Настройки →
 * Аккаунт», там же и его подтверждение.
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
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
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
 * Нативный драйвер анимаций — везде, кроме веба
 *
 * Анимации меню — на Animated из самого React Native, а не на Reanimated:
 * меню стоит на каждом экране, а при блоках Reanimated на экране прозрачные
 * окна Modal на Android (новая архитектура, Reanimated 3.17 из Expo SDK 53)
 * открывались пустыми и невидимыми — см. components/ui/AppearIn.js
 */
const NATIVE = Platform.OS !== 'web';

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
  const on = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = React.useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    const target = active ? 1 : 0;
    if (reduceMotion) {
      on.setValue(target);
      return undefined;
    }
    const animation = Animated.timing(on, {
      toValue: target,
      duration: SWITCH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, on]);

  const pill = {
    opacity: on,
    transform: [
      { scaleX: on.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
      { scaleY: on.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
    ],
  };

  const body = {
    transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) }],
  };

  const setPressed = (next) => {
    if (reduceMotion) return;
    const animation = next
      ? Animated.timing(press, { toValue: 1, duration: 90, useNativeDriver: NATIVE })
      : Animated.spring(press, { toValue: 0, ...PRESS_SPRING, useNativeDriver: NATIVE });
    animation.start();
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
  // Подписка на язык: подписи пунктов читаются из I18n на каждой отрисовке,
  // но меню само не перерисовывалось при смене языка — на экране настроек,
  // где язык и меняют, оно оставалось русским до первого перехода
  React.useContext(LanguageContext);
  // Экран с развёрнутым содержимым просит убрать меню совсем: там оно
  // закрывает низ и отнимает высоту у того, ради чего разворот и нажат
  const menuHidden = useMenuHidden();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);

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

  const items = [
    { key: 'home', label: I18n.t('home', { defaultValue: 'Главная' }), icon: 'home', onPress: () => resetTo('Home') },
    { key: 'settings', label: I18n.t('settings', { defaultValue: 'Настройки' }), icon: 'settings', onPress: () => resetTo('Settings') },
    { key: 'help', label: I18n.t('help', { defaultValue: 'Справка' }), icon: 'help', onPress: () => resetTo('About') },
  ];

  if (keyboardVisible || menuHidden) return null;

  return (
    // Минимум 26: на устройствах без системного отступа меню иначе
    // прижималось к краю и полоса жеста ложилась прямо на подписи.
    // Внешний слой во всю ширину только центрирует полосу и пропускает
    // касания мимо неё к содержимому
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
