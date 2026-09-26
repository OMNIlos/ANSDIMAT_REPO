/**
 * Налив в шурф в зону аэрации
 *
 * Опыт ставят выше уровня грунтовых вод: в шурф доливают воду, удерживая в
 * нём постоянный слой около 10 см, и замеряют расход, который на это уходит.
 * Журнала «время — понижение» здесь нет — расчёт идёт по одной формуле, —
 * поэтому и экран собран как форма, а не как таблица с графиком.
 *
 * Метод стоит первым, до всех полей: от него зависит, сколько их вообще.
 * Болдыреву (13.68) хватает расхода и площади шурфа, Биндеману (13.69) нужны
 * ещё слой воды, глубина просачивания и капиллярное поднятие. Показывать
 * лишние поля значит просить заполнить то, что в расчёт не войдёт, — поэтому
 * они появляются вместе с выбором метода, а не стоят пустыми.
 *
 * Расход не набирают руками, когда есть объём и интервал: он выводится из
 * них и подставляется прямо в поле, как информационное поле «Расход (Q)» в
 * настольном АНСДИМАТ (табл. 20.23). Набранное руками важнее посчитанного —
 * так же, как в расчёте, см. calc/vadoseFill.js.
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
  const { text, change, editing, forget } = useParamFields(
    params,
    setParams,
    fromBase,
    toBase
  );

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

  /**
   * Расход, посчитанный по объёму и интервалу, стоит прямо в поле
   *
   * Пока расход не набран руками, поле показывает посчитанное число, а не
   * пустоту с подсказкой под ней: набирать то, что уже выведено из соседних
   * полей, незачем. Набранное руками важнее — очистив поле, к посчитанному
   * возвращаются.
   *
   * Незаконченный ввод посчитанное не перекрывает: иначе стёртое поле тут же
   * заполнялось бы обратно, и набрать своё число было бы нельзя.
   */
  const flowEntered = params?.flow > 0;
  const flowDerived = !flowEntered && !editing('flow') && result.flow > 0;

  /**
   * Базовое число в поле ввода: размерность пользователя, шесть значащих
   *
   * Так же, как показывает величины `text` — посчитанный расход не должен
   * отличаться от набранного руками ни форматом, ни округлением.
   *
   * @param {number} value - значение в базовой единице
   * @param {string} quantity - величина, см. QUANTITIES
   * @returns {string} текст поля
   */
  const fieldText = (value, quantity) => {
    const converted = fromBase(value, quantity);
    return isFinite(converted) ? String(Number(converted.toPrecision(6))) : '';
  };

  const bindeman = result.method === VADOSE_METHODS.BINDEMAN;

  /**
   * Подставляет капиллярное поднятие выбранной породы
   *
   * @param {string} id - идентификатор породы справочника
   */
  const pickLithology = (id) => {
    const entry = CAPILLARY_LITHOLOGY.find((item) => item.id === id);
    if (!entry) return;
    // Набранный в поле текст живёт, пока поле правят, и подставленное число
    // он бы перекрыл: геолог жмёт породу, а в поле остаётся прежнее
    forget('capillary');
    setParams((previous) => ({
      ...previous,
      capillary: capillaryRise(entry),
      lithologyId: id,
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
        {/* Метод первым: от него зависит, сколько на экране полей вообще.
            Учёт капиллярных сил — не поправка к одной и той же формуле, а
            выбор между (13.68) и (13.69), и у второй три своих величины */}
        <SectionLabel style={styles.firstLabel}>
          {I18n.t('vadoseMethodName')}
        </SectionLabel>
        <OptionRow
          value={params?.useCapillary === true}
          onChange={(value) =>
            setParams((previous) => ({ ...previous, useCapillary: value }))
          }
          options={[
            { value: false, label: I18n.t('vadoseMethodBoldyrevName') },
            { value: true, label: I18n.t('vadoseMethodBindemanName') },
          ]}
        />
        <Note>{I18n.t('vadoseCapillaryNote')}</Note>
      </AppearIn>

      <AppearIn index={1}>
        {/* Заголовок раздела — одним словом: обозначение стоит у поля ниже,
            и «РАСХОД Q» над строкой «Расход Q» читалось бы заиканием */}
        <SectionLabel>{I18n.t('quantityFlow')}</SectionLabel>
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
            value={
              flowDerived
                ? fieldText(result.flow, QUANTITIES.FLOW)
                : text('flow', QUANTITIES.FLOW)
            }
            onChange={change('flow', QUANTITIES.FLOW)}
            hint={
              flowDerived
                ? I18n.t('vadoseFlowComputed')
                : flowEntered
                  ? I18n.t('vadoseFlowManual')
                  : undefined
            }
          />
        </Card>
      </AppearIn>

      <AppearIn index={2}>
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
        {/* Про слой воды — только там, где его вносят */}
        {bindeman ? <Note>{I18n.t('vadoseHeadNote')}</Note> : null}
      </AppearIn>

      {bindeman ? (
        <AppearIn index={3}>
          <SectionLabel>{I18n.t('vadoseCapillarySection')}</SectionLabel>
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
        </AppearIn>
      ) : null}

      <AppearIn index={4}>
        <Notices codes={problems} tone="error" />
        <ResultCard
          title={I18n.t('resultConductivity')}
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

        {/* Пояснение про выбор метода стоит наверху, у самого переключателя,
            и повторять его под формулой незачем */}
        <Collapsible title={I18n.t('ofrMethodTitle')} note="ƒ">
          <Formula>
            {result.method === VADOSE_METHODS.BINDEMAN
              ? I18n.t('vadoseMethod')
              : I18n.t('vadoseMethodBoldyrev')}
          </Formula>
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
