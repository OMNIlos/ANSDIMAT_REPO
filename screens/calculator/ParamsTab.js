/**
 * Вкладка «Оценка параметров»
 *
 * Обратная задача: по замеренному понижению при известном дебите оценивается
 * коэффициент фильтрации. Это первое, что делают с данными пробной откачки,
 * когда журнала ещё нет, а порядок величины нужен уже сейчас.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import { estimateConductivity, AQUIFER_TYPES } from '../../calc/aquifer';
import { type, elevation, spacing } from '../../theme';
import { Field, ResultCard, useCalcUnits, parseNumber, formatValue, styles } from './shared';

export default function ParamsTab() {
  const theme = useTheme();
  const { inFlow, inLen, inDraw, inTrans, inCond, inDays, out, uFlow, uLen, uDraw, uTrans, uCond, uTime } =
    useCalcUnits();

  const [pQ, setPQ] = useState('100');
  const [pS, setPS] = useState('15');
  const [pM, setPM] = useState('20');
  const [pR, setPR] = useState('');
  const [pR0, setPR0] = useState('');
  const [aquifer, setAquifer] = useState(AQUIFER_TYPES.UNCONFINED);
  const [imperfect, setImperfect] = useState(false);
  const [penetration, setPenetration] = useState('0.5');

  /**
   * Поле ввода с подписью и единицей измерения
   *
   * @param {string} label - подпись поля
   * @param {string} value - текущее значение
   * @param {Function} onChange - обработчик правки
   * @param {string} unit - подпись размерности
   * @returns {React.ReactElement} строка формы
   */
  const renderField = (label, value, onChange, unit) => (
    <Field key={label} label={label} value={value} onChange={onChange} unit={unit} />
  );

  /**
   * Карточка результата с формулой
   *
   * @param {string} label - обозначение величины
   * @param {string} value - значение
   * @param {string} unit - подпись размерности
   * @param {string} formula - запись формулы
   * @returns {React.ReactElement} карточка результата
   */
  const renderResult = (label, value, unit, formula) => (
    <ResultCard label={label} value={value} unit={unit} formula={formula} />
  );

  const renderSegment = (options, value, onChange) => (
    <View
      style={[styles.segment, { backgroundColor: theme.colors.surfaceSunken }]}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              styles.segmentItem,
              active && { backgroundColor: theme.colors.surface },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: active
                    ? theme.colors.primaryAccent
                    : theme.colors.textSecondary,
                },
              ]}
            >
              {I18n.t(option.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  const renderParams = () => {
    const { k, formula, warnings } = estimateConductivity({
      Q: inFlow(pQ),
      s: inDraw(pS),
      m: inLen(pM),
      aquiferType: aquifer,
      R: inLen(pR),
      r0: inLen(pR0),
      imperfect,
      penetrationRatio: parseNumber(penetration),
    });

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
          {renderField(I18n.t("flowRate"), pQ, setPQ, uFlow)}
          {renderField(I18n.t("drawdown"), pS, setPS, uDraw)}
          {renderField(
            I18n.t("thickness", { defaultValue: "Мощность m" }),
            pM,
            setPM,
            uLen,
          )}
          {renderField(
            I18n.t("influenceRadius", { defaultValue: "Радиус влияния R" }),
            pR,
            setPR,
            uLen,
          )}
          {renderField(I18n.t("wellRadius"), pR0, setPR0, uLen)}

          <Text
            style={[type.body, styles.groupLabel, { color: theme.colors.text }]}
          >
            {I18n.t("aquiferType", { defaultValue: "Тип пласта" })}
          </Text>
          <View
            style={[
              styles.segment,
              { backgroundColor: theme.colors.surfaceSunken },
            ]}
          >
            {[
              { key: AQUIFER_TYPES.UNCONFINED, labelKey: "unconfined" },
              { key: AQUIFER_TYPES.CONFINED, labelKey: "confined" },
            ].map((option) => {
              const active = option.key === aquifer;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setAquifer(option.key)}
                  style={[
                    styles.segmentItem,
                    active && { backgroundColor: theme.colors.surface },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active
                          ? theme.colors.primaryAccent
                          : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {I18n.t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <Text style={[type.body, { color: theme.colors.text }]}>
              {I18n.t("imperfectWell")}
            </Text>
            <Switch
              value={imperfect}
              onValueChange={setImperfect}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>

          {imperfect &&
            renderField(
              I18n.t("penetrationRatio", { defaultValue: "Доля вскрытия l/m" }),
              penetration,
              setPenetration,
              "",
            )}
        </View>

        {renderResult("k", out(k, QUANTITIES.CONDUCTIVITY), uCond, formula)}

        {warnings.includes("defaultInfluenceRatio") && (
          <Text
            style={[
              type.caption,
              styles.warning,
              { color: theme.colors.textSecondary },
            ]}
          >
            {I18n.t("defaultInfluenceRatioNote", {
              defaultValue:
                "R и r₀ не заданы — принято отношение R/r₀ = 300. Для точного результата укажите фактические значения.",
            })}
          </Text>
        )}
        {warnings.includes("drawdownExceedsThickness") && (
          <Text
            style={[
              type.caption,
              styles.warning,
              { color: theme.colors.error },
            ]}
          >
            {I18n.t("drawdownExceedsThicknessNote", {
              defaultValue:
                "Понижение больше мощности пласта — проверьте исходные данные.",
            })}
          </Text>
        )}
      </>
    );
  };

  return renderParams();
}
