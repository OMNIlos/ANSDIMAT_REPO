/**
 * Схема «Оценки по Q/s» с окошками ввода
 *
 * Разрез окна «Оценка параметров» настольного АНСДИМАТ, переложенный под
 * вертикальный экран: скважина в пласте, воронка депрессии, окошки Q, sw, m,
 * lw, zw, rw и kz/kr стоят на тех местах разреза, к которым относятся.
 * Результат — жёлтое окошко на схеме, как в настольной версии, формула рядом.
 *
 * Схема ничего не считает. Она рисует разрез по разметке
 * (`specificCapacityLayout.js`) и сообщает наружу, что набрано и какая
 * единица расхода выбрана.
 *
 * Палитра чертежа своя и от темы не зависит — как у схем «Расчёта понижения»
 * и «Котлована»: в тёмной теме разрез читается вклеенной страницей.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Platform, StyleSheet } from 'react-native';
import Svg, { Defs, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import I18n from '../../Localization';
import { AQUIFERS } from '../../calc/specificCapacity';
import { fontFamily, radius } from '../../theme';
import {
  QS_BOX_HEIGHT,
  QS_LABEL_HEIGHT,
  QS_PALETTE as P,
  specificCapacityLayout,
} from './specificCapacityLayout';

/** Курсивная антиква для формул: как в учебниках и в настольной версии */
const MATH_FONT = Platform.select({ ios: 'Times New Roman', android: 'serif', default: 'serif' });

/** Рамка поля: обычная, в фокусе и с ошибкой */
const BORDER = { idle: P.boxBorder, focus: '#72002F', error: '#c0392b' };

/**
 * Окошко ввода на схеме
 *
 * @param {Object} props
 * @param {string} props.id - ключ поля
 * @param {Object} props.slot - место окошка из разметки
 * @param {React.ReactNode} props.label - подпись над окошком
 * @param {string} props.value - набранный текст
 * @param {Function} props.onChange - (ключ, текст)
 * @param {boolean} props.invalid - значение мешает расчёту
 * @param {string} props.accessibilityLabel - полное название поля
 * @returns {React.ReactElement} окошко
 */
function SchemeInput({ id, slot, label, value, onChange, invalid, accessibilityLabel }) {
  const [focused, setFocused] = useState(false);
  const borderColor = invalid ? BORDER.error : focused ? BORDER.focus : BORDER.idle;

  return (
    <View style={[styles.slot, { left: slot.x, top: slot.y, width: slot.w }]}>
      <View style={styles.labelRow}>{label}</View>
      <TextInput
        testID={`qs-${id}`}
        value={value}
        onChangeText={(text) => onChange(id, text)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder="—"
        placeholderTextColor={P.muted}
        selectionColor={BORDER.focus}
        underlineColorAndroid="transparent"
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { borderColor }]}
      />
    </View>
  );
}

/**
 * Дробь: числитель над знаменателем
 *
 * @param {Object} props
 * @returns {React.ReactElement} дробь
 */
function Fraction({ top, bottom }) {
  return (
    <View style={styles.fraction}>
      <Text style={styles.math}>{top}</Text>
      <View style={styles.fractionBar} />
      <Text style={styles.math}>{bottom}</Text>
    </View>
  );
}

/**
 * Расчётная формула в том виде, в каком она стоит в настольной версии
 *
 * @param {Object} props
 * @param {boolean} props.unconfined - безнапорный пласт
 * @param {boolean} props.imperfect - несовершенная скважина
 * @param {string|null} props.f - поправка на несовершенство
 * @returns {React.ReactElement} формула
 */
function FormulaView({ unconfined, imperfect, f }) {
  let body;
  if (unconfined) {
    body = imperfect ? (
      <>
        <Text style={styles.math}>k =</Text>
        <Fraction top="Q" bottom="sw(2m − sw)" />
        <Text style={styles.math}>· (2.43 + f/2π)</Text>
      </>
    ) : (
      <>
        <Text style={styles.math}>k =</Text>
        <Fraction top="2.43 · Q" bottom="sw(2m − sw)" />
      </>
    );
  } else {
    body = (
      <>
        <Text style={styles.math}>{imperfect ? 'T = (1.22 + f/4π) ·' : 'T = 1.22 ·'}</Text>
        <Fraction top="Q" bottom="sw" />
      </>
    );
  }

  return (
    <View style={styles.formula}>
      <View style={styles.formulaRow}>{body}</View>
      {imperfect && f ? <Text style={styles.math}>{`f = ${f}`}</Text> : null}
    </View>
  );
}

