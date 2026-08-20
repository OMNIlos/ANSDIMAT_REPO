/**
 * Вкладка «Коэффициент фильтрации»
 *
 * Пересчёт одного значения сразу по всем размерностям. В поле приходит число
 * из чужого отчёта — в сантиметрах в секунду, в мейнцерах, в футах в сутки, —
 * и его нужно привести к тем единицам, в которых считает проект.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { convertToAllUnits, FILTRATION_UNITS } from '../../calc/units';
import { type, elevation } from '../../theme';
import { parseNumber, formatValue, styles } from './shared';

export default function FiltrationTab() {
  const theme = useTheme();

  const [kValue, setKValue] = useState('5');
  const [kUnit, setKUnit] = useState('m_day');


  const renderFiltration = () => {
    const converted = convertToAllUnits(parseNumber(kValue), kUnit);

    return (
      <>
        <View
          style={[
            styles.card,
            elevation.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[type.eyebrow, { color: theme.colors.textSecondary }]}>
            {I18n.t("value", { defaultValue: "Значение" })}
          </Text>
          <TextInput
            value={kValue}
            onChangeText={setKValue}
            keyboardType="decimal-pad"
            style={[styles.bigInput, { color: theme.colors.text }]}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.unitRow}
          >
            {FILTRATION_UNITS.map((unit) => {
              const active = unit.key === kUnit;
              return (
                <TouchableOpacity
                  key={unit.key}
                  onPress={() => setKUnit(unit.key)}
                  style={[
                    styles.unitChip,
                    {
                      backgroundColor: active
                        ? theme.colors.primary
                        : "transparent",
                      borderColor: active
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.unitChipText,
                      {
                        color: active ? "#FFFFFF" : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {I18n.t(unit.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <Text
          style={[
            type.eyebrow,
            styles.sectionLabel,
            { color: theme.colors.textSecondary },
          ]}
        >
          {I18n.t("convertedToAllUnits", {
            defaultValue: "Пересчёт по всем единицам",
          })}
        </Text>

        <View
          style={[
            styles.card,
            styles.listCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {converted.map((row) => {
            const active = row.key === kUnit;
            return (
              <View
                key={row.key}
                style={[
                  styles.convertRow,
                  {
                    borderBottomColor: theme.colors.border,
                    backgroundColor: active
                      ? theme.colors.primaryWash
                      : "transparent",
                  },
                ]}
              >
                <Text style={[type.body, { color: theme.colors.text }]}>
                  {I18n.t(row.labelKey)}
                </Text>
                <Text
                  style={[styles.convertValue, { color: theme.colors.text }]}
                >
                  {formatValue(row.value)}
                </Text>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  return renderFiltration();
}
