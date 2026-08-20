/**
 * Вкладка «Инфильтрационные утечки»
 *
 * Пласт с перетеканием, решение Хантуша–Джейкоба. Отвечает на вопрос, сколько
 * воды приходит сверху через слабопроницаемый слой: за счёт этого притока
 * понижение выходит на стационар вместо того, чтобы расти бесконечно.
 */

import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import {
  leakageFactor,
  leakageRate,
  leakyDrawdown,
  steadyLeakyDrawdown,
} from '../../calc/leakage';
import { type, elevation, spacing } from '../../theme';
import { Field, ResultCard, useCalcUnits, parseNumber, formatValue, styles } from './shared';

export default function LeakageTab() {
  const theme = useTheme();
  const { inFlow, inLen, inDraw, inTrans, inCond, inDays, out, uFlow, uLen, uDraw, uTrans, uCond, uTime } =
    useCalcUnits();

  const [lQ, setLQ] = useState('1000');
  const [lT, setLT] = useState('500');
  const [lS, setLS] = useState('0.0001');
  const [lR, setLR] = useState('50');
  const [lTime, setLTime] = useState('1');
  const [lThickness, setLThickness] = useState('5');
  const [lK, setLK] = useState('0.01');
  const [lArea, setLArea] = useState('10000');

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

  const renderLeakage = () => {
    const T = inTrans(lT);
    const aquitardThickness = inLen(lThickness);
    const aquitardK = inCond(lK);

    const B = leakageFactor({ T, aquitardThickness, aquitardK });
    const { s, beta, W } = leakyDrawdown({
      Q: inFlow(lQ),
      T,
      S: parseNumber(lS),
      r: inLen(lR),
      t: inDays(lTime),
      B,
    });
    const steady = steadyLeakyDrawdown({ Q: inFlow(lQ), T, r: inLen(lR), B });
    const {
      rate,
      total,
      formula: rateFormula,
    } = leakageRate({
      s,
      aquitardThickness,
      aquitardK,
      area: parseNumber(lArea),
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
          {renderField(I18n.t("flowRate"), lQ, setLQ, uFlow)}
          {renderField(
            I18n.t("transmissivity", { defaultValue: "Водопроводимость T" }),
            lT,
            setLT,
            uTrans,
          )}
          {renderField(
            I18n.t("storativity", { defaultValue: "Водоотдача S" }),
            lS,
            setLS,
            "",
          )}
          {renderField(
            I18n.t("distance", { defaultValue: "Расстояние r" }),
            lR,
            setLR,
            uLen,
          )}
          {renderField(I18n.t("time"), lTime, setLTime, uTime)}
          {renderField(
            I18n.t("aquitardThickness", {
              defaultValue: "Мощность слабопроницаемого слоя m′",
            }),
            lThickness,
            setLThickness,
            uLen,
          )}
          {renderField(
            I18n.t("aquitardK", { defaultValue: "Коэф. фильтрации слоя k′" }),
            lK,
            setLK,
            uCond,
          )}
        </View>

        {renderResult(
          "s",
          out(s, QUANTITIES.DRAWDOWN),
          uDraw,
          "s = Q/(4π·T) · W(u, r/B)",
        )}

        <View style={styles.auxRow}>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            B = {out(B, QUANTITIES.DISTANCE)} {uLen}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            r/B = {formatValue(beta)}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            W(u, r/B) = {formatValue(W)}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t("steadyDrawdown", { defaultValue: "Стационар" })} ={" "}
            {out(steady.s, QUANTITIES.DRAWDOWN)} {uDraw}
          </Text>
        </View>

        {/* Расход перетекания */}
        <Text
          style={[
            type.eyebrow,
            styles.sectionLabel,
            { color: theme.colors.textSecondary },
          ]}
        >
          {I18n.t("leakageVolumeTitle", { defaultValue: "Расход перетекания" })}
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
            I18n.t("leakageArea", { defaultValue: "Площадь F" }),
            lArea,
            setLArea,
            "м²",
          )}
        </View>

        {renderResult(
          "w",
          out(rate, QUANTITIES.CONDUCTIVITY),
          uCond,
          rateFormula,
        )}

        <View style={styles.auxRow}>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t("leakageTotal", { defaultValue: "Расход по площади" })} ={" "}
            {out(total, QUANTITIES.FLOW)} {uFlow}
          </Text>
        </View>
      </>
    );
  };

  return renderLeakage();
}
