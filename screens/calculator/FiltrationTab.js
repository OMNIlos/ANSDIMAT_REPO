/**
 * Вкладка «Коэффициент фильтрации»
 *
 * Пересчёт одного значения сразу по всем размерностям. В поле приходит число
 * из чужого отчёта — в сантиметрах в секунду, в мейнцерах, в футах в сутки, —
 * и его нужно привести к тем единицам, в которых считает проект.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Platform, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { convertToAllUnits, FILTRATION_UNITS } from '../../calc/units';
import AppearIn from '../../components/ui/AppearIn';
import { type, spacing, fontFamily } from '../../theme';
import {
  Card,
  NO_AUTOFILL,
  OptionRow,
  SectionLabel,
  parseNumber,
  formatValue,
  styles as shared,
} from './shared';

export default function FiltrationTab() {
  const theme = useTheme();

  const [kValue, setKValue] = useState('5');
  const [kUnit, setKUnit] = useState('m_day');

  const converted = convertToAllUnits(parseNumber(kValue), kUnit);
  const units = FILTRATION_UNITS.map((unit) => ({
    value: unit.key,
    label: I18n.t(unit.labelKey),
  }));
  const active = units.find((unit) => unit.value === kUnit);

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
                value={kValue}
                onChangeText={setKValue}
                keyboardType="decimal-pad"
                {...NO_AUTOFILL}
                placeholder="—"
                placeholderTextColor={theme.colors.faint}
                selectionColor={theme.colors.primary}
                style={[shared.bigInput, styles.heroInput, { color: theme.colors.text }]}
              />
              <Text style={[styles.heroUnit, { color: theme.colors.faint }]}>{active?.label}</Text>
            </View>
          </View>
          <View style={[styles.unitBox, { borderTopColor: theme.colors.border }]}>
            <OptionRow options={units} value={kUnit} onChange={setKUnit} />
          </View>
        </Card>
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>
          {I18n.t('convertedToAllUnits', { defaultValue: 'Пересчёт по всем единицам' })}
        </SectionLabel>
        <Card style={shared.listCard}>
          {converted.map((row, index) => {
            const selected = row.key === kUnit;
            return (
              <View
                key={row.key}
                style={[
                  shared.convertRow,
                  styles.convertRow,
                  index > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.convertLabel,
                    { color: selected ? theme.colors.primaryAccent : theme.colors.textSecondary },
                  ]}
                >
                  {I18n.t(row.labelKey)}
                </Text>
                <Text
                  style={[
                    shared.convertValue,
                    { color: selected ? theme.colors.primaryAccent : theme.colors.text },
                  ]}
                >
                  {formatValue(row.value)}
                </Text>
              </View>
            );
          })}
        </Card>
      </AppearIn>
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
    // Значение прижато к размерности справа, как во всех остальных строках
    // калькулятора: при выключке влево между числом и «м/сут» зияла дыра
    // в треть экрана, и строка читалась как незаполненная
    textAlign: 'right',
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  heroUnit: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
  },
  unitBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Строка пересчёта живёт в карточке-списке: горизонтальные поля карточка уже
  // задала, здесь остаётся только убрать их дубль
  convertRow: {
    paddingHorizontal: 0,
  },
  convertLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
});
