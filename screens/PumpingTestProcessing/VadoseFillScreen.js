/**
 * Налив в шурф в зону аэрации
 *
 * Опыт ставят выше уровня грунтовых вод: в шурф доливают воду, удерживая в
 * нём постоянный слой около 10 см, и замеряют расход, который на это уходит.
 * Журнала «время — понижение» здесь нет — расчёт идёт по одной формуле
 * Биндемана, — поэтому и экран собран как форма, а не как таблица с графиком.
 *
 * Расход задаётся двумя способами: замеренным напрямую или налитым объёмом за
 * интервал времени. Оба поля стоят рядом, и видно, какое из них ушло в
 * расчёт: заданный напрямую расход важнее, см. calc/vadoseFill.js.
 *
 * Математика — в [`calc/vadoseFill.js`](../../calc/vadoseFill.js).
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import I18n from '../../Localization';
import AppearIn from '../../components/ui/AppearIn';
import { QUANTITIES } from '../../calc/units';
import {
  CAPILLARY_LITHOLOGY,
  VADOSE_METHODS,
  capillaryRise,
  processVadoseFill,
} from '../../calc/vadoseFill';
import { OFR_TYPES } from '../../db/schema';
import {
  Card,
  Collapsible,
  Field,
  Formula,
  Note,
  Notices,
  OptionRow,
  PresetRow,
  ResultCard,
  SectionLabel,
  useCalcUnits,
} from '../calculator/shared';
import OfrTestShell, { useOfrParams, useParamFields } from './OfrTestShell';

export default function VadoseFillScreen({ route }) {
  const projectId = route?.params?.projectId;
  const { project, params, setParams, loading } = useOfrParams(
    projectId,
    OFR_TYPES.VADOSE
  );
  const { out, uCond, uVol, uTime, uFlow, uArea, uLen, fromBase, toBase } =
    useCalcUnits();
  const { text, change } = useParamFields(params, setParams, fromBase, toBase);

  const result = useMemo(
    () => processVadoseFill(params ?? {}),
    [params]
  );

  // Что мешает расчёту. Порядок — от главного к частному: без глубины
  // просачивания формула не работает вовсе, без площади и расхода тоже,
  // но глубину чаще всего и забывают
  const problems = [];
  // Глубина просачивания нужна только Биндеману: у Болдырева её в формуле
  // нет вовсе, и требовать её значило бы гасить рабочий расчёт
  if (result.method === VADOSE_METHODS.BINDEMAN && !(params?.depth > 0)) {
    problems.push('vadoseNeedDepth');
  }
  if (!(params?.area > 0)) problems.push('vadoseNeedArea');
  if (!(result.flow > 0)) problems.push('vadoseNeedFlow');

  // Расход посчитан из объёма, а не задан руками: подписью под полем видно,
  // какое из двух чисел ушло в расчёт
  const flowComputed = !(params?.flow > 0) && result.flow > 0;

  const bindeman = result.method === VADOSE_METHODS.BINDEMAN;

  /**
   * Подставляет капиллярное поднятие выбранной породы
   *
   * @param {string} id - идентификатор породы справочника
   */
  const pickLithology = (id) => {
    const entry = CAPILLARY_LITHOLOGY.find((item) => item.id === id);
    if (!entry) return;
    setParams((previous) => ({
      ...previous,
      capillary: capillaryRise(entry),
      lithologyId: id,
      // Выбор породы включает учёт капиллярных сил: иначе подставленное
      // число не участвовало бы в расчёте и выглядело бы сломанным
      useCapillary: true,
    }));
  };

  return (
    <OfrTestShell
      title="vadoseTitle"
      subtitle="vadoseSubtitle"
      name={project?.name}
      loading={loading}
    >
      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>
          {I18n.t('vadoseFlow')}
        </SectionLabel>
        <Card>
          <Field
            label={I18n.t('vadoseVolume')}
            symbol="ΔV"
            unit={uVol}
            value={text('volume', QUANTITIES.VOLUME)}
            onChange={change('volume', QUANTITIES.VOLUME)}
          />
          <Field
            label={I18n.t('vadoseInterval')}
            symbol="Δt"
            unit={uTime}
            value={text('interval', QUANTITIES.TIME)}
            onChange={change('interval', QUANTITIES.TIME)}
          />
          <Field
            label={I18n.t('vadoseFlow')}
            symbol="Q"
            unit={uFlow}
            value={text('flow', QUANTITIES.FLOW)}
            onChange={change('flow', QUANTITIES.FLOW)}
            hint={
              flowComputed
                ? `${I18n.t('vadoseFlowComputed')}: ${out(result.flow, QUANTITIES.FLOW)}`
                : undefined
            }
          />
        </Card>
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>{I18n.t('vadosePitSection')}</SectionLabel>
        <Card>
          <Field
            label={I18n.t('vadoseArea')}
            symbol="F"
            unit={uArea}
            value={text('area', QUANTITIES.AREA)}
            onChange={change('area', QUANTITIES.AREA)}
            error={!(params?.area > 0)}
          />
          {/* Слой воды и глубина просачивания входят только в формулу
              Биндемана: у Болдырева их нет, и держать их на экране значило
              бы обещать, что они на что-то влияют */}
          {bindeman ? (
            <>
              <Field
                label={I18n.t('vadoseHead')}
                symbol="H"
                unit={uLen}
                value={text('head', QUANTITIES.DISTANCE)}
                onChange={change('head', QUANTITIES.DISTANCE)}
              />
              <Field
                label={I18n.t('vadoseDepth')}
                symbol="z"
                unit={uLen}
                value={text('depth', QUANTITIES.DISTANCE)}
                onChange={change('depth', QUANTITIES.DISTANCE)}
                error={!(params?.depth > 0)}
              />
            </>
          ) : null}
        </Card>
        <Note>{I18n.t('vadoseAreaNote')}</Note>
        <Note>{I18n.t('vadoseHeadNote')}</Note>
      </AppearIn>

      <AppearIn index={2}>
        <SectionLabel>{I18n.t('vadoseMethodName')}</SectionLabel>
        {/* Учёт капиллярных сил — не поправка, а выбор метода: с ним считают
            по Биндеману (13.69), без него по Болдыреву (13.68), где нет ни
            слоя воды, ни глубины просачивания */}
        <OptionRow
          value={params?.useCapillary !== false}
          onChange={(value) =>
            setParams((previous) => ({ ...previous, useCapillary: value }))
          }
          options={[
            { value: true, label: I18n.t('vadoseMethodBindemanName') },
            {
              value: false,
              label: I18n.t('vadoseMethodBoldyrevName'),
            },
          ]}
        />
        {bindeman ? (
          <>
            <Card>
              <Field
                label={I18n.t('vadoseCapillary')}
                symbol="h_c"
                unit={uLen}
                value={text('capillary', QUANTITIES.DISTANCE)}
                onChange={change('capillary', QUANTITIES.DISTANCE)}
              />
            </Card>
            <PresetRow
              options={CAPILLARY_LITHOLOGY.map((entry) => ({
                value: entry.id,
                label: I18n.t(entry.labelKey),
              }))}
              onPick={pickLithology}
            />
            <Note>{I18n.t('vadoseLithologyHint')}</Note>
          </>
        ) : (
          <Note>{I18n.t('vadoseCapillaryNote')}</Note>
        )}
      </AppearIn>

      <AppearIn index={3}>
        <Notices codes={problems} tone="error" />
        <ResultCard
          title={I18n.t('quantityConductivity')}
          label="k"
          value={out(result.k, QUANTITIES.CONDUCTIVITY)}
          unit={uCond}
          rows={[
            {
              label: I18n.t('vadoseFlow'),
              value: out(result.flow, QUANTITIES.FLOW),
              unit: uFlow,
            },
            ...(result.method === VADOSE_METHODS.BINDEMAN
              ? [
                  {
                    label: I18n.t('vadoseCapillary'),
                    value: out(result.capillary, QUANTITIES.DISTANCE),
                    unit: uLen,
                  },
                ]
              : []),
          ]}
        />

        <Collapsible title={I18n.t('ofrMethodTitle')} note="ƒ">
          <Formula>
            {result.method === VADOSE_METHODS.BINDEMAN
              ? I18n.t('vadoseMethod')
              : I18n.t('vadoseMethodBoldyrev')}
          </Formula>
          <Note>{I18n.t('vadoseCapillaryNote')}</Note>
        </Collapsible>
      </AppearIn>
    </OfrTestShell>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
});
