/**
 * Типовая схема водозаборной скважины
 *
 * Поясняющий чертёж расчётной схемы: как сложен разрез, где стоят опытная и
 * наблюдательная скважины, откуда пласт получает воду. Меняется вместе с
 * выбранной схемой — Тейс, перетекание, безнапорный пласт, граница питания —
 * и подписывается текущими k и Q.
 *
 * Уровни воды в стволах чертёж показывает условно, не по расчёту: числа
 * читают в результате, а схема отвечает на другой вопрос — какую задачу мы
 * вообще решаем. Так же он устроен и в веб-калькуляторе.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';
import I18n from '../../Localization';
import { WIDTH, PALETTE, wellSchemeLayout, screenLines } from './wellSchemeLayout';

/** Шрифт математических обозначений */
const MATH_FONT = 'Times New Roman';
/** Насколько ствол опытной скважины шире наблюдательной */
const PUMPED_WIDTH = 16;
const OBSERVER_WIDTH = 8;

/**
 * Ствол скважины со столбом воды, фильтром и оголовком
 *
 * @param {Object} props
 * @returns {React.ReactElement} группа элементов ствола
 */
function Well({ well, width, step }) {
  const height = well.bottom - well.top;
  return (
    <G>
      <Rect
        x={well.x}
        y={well.top}
        width={width}
        height={height}
        fill={PALETTE.casing}
        stroke={PALETTE.steel}
        strokeWidth={1.2}
      />
      <Rect
        x={well.x + 1.2}
        y={well.waterY}
        width={width - 2.4}
        height={well.bottom - well.waterY}
        fill={PALETTE.water}
        opacity={0.55}
      />
      {screenLines(well, step).map((y) => (
        <Line
          key={y}
          x1={well.x + 1.5}
          y1={y}
          x2={well.x + width - 1.5}
          y2={y}
          stroke={PALETTE.steel}
          strokeWidth={0.8}
        />
      ))}
      <Rect
        x={well.x - 3}
        y={well.top - 6}
        width={width + 6}
        height={6}
        fill={PALETTE.steel}
      />
    </G>
  );
}

/**
 * Стрелка притока к стволу опытной скважины
 *
 * @param {Object} props
 * @returns {React.ReactElement} дуга с наконечником
 */
function FlowArrow({ cx, side, top }) {
  const from = cx + side * 28;
  const to = cx + side * 8;
  const c1 = cx + side * 18;
  const c2 = cx + side * 12;
  const y0 = top + 66;
  return (
    <G>
      <Path
        d={`M ${from} ${y0} C ${c1} ${y0 + 10}, ${c2} ${y0 + 18}, ${to} ${y0 + 28}`}
        fill="none"
        stroke={PALETTE.arrow}
        strokeWidth={1.4}
      />
      <Polygon
        points={`${to - side * 3},${y0 + 32} ${to + side * 4},${y0 + 24} ${to - side * 6},${y0 + 26}`}
        fill={PALETTE.arrow}
      />
    </G>
  );
}

/**
 * Горизонтальный размер под разрезом
 *
 * @param {Object} props
 * @returns {React.ReactElement} размерная линия с засечками и подписью
 */
function Dimension({ from, to, y, label, labelY }) {
  const [main, sub] = label.split('_');
  return (
    <G>
      <Line x1={from} y1={y} x2={to} y2={y} stroke={PALETTE.ink} strokeWidth={1} />
      <Line x1={from} y1={y - 4} x2={from} y2={y + 4} stroke={PALETTE.ink} />
      <Line x1={to} y1={y - 4} x2={to} y2={y + 4} stroke={PALETTE.ink} />
      <SvgText
        x={(from + to) / 2}
        y={labelY}
        fontSize={16}
        fontStyle="italic"
        fill={PALETTE.ink}
        textAnchor="middle"
        fontFamily={MATH_FONT}
      >
        {main}
        {sub ? (
          <TSpan fontSize={11} dy={3}>
            {sub}
          </TSpan>
        ) : null}
      </SvgText>
    </G>
  );
}