/**
 * Подпись окошка: обозначение и размерность
 *
 * @param {string} text - подпись
 * @returns {React.ReactElement} подпись
 */
const plainLabel = (text) => (
  <Text style={styles.label} numberOfLines={1}>
    {text}
  </Text>
);

/**
 * @param {Object} props
 * @param {number} props.width - ширина полотна, px
 * @param {string} props.aquifer - AQUIFERS.CONFINED | AQUIFERS.UNCONFINED
 * @param {boolean} props.imperfect - несовершенная скважина
 * @param {Object} props.values - набранный текст по ключам Q, s, m, lw, zw, rw, anisotropy
 * @param {Function} props.onChange - (ключ, текст)
 * @param {string[]} props.invalid - ключи полей с ошибкой
 * @param {string} props.flowUnit - ключ выбранной единицы расхода
 * @param {Array<{key: string, label: string}>} props.flowUnits - единицы на выбор
 * @param {Function} props.onFlowUnitChange - (ключ единицы)
 * @param {{symbol: string, value: string, unit: string}} props.result - результат
 * @param {{f: string|null}} props.formula - поправка f для формулы
 * @returns {React.ReactElement} схема
 */
export default function SpecificCapacityScheme({
  width,
  aquifer,
  imperfect,
  values,
  onChange,
  invalid,
  flowUnit,
  flowUnits,
  onFlowUnitChange,
  result,
  formula,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const layout = specificCapacityLayout({ width, aquifer, imperfect });

  // Меню единиц висит над разрезом и закрывается нажатием мимо него — но
  // переключатели пласта и скважины стоят выше разреза. Разрез под ними
  // перестраивается, и меню осталось бы висеть над чужими окошками
  useEffect(() => {
    setMenuOpen(false);
  }, [aquifer, imperfect]);
  const { slots, levels, roof, ground, floor, well, cone, dims } = layout;
  const unconfined = aquifer === AQUIFERS.UNCONFINED;

  const meters = I18n.t('unitMeters');
  const unitLabel = flowUnits.find((unit) => unit.key === flowUnit)?.label ?? '';
  const wellCenter = well.x + well.w / 2;

  const fields = [
    { id: 'Q', name: I18n.t('flowRate') },
    { id: 's', name: I18n.t('qsWellDrawdown'), label: `sw, ${meters}` },
    {
      id: 'm',
      name: I18n.t(unconfined ? 'qsSaturatedThickness' : 'thickness'),
      label: `m, ${meters}`,
    },
    { id: 'zw', name: I18n.t('qsFilterMiddle'), label: `zw, ${meters}` },
    { id: 'rw', name: I18n.t('wellRadius'), label: `rw, ${meters}` },
    { id: 'anisotropy', name: I18n.t('qsAnisotropy'), label: 'kz / kr' },
    { id: 'lw', name: I18n.t('qsFilterLength'), label: `lw, ${meters}` },
  ].filter((field) => slots[field.id]);

  // Единица расхода выбирается у самой подписи Q, как в настольной версии
  // размерность стоит в подписи окошка
  const flowLabel = (
    <Pressable
      onPress={() => setMenuOpen((open) => !open)}
      accessibilityRole="button"
      accessibilityLabel={I18n.t('qsFlowUnits')}
      accessibilityState={{ expanded: menuOpen }}
      hitSlop={8}
      style={styles.unitButton}
    >
      <Text style={styles.label} numberOfLines={1}>
        {`Q, ${unitLabel}`}
        <Text style={styles.unitCaret}> ▾</Text>
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.frame, { width, height: layout.height }]}>
      <Svg width={width} height={layout.height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="qsHatch"
            width={7}
            height={7}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Line x1={0} y1={0} x2={0} y2={7} stroke={P.hatch} strokeWidth={1.2} />
          </Pattern>
          <Pattern id="qsScreen" width={6} height={6} patternUnits="userSpaceOnUse">
            <Path d="M0 0 L6 6 M6 0 L0 6" stroke={P.steel} strokeWidth={0.8} />
          </Pattern>
        </Defs>

        <Rect x={0} y={0} width={width} height={layout.height} fill={P.paper} />

        {/* Пласт, кровля, подошва */}
        <Rect
          x={0}
          y={layout.aquifer.fillTop}
          width={width}
          height={floor.top - layout.aquifer.fillTop}
          fill={P.aquifer}
        />
        {roof ? (
          <>
            <Rect x={0} y={roof.top} width={width} height={roof.bottom - roof.top} fill="url(#qsHatch)" />
            <Line x1={0} y1={roof.bottom} x2={width} y2={roof.bottom} stroke={P.line} strokeWidth={2} />
          </>
        ) : null}
        {ground != null ? (
          <Line x1={0} y1={ground} x2={width} y2={ground} stroke={P.line} strokeWidth={2} />
        ) : null}
        <Rect x={0} y={floor.top} width={width} height={floor.bottom - floor.top} fill="url(#qsHatch)" />
        <Line x1={0} y1={floor.top} x2={width} y2={floor.top} stroke={P.line} strokeWidth={2} />

        {/* Статический уровень и воронка депрессии */}
        <Line
          x1={0}
          y1={levels.staticY}
          x2={width}
          y2={levels.staticY}
          stroke={P.water}
          strokeWidth={1.4}
          strokeDasharray="9 6"
        />
        <Path d={cone.left} fill="none" stroke={P.water} strokeWidth={1.4} strokeDasharray="5 4" />
        <Path d={cone.right} fill="none" stroke={P.water} strokeWidth={1.4} strokeDasharray="5 4" />

        {/* Ствол: обсадка, вода, фильтр */}
        <Rect
          x={well.x}
          y={well.casingTop}
          width={well.w}
          height={well.bottom - well.casingTop}
          fill={P.casing}
          stroke={P.steel}
          strokeWidth={1.2}
        />
        <Rect
          x={well.x + 1}
          y={levels.dynamicY}
          width={well.w - 2}
          height={well.bottom - levels.dynamicY}
          fill={P.aquifer}
        />
        <Rect
          x={well.x}
          y={well.screenTop}
          width={well.w}
          height={well.screenBottom - well.screenTop}
          fill="url(#qsScreen)"
          stroke={P.steel}
          strokeWidth={1.2}
        />
        <Line
          x1={well.x + 2}
          y1={levels.dynamicY}
          x2={well.x + well.w - 2}
          y2={levels.dynamicY}
          stroke={P.water}
          strokeWidth={1.6}
        />

        {/* Дебит — стрелка из оголовка */}
        <Line x1={wellCenter} y1={well.casingTop} x2={wellCenter} y2={well.headY + 8} stroke={P.line} strokeWidth={1.4} />
        <Polygon
          points={`${wellCenter},${well.headY} ${wellCenter - 5},${well.headY + 9} ${wellCenter + 5},${well.headY + 9}`}
          fill={P.line}
        />

        {/* Выноска понижения к уровню в стволе */}
        <Line x1={dims.sw.x1} y1={dims.sw.y1} x2={dims.sw.x2} y2={dims.sw.y2} stroke={P.line} strokeWidth={1} />

        {dims.m ? (
          <>
            <Line x1={dims.m.x} y1={dims.m.y1} x2={dims.m.x} y2={dims.m.y2} stroke={P.line} strokeWidth={1} />
            <Line x1={dims.m.x - 4} y1={dims.m.y1} x2={dims.m.x + 4} y2={dims.m.y1} stroke={P.line} strokeWidth={1} />
            <Line x1={dims.m.x - 4} y1={dims.m.y2} x2={dims.m.x + 4} y2={dims.m.y2} stroke={P.line} strokeWidth={1} />
            <Line x1={dims.m.x} y1={dims.m.connectY} x2={slots.m.x} y2={dims.m.connectY} stroke={P.line} strokeWidth={1} />
          </>
        ) : null}

        {dims.zw ? (
          <>
            <Line
              x1={dims.zw.x}
              y1={dims.zw.y1}
              x2={dims.zw.x}
              y2={dims.zw.y2}
              stroke={P.line}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Line x1={dims.zw.x} y1={dims.zw.y2} x2={well.x} y2={dims.zw.y2} stroke={P.line} strokeWidth={1} />
            <Line
              x1={slots.zw.x + slots.zw.w}
              y1={dims.zw.connectY}
              x2={dims.zw.x}
              y2={dims.zw.connectY}
              stroke={P.line}
              strokeWidth={1}
            />
          </>
        ) : null}

        {dims.lw ? (
          <>
            <Line x1={dims.lw.x} y1={dims.lw.y1} x2={dims.lw.x} y2={dims.lw.y2} stroke={P.line} strokeWidth={1} />
            <Line x1={dims.lw.x - 3} y1={dims.lw.y1} x2={dims.lw.x + 3} y2={dims.lw.y1} stroke={P.line} strokeWidth={1} />
            <Line x1={dims.lw.x - 3} y1={dims.lw.y2} x2={dims.lw.x + 3} y2={dims.lw.y2} stroke={P.line} strokeWidth={1} />
            <Line x1={dims.lw.x} y1={dims.lw.connectY} x2={slots.lw.x} y2={dims.lw.connectY} stroke={P.line} strokeWidth={1} />
          </>
        ) : null}

        {dims.rw ? (
          <>
            <Line x1={dims.rw.x1} y1={dims.rw.y} x2={dims.rw.x2 + 2} y2={dims.rw.y} stroke={P.line} strokeWidth={1} />
            <Polygon
              points={`${dims.rw.x2},${dims.rw.y} ${dims.rw.x2 + 7},${dims.rw.y - 3.5} ${dims.rw.x2 + 7},${dims.rw.y + 3.5}`}
              fill={P.line}
            />
          </>
        ) : null}
      </Svg>

      {fields.map((field) => (
        <SchemeInput
          key={field.id}
          id={field.id}
          slot={slots[field.id]}
          label={field.id === 'Q' ? flowLabel : plainLabel(field.label)}
          value={values[field.id]}
          onChange={onChange}
          invalid={invalid.includes(field.id)}
          accessibilityLabel={field.name}
        />
      ))}

      <View
        style={[styles.slot, { left: slots.result.x, top: slots.result.y, width: slots.result.w }]}
        accessible
        accessibilityLabel={`${result.symbol} ${result.value} ${result.unit}`}
      >
        {plainLabel(`${result.symbol}, ${result.unit}`)}
        <View style={styles.result}>
          <Text style={styles.resultValue} numberOfLines={1}>
            {result.value}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.slot,
          styles.formulaSlot,
          { left: slots.formula.x, top: slots.formula.y, width: slots.formula.w },
        ]}
      >
        <FormulaView unconfined={unconfined} imperfect={imperfect} f={formula?.f ?? null} />
      </View>

      {menuOpen ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View
            style={[
              styles.menu,
              { left: slots.Q.x, top: slots.Q.boxY + QS_BOX_HEIGHT + 4, width: slots.Q.w },
            ]}
          >
            {flowUnits.map((unit) => {
              const selected = unit.key === flowUnit;
              return (
                <Pressable
                  key={unit.key}
                  onPress={() => {
                    setMenuOpen(false);
                    onFlowUnitChange(unit.key);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  style={[styles.menuItem, selected ? styles.menuItemSelected : null]}
                >
                  <Text style={[styles.menuText, selected ? styles.menuTextSelected : null]}>
                    {unit.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Рамка как у схем «Расчёта понижения» и «Котлована»: без неё светлая
  // бумага чертежа растворялась на светлом фоне приложения
  frame: {
    backgroundColor: P.paper,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 7, 16, 0.12)',
    overflow: 'hidden',
  },
  slot: {
    position: 'absolute',
  },
  labelRow: {
    height: QS_LABEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: P.ink,
  },
  unitButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitCaret: {
    color: P.muted,
  },
  input: {
    height: QS_BOX_HEIGHT,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    backgroundColor: P.box,
    color: P.ink,
    fontFamily: fontFamily.mono,
    fontSize: 15,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  // Результат залит жёлтым, как в настольной версии: это единственное окошко,
  // в которое не вводят, а читают
  result: {
    height: QS_BOX_HEIGHT,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: P.resultBorder,
    backgroundColor: P.result,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  resultValue: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 16,
    color: P.ink,
  },
  formulaSlot: {
    minHeight: QS_LABEL_HEIGHT + QS_BOX_HEIGHT,
    justifyContent: 'center',
  },
  formula: {
    alignItems: 'flex-start',
    gap: 2,
  },
  formulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  math: {
    fontFamily: MATH_FONT,
    fontStyle: 'italic',
    fontSize: 15,
    color: P.ink,
  },
  fraction: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  fractionBar: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: P.ink,
    marginVertical: 1,
  },
  menu: {
    position: 'absolute',
    backgroundColor: P.box,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.boxBorder,
    paddingVertical: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  menuItemSelected: {
    backgroundColor: '#f6e9ee',
  },
  menuText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: P.ink,
  },
  menuTextSelected: {
    color: '#72002F',
    fontFamily: fontFamily.semibold,
  },
});
