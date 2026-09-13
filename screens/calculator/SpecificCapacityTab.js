/**
 * Вкладка «Оценка по Q/s»
 *
 * Упрощённая вкладка «Проводимость» диалога «Оценка параметров» настольного
 * АНСДИМАТ: по дебиту и понижению в опытной скважине — водопроводимость
 * напорного пласта или коэффициент фильтрации безнапорного.
 *
 * По умолчанию на экране два поля — Q и s: напорный пласт и совершенная
 * скважина покрывают большинство полевых оценок. Остальное появляется, только
 * когда оно нужно: мощность — у безнапорного пласта, фильтр — тумблером
 * несовершенной скважины.
 *
 * Размерность расхода выбирается прямо здесь, а не в общих настройках: дебит
 * берут из журнала в тех единицах, в которых его записали. При смене единицы
 * число в поле остаётся как набрано и читается в новой — сначала выбирают
 * размерность, потом вводят. Длины — в метрах, результат — в м²/сут и м/сут,
 * как в настольной версии.
 *
 * Значения по умолчанию — пример из справки настольной версии: открыв вкладку,
 * видно 8.133, а с тумблером 31.445 — сверка без набора.
 *
 * Математика — в [`calc/specificCapacity.js`](../../calc/specificCapacity.js).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { FLOW_UNITS } from '../../calc/units';
import { AQUIFERS, estimateFromSpecificCapacity } from '../../calc/specificCapacity';
import AppearIn from '../../components/ui/AppearIn';
import Toggle from '../../components/ui/Toggle';
import { type, spacing, fontFamily } from '../../theme';
import {
  Card,
  Collapsible,
  Field,
  Formula,
  Notices,
  OptionRow,
  ResultCard,
  SectionLabel,
  formatValue,
  parseNumber,
} from './shared';

/** Размерности расхода на вкладке — ключи из FLOW_UNITS */
export const QS_FLOW_UNITS = ['m3_day', 'm3_hour', 'l_min', 'l_sec'];

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

export default function SpecificCapacityTab() {
  const theme = useTheme();

  const [aquifer, setAquifer] = useState(AQUIFERS.CONFINED);
  const [imperfect, setImperfect] = useState(false);
  const [qUnit, setQUnit] = useState('m3_day');
  const [qText, setQText] = useState('100');
  const [sText, setSText] = useState('15');
  const [mText, setMText] = useState('20');
  const [lwText, setLwText] = useState('2');
  const [zwText, setZwText] = useState('10');
  const [rwText, setRwText] = useState('0.1');
  const [anisotropyText, setAnisotropyText] = useState('1');

  const unconfined = aquifer === AQUIFERS.UNCONFINED;

  // Ряд поправки на несовершенство — до двадцати тысяч членов: пересчитывать
  // его на каждый рендер, а не на смену ввода, незачем
  const result = useMemo(
    () =>
      estimateFromSpecificCapacity({
        Q: flowToBase(parseNumber(qText), qUnit),
        s: parseNumber(sText),
        aquifer,
        imperfect,
        m: parseNumber(mText),
        lw: parseNumber(lwText),
        zw: parseNumber(zwText),
        rw: parseNumber(rwText),
        anisotropy: parseNumber(anisotropyText),
      }),
    [qText, qUnit, sText, aquifer, imperfect, mText, lwText, zwText, rwText, anisotropyText]
  );

  const invalid = (key) => result.invalid.includes(key);
  const meters = I18n.t('unitMeters');

  const aquifers = [
    { value: AQUIFERS.CONFINED, label: I18n.t('confined') },
    { value: AQUIFERS.UNCONFINED, label: I18n.t('unconfined') },
  ];

  const units = QS_FLOW_UNITS.map((key) => ({
    value: key,
    label: I18n.t(FLOW_UNITS.find((item) => item.key === key).labelKey),
  }));
  const unitLabel = units.find((item) => item.value === qUnit)?.label;

  const thicknessField = (label) => (
    <Field
      label={label}
      symbol="m"
      value={mText}
      onChange={setMText}
      unit={meters}
      error={invalid('m')}
    />
  );

  const secondaryRows = Number.isFinite(result.secondary)
    ? [
        unconfined
          ? {
              label: 'T = k·m',
              value: formatValue(result.secondary),
              unit: I18n.t('unitTransmissivity'),
            }
          : {
              label: 'k = T/m',
              value: formatValue(result.secondary),
              unit: I18n.t('unitMDay'),
            },
      ]
    : [];

  const formula = Number.isFinite(result.f)
    ? `${result.formula}\nf = ${formatValue(result.f)}`
    : result.formula;

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
        <SectionLabel>{I18n.t('wellPumpingGroup')}</SectionLabel>
        <OptionRow options={units} value={qUnit} onChange={setQUnit} tone="data" />
        <Card style={styles.spaced}>
          <Field
            label={I18n.t('flowRate')}
            symbol="Q"
            value={qText}
            onChange={setQText}
            unit={unitLabel}
            error={invalid('Q')}
          />
          <Field
            label={I18n.t('qsWellDrawdown')}
            symbol="sw"
            value={sText}
            onChange={setSText}
            unit={meters}
            error={invalid('s')}
          />
          {unconfined ? thicknessField(I18n.t('qsSaturatedThickness')) : null}
        </Card>
      </AppearIn>

      {imperfect ? (
        <AppearIn index={2}>
          <SectionLabel>{I18n.t('qsFilterGroup')}</SectionLabel>
          <Card>
            <Field
              label={I18n.t('qsFilterLength')}
              symbol="lw"
              value={lwText}
              onChange={setLwText}
              unit={meters}
              error={invalid('lw')}
            />
            <Field
              label={I18n.t('qsFilterMiddle')}
              symbol="zw"
              value={zwText}
              onChange={setZwText}
              unit={meters}
              hint={I18n.t(unconfined ? 'qsFromLevel' : 'qsFromTop')}
              error={invalid('zw')}
            />
            <Field
              label={I18n.t('wellRadius')}
              symbol="rw"
              value={rwText}
              onChange={setRwText}
              unit={meters}
              error={invalid('rw')}
            />
            <Field
              label={I18n.t('qsAnisotropy')}
              symbol="kz/kr"
              value={anisotropyText}
              onChange={setAnisotropyText}
              error={invalid('anisotropy')}
            />
            {unconfined ? null : thicknessField(I18n.t('thickness'))}
          </Card>
        </AppearIn>
      ) : null}

      <AppearIn index={3}>
        <ResultCard
          title={unconfined ? I18n.t('filtrationCoefficient') : I18n.t('transmissivity')}
          // У безнапорного обозначение уже в названии: «Коэф. фильтрации k»
          label={unconfined ? undefined : 'T'}
          value={formatValue(result.value)}
          unit={unconfined ? I18n.t('unitMDay') : I18n.t('unitTransmissivity')}
          rows={secondaryRows}
        />
        <Notices codes={result.errors} suffix="Note" tone="error" />
        <Notices codes={result.warnings} suffix="Note" />
        <Collapsible title={I18n.t('wellStatsGroup')} note="ƒ">
          <Formula>{formula}</Formula>
        </Collapsible>
      </AppearIn>
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
  spaced: {
    marginTop: spacing.md,
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
});
