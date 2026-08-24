/**
 * Вкладка «Барраж»
 *
 * Граничные условия пласта методом отображений и подпор уровня перед
 * непроницаемым сооружением. Нужна там, где рядом с водозабором стоит стена
 * в грунте или проходит река: и то и другое меняет понижение в разы.
 */

import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import { BOUNDARY_TYPES, barrageRise, drawdownWithBoundary } from '../../calc/boundaries';
import AppearIn from '../../components/ui/AppearIn';
import {
  Card,
  Field,
  Notices,
  OptionRow,
  ResultCard,
  SectionLabel,
  useCalcUnits,
  parseNumber,
} from './shared';

export default function BarrageTab() {
  const { inFlow, inLen, inTrans, inDays, out, uFlow, uLen, uDraw, uTrans, uTime } = useCalcUnits();

  const [bQ, setBQ] = useState('1000');
  const [bT, setBT] = useState('500');
  const [bS, setBS] = useState('0.0001');
  const [bR, setBR] = useState('50');
  const [bTime, setBTime] = useState('1');
  const [bL, setBL] = useState('200');
  const [boundary, setBoundary] = useState(BOUNDARY_TYPES.BARRIER);
  const [bGradient, setBGradient] = useState('0.005');
  const [bLength, setBLength] = useState('150');

  const { s, sInfinite, effect, rImage, warnings } = drawdownWithBoundary({
    Q: inFlow(bQ),
    T: inTrans(bT),
    S: parseNumber(bS),
    r: inLen(bR),
    t: inDays(bTime),
    L: inLen(bL),
    boundary,
  });

  const { rise } = barrageRise({
    gradient: parseNumber(bGradient),
    barrierLength: inLen(bLength),
  });

  const boundaries = [
    { value: BOUNDARY_TYPES.BARRIER, label: I18n.t('boundaryBarrier') },
    { value: BOUNDARY_TYPES.RECHARGE, label: I18n.t('boundaryRecharge') },
  ];

  return (
    <>
      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>
          {I18n.t('boundaryType', { defaultValue: 'Тип границы' })}
        </SectionLabel>
        <OptionRow options={boundaries} value={boundary} onChange={setBoundary} />
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>{I18n.t('wellPumpingGroup', { defaultValue: 'Откачка' })}</SectionLabel>
        <Card>
          <Field label={I18n.t('flowRate')} symbol="Q" value={bQ} onChange={setBQ} unit={uFlow} />
          <Field label={I18n.t('transmissivity')} symbol="T" value={bT} onChange={setBT} unit={uTrans} />
          <Field label={I18n.t('storativity')} symbol="S" value={bS} onChange={setBS} />
          <Field label={I18n.t('distance')} symbol="r" value={bR} onChange={setBR} unit={uLen} />
          <Field label={I18n.t('time')} symbol="t" value={bTime} onChange={setBTime} unit={uTime} />
          <Field label={I18n.t('distanceToBoundary')} symbol="L" value={bL} onChange={setBL} unit={uLen} />
        </Card>
      </AppearIn>

      <AppearIn index={2}>
        <ResultCard
          title={I18n.t('boundaryResultTitle')}
          label="s"
          value={out(s, QUANTITIES.DRAWDOWN)}
          unit={uDraw}
          rows={[
            { label: I18n.t('withoutBoundary'), value: out(sInfinite, QUANTITIES.DRAWDOWN), unit: uDraw },
            { label: I18n.t('boundaryEffect'), value: out(effect, QUANTITIES.DRAWDOWN), unit: uDraw },
            { label: 'r′', value: out(rImage, QUANTITIES.DISTANCE), unit: uLen },
          ]}
        />
        <Notices
          codes={warnings.filter((code) => code === 'boundaryNotReached')}
          suffix="Note"
        />
        <Notices
          codes={warnings.filter((code) => code === 'observationBeyondBoundary')}
          suffix="Note"
          tone="error"
        />
      </AppearIn>

      <AppearIn index={3}>
        <SectionLabel>
          {I18n.t('barrageRiseTitle', { defaultValue: 'Подпор перед сооружением' })}
        </SectionLabel>
        <Card>
          <Field label={I18n.t('naturalGradient')} symbol="i" value={bGradient} onChange={setBGradient} />
          <Field label={I18n.t('barrierLength')} symbol="b" value={bLength} onChange={setBLength} unit={uLen} />
        </Card>
        <ResultCard
          title={I18n.t('barrageRiseShort')}
          label="ΔH"
          value={out(rise, QUANTITIES.DRAWDOWN)}
          unit={uDraw}
        />
      </AppearIn>
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
});
