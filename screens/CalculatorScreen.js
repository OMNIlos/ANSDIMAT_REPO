/**
 * Калькулятор гидрогеолога — расчёты, нужные в поле
 *
 * 1. Пересчёт расхода — значение по всем размерностям сразу.
 * 2. Коэффициент фильтрации — пересчёт значения по всем единицам сразу.
 * 3. Оценка по Q/s — фильтрационные параметры по дебиту и понижению.
 * 4. Расчёт понижения — понижение от водозаборной скважины по четырём схемам.
 * 5. Приток в котлован — водоприток по формулам Дюпюи и Дюпюи–Тима.
 * 6. Зона санитарной охраны — три пояса по времени добегания загрязнения.
 *
 * Экран — только каркас: он держит выбор вкладки и ширину содержимого, а сами
 * вкладки лежат в `screens/calculator/`. Вся математика вынесена в `calc/` и
 * покрыта тестами, поэтому формулы проверяются отдельно от интерфейса.
 *
 * Вкладки стоят переносящимся рядом, а не прокручиваемой лентой. В ленте
 * половина названий уходила за край экрана: выбранная вкладка могла оказаться
 * невидимой, а о существовании остальных приходилось догадываться. Перенос по
 * строкам показывает их все сразу — на телефоне это две-три строки, на
 * планшете одна.
 */

import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import I18n from '../Localization';
import FlowTab from './calculator/FlowTab';
import FiltrationTab from './calculator/FiltrationTab';
import ParamsTab from './calculator/ParamsTab';
import ForecastTab from './calculator/ForecastTab';
import PitTab from './calculator/PitTab';
import WhpaTab from './calculator/WhpaTab';
import { styles as shared } from './calculator/shared';
import useReduceMotion from '../hooks/useReduceMotion';
import { spacing, radius, fontFamily, MENU_BAR_HEIGHT } from '../theme';

const TABS = [
  { key: 'flow', labelKey: 'tabFlow', Component: FlowTab },
  { key: 'filtration', labelKey: 'tabFiltration', Component: FiltrationTab },
  { key: 'params', labelKey: 'tabParams', Component: ParamsTab },
  { key: 'forecast', labelKey: 'tabForecast', Component: ForecastTab },
  { key: 'pit', labelKey: 'tabPit', Component: PitTab },
  { key: 'whpa', labelKey: 'tabWhpa', Component: WhpaTab },
];

/** Длительность перекраски вкладки, мс */
const SWITCH_MS = 220;

/**
 * Одна вкладка калькулятора
 *
 * Заливка живёт внутри самой вкладки и проявляется прозрачностью, а не едет
 * отдельной меткой поверх ряда. Метке нужны измеренные координаты соседей, а
 * `onLayout` на вебе приходит не всегда — метка тогда замирала под первой
 * вкладкой. Здесь измерять нечего, и переключение выглядит одинаково везде.
 *
 * @param {Object} props
 * @param {string} props.label - название вкладки
 * @param {boolean} props.selected - вкладка выбрана
 * @param {Function} props.onPress - обработчик нажатия
 * @returns {React.ReactElement} вкладка
 */
function Tab({ label, selected, onPress }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    on.value = reduceMotion
      ? target
      : withTiming(target, { duration: SWITCH_MS, easing: Easing.out(Easing.cubic) });
  }, [selected, reduceMotion, on]);

  const fill = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: 0.92 + on.value * 0.08 }],
  }));

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [theme.colors.textSecondary, '#FFFFFF']),
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.tabFill, { backgroundColor: theme.colors.primary }, fill]}
      />
      <Animated.Text style={[styles.tabText, text]}>{label}</Animated.Text>
    </Pressable>
  );
}

export default function CalculatorScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // Через контекст, а не через useSafeAreaInsets: хук падает без провайдера,
  // и экран нельзя было бы отрисовать в тесте отдельно от приложения
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  const reduceMotion = useReduceMotion();
  const [tab, setTab] = useState('flow');

  const content = useRef(null);
  const fade = useSharedValue(1);

  // Та же ширина, что у карточек: контент ограничен 720 px и отбит полями
  const contentWidth = Math.min(width, 720) - spacing.lg * 2;
  const active = TABS.find((item) => item.key === tab) || TABS[0];
  const ActiveTab = active.Component;

  /**
   * Переключает вкладку: содержимое проявляется заново с самого верха
   *
   * @param {string} key - ключ вкладки
   */
  const selectTab = (key) => {
    if (key === tab) return;
    setTab(key);
    // Прокрутка общая на все вкладки: без сброса новая вкладка открывалась бы
    // с середины — на месте, где человек остановился в предыдущей
    content.current?.scrollTo({ y: 0, animated: false });
    if (reduceMotion) return;
    fade.value = 0;
    fade.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  };

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - fade.value) * 8 }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
        {TABS.map((item) => (
          <Tab
            key={item.key}
            label={I18n.t(item.labelKey)}
            selected={item.key === tab}
            onPress={() => selectTab(item.key)}
          />
        ))}
      </View>

      <ScrollView
        ref={content}
        contentContainerStyle={[
          shared.content,
          // Плавающее меню перекрывает низ экрана: последняя карточка обязана
          // подниматься над ним, иначе результат прячется под кнопками
          { paddingBottom: Math.max(insets.bottom, 26) + MENU_BAR_HEIGHT + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={bodyStyle}>
          <ActiveTab contentWidth={contentWidth} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
  },
  tabFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.chip,
  },
  tabText: {
    // Высота строки задана явно: у «фильтрации» и «параметров» на Android
    // иначе срезало нижние выносные элементы
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
