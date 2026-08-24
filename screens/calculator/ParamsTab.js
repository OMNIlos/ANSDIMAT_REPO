/**
 * Вкладка «Оценка параметров»
 *
 * Обратная задача: по замеренному понижению при известном дебите оценивается
 * коэффициент фильтрации. Это первое, что делают с данными пробной откачки,
 * когда журнала ещё нет, а порядок величины нужен уже сейчас.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import { estimateConductivity, AQUIFER_TYPES } from '../../calc/aquifer';
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
  useCalcUnits,
  parseNumber,
} from './shared';

export default function ParamsTab() {
  const theme = useTheme();
  const { inFlow, inLen, inDraw, out, uFlow, uLen, uDraw, uCond } = useCalcUnits();

  const [pQ, setPQ] = useState('100');
  const [pS, setPS] = useState('15');
  const [pM, setPM] = useState('20');
  const [pR, setPR] = useState('');
  const [pR0, setPR0] = useState('');
  const [aquifer, setAquifer] = useState(AQUIFER_TYPES.UNCONFINED);
  const [imperfect, setImperfect] = useState(false);
  const [penetration, setPenetration] = useState('0.5');

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

  const aquifers = [
    { value: AQUIFER_TYPES.UNCONFINED, label: I18n.t('unconfined') },
    { value: AQUIFER_TYPES.CONFINED, label: I18n.t('confined') },
  ];

  return (
    <>
      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>
          {I18n.t('aquiferType', { defaultValue: 'Тип водоносного горизонта' })}
        </SectionLabel>
        <OptionRow options={aquifers} value={aquifer} onChange={setAquifer} />
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>{I18n.t('wellPumpingGroup', { defaultValue: 'Откачка' })}</SectionLabel>
        <Card>
          <Field label={I18n.t('flowRate')} symbol="Q" value={pQ} onChange={setPQ} unit={uFlow} />
          <Field label={I18n.t('drawdown')} symbol="s" value={pS} onChange={setPS} unit={uDraw} />
          <Field label={I18n.t('thickness')} symbol="m" value={pM} onChange={setPM} unit={uLen} />
          <Field label={I18n.t('influenceRadius')} symbol="R" value={pR} onChange={setPR} unit={uLen} />
          <Field label={I18n.t('wellRadius')} symbol="r₀" value={pR0} onChange={setPR0} unit={uLen} />
        </Card>

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
        {imperfect ? (
          <Card style={styles.spaced}>
            <Field
              label={I18n.t('penetrationRatio')}
              symbol="l/m"
              value={penetration}
              onChange={setPenetration}
            />
          </Card>
        ) : null}
      </AppearIn>

      <AppearIn index={2}>
        <ResultCard
          title={I18n.t('filtrationCoefficient')}
          label="k"
          value={out(k, QUANTITIES.CONDUCTIVITY)}
          unit={uCond}
        />
        {/* Ключи предупреждений заканчиваются на Note: подставляем окончание,
            а не приставку */}
        <Notices
          codes={warnings.filter((code) => code !== 'drawdownExceedsThickness')}
          suffix="Note"
        />
        <Notices
          codes={warnings.filter((code) => code === 'drawdownExceedsThickness')}
          suffix="Note"
          tone="error"
        />
        {formula ? (
          <Collapsible title={I18n.t('wellStatsGroup', { defaultValue: 'Подробности' })} note="ƒ">
            <Formula>{formula}</Formula>
          </Collapsible>
        ) : null}
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
