/**
 * Вкладка «Инфильтрационные утечки»
 *
 * Пласт с перетеканием, решение Хантуша–Джейкоба. Отвечает на вопрос, сколько
 * воды приходит сверху через слабопроницаемый слой: за счёт этого притока
 * понижение выходит на стационар вместо того, чтобы расти бесконечно.
 */

import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import {
  leakageFactor,
  leakageRate,
  leakyDrawdown,
  steadyLeakyDrawdown,
} from '../../calc/leakage';
import AppearIn from '../../components/ui/AppearIn';
import {
  Card,
  Collapsible,
  Field,
  Formula,
  ResultCard,
  SectionLabel,
  useCalcUnits,
  parseNumber,
  formatValue,
} from './shared';

export default function LeakageTab() {
  const { inFlow, inLen, inArea, inTrans, inCond, inDays, out, uFlow, uLen, uDraw, uTrans, uCond, uArea, uTime } =
    useCalcUnits();

  const [lQ, setLQ] = useState('1000');
  const [lT, setLT] = useState('500');
  const [lS, setLS] = useState('0.0001');
  const [lR, setLR] = useState('50');
  const [lTime, setLTime] = useState('1');
  const [lThickness, setLThickness] = useState('5');
  const [lK, setLK] = useState('0.01');
  const [lArea, setLArea] = useState('10000');

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
  const { rate, total, formula: rateFormula } = leakageRate({
    s,
    aquitardThickness,
    aquitardK,
    area: inArea(lArea),
  });

  return (
    <>
      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>
          {I18n.t('wellPumpingGroup', { defaultValue: 'Откачка' })}
        </SectionLabel>
        <Card>
          <Field label={I18n.t('flowRate')} symbol="Q" value={lQ} onChange={setLQ} unit={uFlow} />
          <Field label={I18n.t('transmissivity')} symbol="T" value={lT} onChange={setLT} unit={uTrans} />
          <Field label={I18n.t('storativity')} symbol="S" value={lS} onChange={setLS} />
          <Field label={I18n.t('distance')} symbol="r" value={lR} onChange={setLR} unit={uLen} />
          <Field label={I18n.t('time')} symbol="t" value={lTime} onChange={setLTime} unit={uTime} />
        </Card>
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>
          {I18n.t('aquitardGroup', { defaultValue: 'Слабопроницаемый слой' })}
        </SectionLabel>
        <Card>
          <Field label={I18n.t('aquitardThickness')} symbol="m′" value={lThickness} onChange={setLThickness} unit={uLen} />
          <Field label={I18n.t('aquitardK')} symbol="k′" value={lK} onChange={setLK} unit={uCond} />
          <Field label={I18n.t('leakageArea')} symbol="F" value={lArea} onChange={setLArea} unit={uArea} />
        </Card>
      </AppearIn>

      <AppearIn index={2}>
        <ResultCard
          title={I18n.t('drawdown')}
          label="s"
          value={out(s, QUANTITIES.DRAWDOWN)}
          unit={uDraw}
          rows={[
            { label: I18n.t('steadyDrawdown'), value: out(steady.s, QUANTITIES.DRAWDOWN), unit: uDraw },
            { label: I18n.t('leakageTotal'), value: out(total, QUANTITIES.FLOW), unit: uFlow },
          ]}
        />

        <Collapsible title={I18n.t('wellStatsGroup', { defaultValue: 'Подробности' })} note="ƒ">
          <Formula>
            {`s = Q / (4π·T) · W(u, r/B)\nB = ${out(B, QUANTITIES.DISTANCE)} ${uLen} · r/B = ${formatValue(beta)} · W = ${formatValue(W)}\n${rateFormula}\nw = ${out(rate, QUANTITIES.CONDUCTIVITY)} ${uCond}`}
          </Formula>
        </Collapsible>
      </AppearIn>
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
});
