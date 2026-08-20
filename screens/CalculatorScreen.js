/**
 * Калькулятор гидрогеолога — расчёты, нужные в поле
 *
 * 1. Коэффициент фильтрации — пересчёт значения по всем единицам сразу.
 * 2. Оценка параметров — k по данным опытной откачки.
 * 3. Прогноз понижения — понижение от водозаборной скважины по четырём схемам.
 * 4. Приток в котлован — водоприток по формулам Дюпюи и Дюпюи–Тима.
 * 5. Барраж — граничные условия пласта методом отображений и подпор
 *    уровня перед непроницаемым сооружением.
 * 6. Инфильтрационные утечки — пласт с перетеканием (Хантуш — Джейкоб).
 *
 * Экран — только каркас: он держит выбор вкладки и ширину содержимого, а сами
 * вкладки лежат в `screens/calculator/`. Вся математика вынесена в `calc/` и
 * покрыта тестами, поэтому формулы проверяются отдельно от интерфейса.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../Localization';
import FiltrationTab from './calculator/FiltrationTab';
import ParamsTab from './calculator/ParamsTab';
import ForecastTab from './calculator/ForecastTab';
import PitTab from './calculator/PitTab';
import BarrageTab from './calculator/BarrageTab';
import LeakageTab from './calculator/LeakageTab';
import { styles as shared } from './calculator/shared';
import { spacing, radius } from '../theme';

const TABS = [
  { key: 'filtration', labelKey: 'tabFiltration', Component: FiltrationTab },
  { key: 'params', labelKey: 'tabParams', Component: ParamsTab },
  { key: 'forecast', labelKey: 'tabForecast', Component: ForecastTab },
  { key: 'pit', labelKey: 'tabPit', Component: PitTab },
  { key: 'barrage', labelKey: 'tabBarrage', Component: BarrageTab },
  { key: 'leakage', labelKey: 'tabLeakage', Component: LeakageTab },
];

export default function CalculatorScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState('filtration');

  // Та же ширина, что у карточек: контент ограничен 720 px и отбит полями
  const contentWidth = Math.min(width, 720) - spacing.lg * 2;
  const active = TABS.find((item) => item.key === tab) || TABS[0];
  const ActiveTab = active.Component;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((item) => {
          const selected = item.key === tab;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[
                styles.tab,
                { backgroundColor: selected ? theme.colors.primary : 'transparent' },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selected ? '#FFFFFF' : theme.colors.textSecondary },
                ]}
              >
                {I18n.t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={shared.content}
        keyboardShouldPersistTaps="handled"
      >
        <ActiveTab contentWidth={contentWidth} />
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Нижняя граница высоты задана явно: горизонтальная прокрутка с flexGrow: 0
  // на Android меряет себя короче содержимого, и у букв срезало нижние
  // выносные элементы — «фильтрации», «параметров». 18 (строка) + 12×2 (поля)
  // + 12 запаса.
  //
  // Именно minHeight, а не height: при увеличенном системном размере шрифта
  // строка становится выше, и жёсткая высота срезала бы её снова.
  //
  // Ключевых слов CSS вроде fit-content здесь быть не может: height в React
  // Native принимает число, проценты или 'auto'. На вебе такое значение
  // проходит насквозь в CSS и работает, а на Android его отбрасывают — стиль
  // просто исчезает вместе с починкой
  tabBar: {
    flexGrow: 0,
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBarContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
  },
  tabText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
