/**
 * Вкладка «Оценка по Q/s»
 *
 * Упрощённая вкладка «Проводимость» диалога «Оценка параметров» настольного
 * АНСДИМАТ: по дебиту и понижению в опытной скважине — водопроводимость
 * напорного пласта или коэффициент фильтрации безнапорного.
 *
 * Сверху выбирается тип пласта и тумблер несовершенной скважины, под ними —
 * разрез с окошками ввода на своих местах, как в настольном окне. По
 * умолчанию на разрезе два окошка — Q и sw: напорный пласт и совершенная
 * скважина покрывают большинство полевых оценок. Мощность появляется у
 * безнапорного пласта, окошки фильтра — тумблером.
 *
 * Размерность расхода выбирается у подписи Q, а не в общих настройках: дебит
 * берут из журнала в тех единицах, в которых его записали. При смене единицы
 * число в окошке остаётся как набрано и читается в новой — сначала выбирают
 * размерность, потом вводят. Длины — в метрах, результат — в м²/сут и м/сут,
 * как в настольной версии.
 *
 * Значения по умолчанию — пример из справки настольной версии: открыв вкладку,
 * видно 8.133, а с тумблером 31.445 — сверка без набора.
 *
 * Математика — в [`calc/specificCapacity.js`](../../calc/specificCapacity.js),
 * разрез — в [`components/schemes/SpecificCapacityScheme.js`](../../components/schemes/SpecificCapacityScheme.js).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { FLOW_UNITS } from '../../calc/units';
import { AQUIFERS, estimateFromSpecificCapacity } from '../../calc/specificCapacity';
import AppearIn from '../../components/ui/AppearIn';
import Toggle from '../../components/ui/Toggle';
import SpecificCapacityScheme from '../../components/schemes/SpecificCapacityScheme';
import { type, spacing, fontFamily } from '../../theme';
import { Notices, OptionRow, SectionLabel, formatValue, parseNumber } from './shared';

/** Размерности расхода на вкладке — ключи из FLOW_UNITS */
export const QS_FLOW_UNITS = ['m3_day', 'm3_hour', 'l_min', 'l_sec'];

/** Ширина разреза, если экран не передал свою: телефон в 375 точек */
const DEFAULT_WIDTH = 343;

/** Значения по умолчанию — пример из справки настольной версии */
const DEFAULTS = { Q: '100', s: '15', m: '20', lw: '2', zw: '10', rw: '0.1', anisotropy: '1' };

/**
 * Переводит расход из выбранной размерности в м³/сут
 *
 * @param {number} value - число из поля
 * @param {string} unitKey - ключ размерности
 * @returns {number} расход, м³/сут
 */
function flowToBase(value, unitKey) {
  const unit = FLOW_UNITS.find((item) => item.key === unitKey);
  return unit ? value / unit.factor : NaN;
}

export default function SpecificCapacityTab({ contentWidth = DEFAULT_WIDTH }) {
  const theme = useTheme();

  const [aquifer, setAquifer] = useState(AQUIFERS.CONFINED);
  const [imperfect, setImperfect] = useState(false);
  const [qUnit, setQUnit] = useState('m3_day');
  const [values, setValues] = useState(DEFAULTS);

  const unconfined = aquifer === AQUIFERS.UNCONFINED;

  // Ряд поправки на несовершенство — до двадцати тысяч членов: пересчитывать
  // его на каждый рендер, а не на смену ввода, незачем
  const result = useMemo(
    () =>
      estimateFromSpecificCapacity({
        Q: flowToBase(parseNumber(values.Q), qUnit),
        s: parseNumber(values.s),
        aquifer,
        imperfect,
        m: parseNumber(values.m),
        lw: parseNumber(values.lw),
        zw: parseNumber(values.zw),
        rw: parseNumber(values.rw),
        anisotropy: parseNumber(values.anisotropy),
      }),
    [values, qUnit, aquifer, imperfect]
  );

  const aquifers = [
    { value: AQUIFERS.CONFINED, label: I18n.t('confined') },
    { value: AQUIFERS.UNCONFINED, label: I18n.t('unconfined') },
  ];

  const units = QS_FLOW_UNITS.map((key) => ({
    key,
    label: I18n.t(FLOW_UNITS.find((item) => item.key === key).labelKey),
  }));

  const onChange = (key, text) => setValues((prev) => ({ ...prev, [key]: text }));

  return (
    <>
      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>{I18n.t('aquiferType')}</SectionLabel>
        <OptionRow options={aquifers} value={aquifer} onChange={setAquifer} />

        <View style={[styles.switchRow, { backgroundColor: theme.colors.surfaceSunken }]}>
          <Text style={[type.body, styles.switchLabel, { color: theme.colors.text }]}>
            {I18n.t('imperfectWell')}
          </Text>
          <Toggle
            value={imperfect}
            onValueChange={setImperfect}
            accessibilityLabel={I18n.t('imperfectWell')}
          />
        </View>
      </AppearIn>

      <AppearIn index={1}>
        <View style={styles.scheme}>
          <SpecificCapacityScheme
            width={contentWidth}
            aquifer={aquifer}
            imperfect={imperfect}
            values={values}
            onChange={onChange}
            invalid={result.invalid}
            flowUnit={qUnit}
            flowUnits={units}
            onFlowUnitChange={setQUnit}
            result={{
              symbol: unconfined ? 'k' : 'T',
              value: formatValue(result.value),
              unit: unconfined ? I18n.t('unitMDay') : I18n.t('unitTransmissivity'),
            }}
            formula={{ f: Number.isFinite(result.f) ? formatValue(result.f) : null }}
          />
        </View>
        <Notices codes={result.errors} suffix="Note" tone="error" />
        <Notices codes={result.warnings} suffix="Note" />
      </AppearIn>
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  switchLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
  },
  scheme: {
    marginTop: spacing.lg,
  },
});