export default function WellScheme({ scheme = 'theis', width = WIDTH, caption }) {
  const layout = wellSchemeLayout(scheme);
  const height = (width * layout.height) / WIDTH;
  const { pumped, observer, thickness } = layout;
  const pumpedCenter = pumped.x + PUMPED_WIDTH / 2;
  const observerCenter = observer.x + OBSERVER_WIDTH / 2;
  const labelY = pumped.top - 8;

  return (
    <View style={[styles.frame, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 -8 ${WIDTH} ${layout.height}`}>
        {caption ? (
          <SvgText x={8} y={18} fontSize={16} fill={PALETTE.caption}>
            {caption}
          </SvgText>
        ) : null}

        {layout.layers.map((layer) => (
          <Rect key={layer.y} x={0} y={layer.y} width={WIDTH} height={layer.h} fill={layer.fill} />
        ))}

        {layout.river ? (
          <G>
            <Rect
              x={layout.river.x}
              y={layout.river.y}
              width={layout.river.w}
              height={layout.river.h}
              fill={PALETTE.river}
            />
            <Path
              d={`M${layout.river.x} ${layout.river.y} C480 20 502 32 540 24 L540 40 L${layout.river.x} 40 Z`}
              fill={PALETTE.riverCrest}
            />
            <SvgText
              x={layout.river.labelX}
              y={layout.river.labelY}
              fontSize={16}
              fill={PALETTE.riverLabel}
            >
              {I18n.t('schemeRiver')}
            </SvgText>
          </G>
        ) : null}

        <Line
          x1={8}
          y1={layout.levelY}
          x2={layout.levelRight}
          y2={layout.levelY}
          stroke={PALETTE.waterLine}
          strokeWidth={1.2}
          strokeDasharray="5 4"
        />
        <SvgText x={12} y={layout.levelY - 10} fontSize={16} fill={PALETTE.waterLabel}>
          {I18n.t(layout.levelLabel)}
        </SvgText>
        <Polygon
          points={`${layout.levelRight - 20},${layout.levelY - 10} ${layout.levelRight - 4},${layout.levelY - 10} ${layout.levelRight - 12},${layout.levelY}`}
          fill={PALETTE.waterMark}
        />

        <Path
          d={layout.curve}
          fill="none"
          stroke={PALETTE.curve}
          strokeWidth={1.7}
          strokeDasharray="6 4"
        />

        <Well well={pumped} width={PUMPED_WIDTH} step={10} />
        <Well well={observer} width={OBSERVER_WIDTH} step={12} />

        <SvgText x={pumpedCenter} y={labelY} fontSize={16} fill={PALETTE.steel} textAnchor="middle">
          {I18n.t('schemePumpedWell')}
          <TSpan dx={8} fontStyle="italic" fill={PALETTE.arrow} fontFamily={MATH_FONT}>
            Q
          </TSpan>
        </SvgText>
        <SvgText x={observerCenter} y={labelY} fontSize={16} fill={PALETTE.steel} textAnchor="middle">
          {I18n.t('schemeObsWell')}
        </SvgText>

        <FlowArrow cx={pumpedCenter} side={-1} top={pumped.top} />
        <FlowArrow cx={pumpedCenter} side={1} top={pumped.top} />

        <SvgText
          x={observer.x + 14}
          y={observer.waterY - 8}
          fontSize={16}
          fontStyle="italic"
          fill={PALETTE.ink}
          fontFamily={MATH_FONT}
        >
          s
        </SvgText>
        <SvgText x={observer.x + 26} y={observer.waterY - 6} fontSize={16} fill={PALETTE.muted}>
          {I18n.t('schemeDrawdownWord')}
        </SvgText>

        <Line
          x1={thickness.x}
          y1={thickness.y1}
          x2={thickness.x}
          y2={thickness.y2}
          stroke={PALETTE.ink}
          strokeWidth={1}
        />
        <SvgText
          x={96}
          y={thickness.labelY}
          fontSize={16}
          fontStyle="italic"
          fill={PALETTE.ink}
          fontFamily={MATH_FONT}
        >
          {thickness.label}
        </SvgText>

        {layout.labels.map((label, index) => (
          <SvgText
            key={`${label.key}-${index}`}
            x={108}
            y={label.y}
            fontSize={16}
            fill={label.key === 'schemeSand' ? PALETTE.sandLabel : PALETTE.clayLabel}
          >
            {I18n.t(label.key)}
          </SvgText>
        ))}

        <SvgText
          x={layout.storageX}
          y={layout.storageY}
          fontSize={16}
          fontStyle="italic"
          fill={PALETTE.ink}
          fontFamily={MATH_FONT}
        >
          k
        </SvgText>
        <SvgText
          x={layout.storageX + 18}
          y={layout.storageY}
          fontSize={16}
          fontStyle="italic"
          fill={PALETTE.ink}
          fontFamily={MATH_FONT}
        >
          S
          {layout.storageSub ? (
            <TSpan fontSize={11} dy={3}>
              {layout.storageSub}
            </TSpan>
          ) : null}
        </SvgText>

        {layout.dims.map((dim) => (
          <Dimension key={dim.label} {...dim} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Своя светлая подложка: палитра чертежа неизменная, и в тёмной теме он
  // читается как вклеенная страница справочника
  frame: {
    backgroundColor: '#fbfaf6',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
