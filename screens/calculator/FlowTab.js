/**
 * Вкладка «Пересчёт Q»
 *
 * Пересчёт расхода сразу по всем размерностям. Повторяет вкладку «Расход»
 * диалога «Пересчёт единиц измерения» настольного АНСДИМАТ: в поле приходит
 * дебит из чужого отчёта — в галлонах в минуту, в баррелях, в литрах
 * в секунду, — и его надо привести к тем единицам, в которых считает проект.
 *
 * Устроена как «Пересчёт k», с одним отличием: единицу ввода выбирают
 * нажатием по строке, а не рядом чипов сверху. Двадцать девять чипов
 * переносятся в восемь строк и съедают экран до того, как покажется первое
 * значение; на девяти единицах фильтрации приём работает, здесь — нет.
 *
 * Плотность нужна только массовому расходу: килограммы в сутки — это
 * кубометры, помноженные на неё. Остальные двадцать пять единиц её не знают.
 *
 * Математика — в [`calc/units.js`](../../calc/units.js).
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Platform, Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import {
  DEFAULT_DENSITY,
  FLOW_GROUPS,
  FLOW_UNITS,
  convertFlowToAllUnits,
} from '../../calc/units';
import AppearIn from '../../components/ui/AppearIn';
import { type, spacing, fontFamily } from '../../theme';
import {
  Card,
  Field,
  NO_AUTOFILL,
  Note,
  SectionLabel,
  parseNumber,
  formatValue,
  styles as shared,
} from './shared';

export default function FlowTab() {
  const theme = useTheme();

  // Открывается на 10 л/мин: так заказчик чаще всего получает дебит из
  // полевых замеров, и первая же строка списка сразу отвечает на вопрос
  const [value, setValue] = useState('10');
  const [unit, setUnit] = useState('l_min');
  const [density, setDensity] = useState(String(DEFAULT_DENSITY));

  const converted = convertFlowToAllUnits(
    parseNumber(value),
    unit,
    parseNumber(density)
  );
  const byKey = Object.fromEntries(converted.map((row) => [row.key, row.value]));
  const activeLabel = I18n.t(
    FLOW_UNITS.find((item) => item.key === unit)?.labelKey ?? 'flowUnitM3Day'
  );

  /**
   * Переносит ввод в единицу нажатой строки
   *
   * Значение поля становится тем, что в этой строке и стоит: нажатие
   * означает «дальше считаем отсюда», а не «начни сначала».
   *
   * @param {string} key - ключ единицы
   */
  const pickUnit = (key) => {
    if (key === unit) return;
    const shown = byKey[key];
    setUnit(key);
    setValue(isFinite(shown) ? String(Number(shown.toPrecision(6))) : '');
  };

  return (
    <>
      <AppearIn index={0}>
        <Card>
          <View style={styles.hero}>
            <Text style={[type.eyebrow, { color: theme.colors.faint }]}>
              {I18n.t('value', { defaultValue: 'Значение' })}
            </Text>
            <View style={styles.heroRow}>
              <TextInput
                testID="flow-value"
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                {...NO_AUTOFILL}
                placeholder="—"
                placeholderTextColor={theme.colors.faint}
                selectionColor={theme.colors.primary}
                style={[shared.bigInput, styles.heroInput, { color: theme.colors.text }]}
              />
              <Text style={[styles.heroUnit, { color: theme.colors.faint }]}>
                {activeLabel}
              </Text>
            </View>
          </View>
          <View style={[styles.densityBox, { borderTopColor: theme.colors.border }]}>
            <Field
              label={I18n.t('flowDensity')}
              symbol="ρ"
              value={density}
              onChange={setDensity}
              unit={I18n.t('unitKgM3')}
            />
          </View>
        </Card>
      </AppearIn>

      <AppearIn index={1}>
        <Note>{I18n.t('flowUnitPickHint')}</Note>
      </AppearIn>

      {FLOW_GROUPS.map((group, groupIndex) => (
        <AppearIn key={group.labelKey} index={groupIndex + 2}>
          <SectionLabel>{I18n.t(group.labelKey)}</SectionLabel>
          <Card style={shared.listCard}>
            {group.units.map((item, index) => {
              const selected = item.key === unit;
              return (
                <Pressable
                  key={item.key}
                  testID={`flow-row-${item.key}`}
                  onPress={() => pickUnit(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={I18n.t(item.labelKey)}
                  style={[
                    shared.convertRow,
                    styles.convertRow,
                    index > 0
                      ? {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.colors.border,
                        }
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.convertLabel,
                      {
                        color: selected
                          ? theme.colors.primaryAccent
                          : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {I18n.t(item.labelKey)}
                  </Text>
                  <Text
                    style={[
                      shared.convertValue,
                      { color: selected ? theme.colors.primaryAccent : theme.colors.text },
                    ]}
                  >
                    {formatValue(byKey[item.key])}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </AppearIn>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  heroInput: {
    flex: 1,
    minWidth: 0,
    // Значение прижато к размерности справа, как на «Пересчёте k» и во всех
    // строках списка: при выключке влево между числом и «м³/сут» зияла бы
    // дыра в треть экрана, и строка читалась бы как незаполненная
    textAlign: 'right',
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  heroUnit: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
  },
  // Плотность отбита от значения линией: она не такое же исходное данное,
  // а поправка, которая нужна четырём строкам из двадцати девяти
  densityBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  convertRow: {
    paddingHorizontal: 0,
  },
  convertLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
});
