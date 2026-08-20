/**
 * Вкладка «Барраж»
 *
 * Граничные условия пласта методом отображений и подпор уровня перед
 * непроницаемым сооружением. Нужна там, где рядом с водозабором стоит стена
 * в грунте или проходит река: и то и другое меняет понижение в разы.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import { BOUNDARY_TYPES, barrageRise, drawdownWithBoundary } from '../../calc/boundaries';
import { type, elevation, spacing } from '../../theme';
import { Field, ResultCard, useCalcUnits, parseNumber, formatValue, styles } from './shared';

export default function BarrageTab() {
  const theme = useTheme();
  const { inFlow, inLen, inDraw, inTrans, inCond, inDays, out, uFlow, uLen, uDraw, uTrans, uCond, uTime } =
    useCalcUnits();

  const [bQ, setBQ] = useState('1000');
  const [bT, setBT] = useState('500');
  const [bS, setBS] = useState('0.0001');
  const [bR, setBR] = useState('50');
  const [bTime, setBTime] = useState('1');
  const [bL, setBL] = useState('200');
  const [boundary, setBoundary] = useState(BOUNDARY_TYPES.BARRIER);
  const [bGradient, setBGradient] = useState('0.005');
  const [bLength, setBLength] = useState('150');

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
  const renderBarrage = () => {
    const { s, sInfinite, effect, rImage, warnings } = drawdownWithBoundary({
      Q: inFlow(bQ),
      T: inTrans(bT),
      S: parseNumber(bS),
      r: inLen(bR),
      t: inDays(bTime),
      L: inLen(bL),
      boundary,
    });

    const { rise, formula: riseFormula } = barrageRise({
      gradient: parseNumber(bGradient),
      barrierLength: inLen(bLength),
    });

    const isBarrier = boundary === BOUNDARY_TYPES.BARRIER;

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
          {renderField(I18n.t("flowRate"), bQ, setBQ, uFlow)}
          {renderField(
            I18n.t("transmissivity", { defaultValue: "Водопроводимость T" }),
            bT,
            setBT,
            uTrans,
          )}
          {renderField(
            I18n.t("storativity", { defaultValue: "Водоотдача S" }),
            bS,
            setBS,
            "",
          )}
          {renderField(
            I18n.t("distance", { defaultValue: "Расстояние r" }),
            bR,
            setBR,
            uLen,
          )}
          {renderField(I18n.t("time"), bTime, setBTime, uTime)}
          {renderField(
            I18n.t("distanceToBoundary", {
              defaultValue: "Расстояние до границы L",
            }),
            bL,
            setBL,
            uLen,
          )}

          <Text
            style={[type.body, styles.groupLabel, { color: theme.colors.text }]}
          >
            {I18n.t("boundaryType", { defaultValue: "Тип границы" })}
          </Text>
          {renderSegment(
            [
              { key: BOUNDARY_TYPES.BARRIER, labelKey: "boundaryBarrier" },
              { key: BOUNDARY_TYPES.RECHARGE, labelKey: "boundaryRecharge" },
            ],
            boundary,
            setBoundary,
          )}
        </View>

        {renderResult(
          "s",
          out(s, QUANTITIES.DRAWDOWN),
          uDraw,
          isBarrier
            ? "s = Q/(4π·T) · [W(u) + W(u′)]"
            : "s = Q/(4π·T) · [W(u) − W(u′)]",
        )}

        <View style={styles.auxRow}>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t("withoutBoundary", { defaultValue: "Без границы" })} ={" "}
            {out(sInfinite, QUANTITIES.DRAWDOWN)} {uDraw}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t("boundaryEffect", { defaultValue: "Вклад границы" })} ={" "}
            {out(effect, QUANTITIES.DRAWDOWN)} {uDraw}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            r′ = {out(rImage, QUANTITIES.DISTANCE)} {uLen}
          </Text>
        </View>

        {warnings.includes("boundaryNotReached") && (
          <Text
            style={[
              type.caption,
              styles.warning,
              { color: theme.colors.textSecondary },
            ]}
          >
            {I18n.t("boundaryNotReachedNote", {
              defaultValue:
                "Возмущение ещё не дошло до границы — она пока не влияет на понижение.",
            })}
          </Text>
        )}
        {warnings.includes("observationBeyondBoundary") && (
          <Text
            style={[
              type.caption,
              styles.warning,
              { color: theme.colors.error },
            ]}
          >
            {I18n.t("observationBeyondBoundaryNote", {
              defaultValue:
                "Точка наблюдения оказалась за границей пласта: r должно быть меньше L.",
            })}
          </Text>
        )}

        {/* Подпор перед непроницаемым сооружением */}
        <Text
          style={[
            type.eyebrow,
            styles.sectionLabel,
            { color: theme.colors.textSecondary },
          ]}
        >
          {I18n.t("barrageRiseTitle", {
            defaultValue: "Подпор перед сооружением",
          })}
        </Text>
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
          {renderField(
            I18n.t("naturalGradient", { defaultValue: "Уклон потока i" }),
            bGradient,
            setBGradient,
            "",
          )}
          {renderField(
            I18n.t("barrierLength", { defaultValue: "Длина сооружения b" }),
            bLength,
            setBLength,
            "м",
          )}
        </View>

        {renderResult("ΔH", out(rise, QUANTITIES.DRAWDOWN), uDraw, riseFormula)}
      </>
    );
  };

  return renderBarrage();
}
