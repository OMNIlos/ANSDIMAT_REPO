/**
 * Динамический разрез котлована
 *
 * Приток Q — одно число, и по нему не видно, что происходит с пластом.
 * Разрез отвечает на то, чего число не показывает: насколько глубоко сидит
 * котлован в пласте, докуда дотянулась воронка, попала ли в неё река.
 * Картинка перестраивается вместе с расчётом — меняется тип пласта, глубина
 * понижения и вылет депрессионной кривой.
 *
 * Палитра и координаты взяты из веб-калькулятора без изменений: разрез
 * должен читаться одинаково и на сайте, и в приложении. От темы приложения
 * он не зависит — на сайте она на него тоже не влияет.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Polygon,
  Rect,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';
import I18n from '../../Localization';
import {
  WIDTH,
  HEIGHT,
  PALETTE,
  pitGeometry,
  conePath,
  wallX,
} from './pitGeometry';

/** Шрифт математических обозначений: курсивная антиква, как в учебниках */
const MATH_FONT = 'Times New Roman';

/**
 * Выносной размер по вертикали
 *
 * @param {Object} props
 * @returns {React.ReactElement} засечки, линия и подпись
 */
function VerticalDimension({ x, y1, y2, label, sub }) {
  return (
    <G>
      <Path
        d={`M${x - 4} ${y1} H${x + 4} M${x} ${y1} V${y2} M${x - 4} ${y2} H${x + 4}`}
        stroke={PALETTE.ink}
        fill="none"
        strokeWidth={1.15}
      />
      <SvgText
        x={x + 10}
        y={(y1 + y2) / 2 + 5}
        fontSize={23}
        fontStyle="italic"
        fill={PALETTE.ink}
        fontFamily={MATH_FONT}
      >
        {label}
        {sub ? (
          <TSpan fontSize={15} dy={4}>
            {sub}
          </TSpan>
        ) : null}
      </SvgText>
    </G>
  );
}

/**
 * Выносной размер по горизонтали
 *
 * @param {Object} props
 * @returns {React.ReactElement} засечки, линия и подпись
 */
function HorizontalDimension({ y, x1, x2, label }) {
  return (
    <G>
      <Path
        d={`M${x1} ${y - 4} V${y + 4} M${x1} ${y} H${x2} M${x2} ${y - 4} V${y + 4}`}
        stroke={PALETTE.ink}
        fill="none"
        strokeWidth={1.15}
      />
      <SvgText
        x={(x1 + x2) / 2}
        y={y + 18}
        textAnchor="middle"
        fontSize={23}
        fontStyle="italic"
        fill={PALETTE.ink}
        fontFamily={MATH_FONT}
      >
        {label}
      </SvgText>
    </G>
  );
}

/**
 * Подпись на разрезе
 *
 * @param {Object} props
 * @returns {React.ReactElement} текст
 */
function Word({ x, y, children, anchor = 'start', fill = PALETTE.mute, size = 18 }) {
  return (
    <SvgText x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill}>
      {children}
    </SvgText>
  );
}

/**
 * Стрелка притока в котлован
 *
 * @param {Object} props
 * @returns {React.ReactElement} линия со наконечником
 */
function InflowArrow({ x, y, side }) {
  const tail = side < 0 ? x - 30 : x + 30;
  const head = side < 0 ? x + 2 : x - 2;
  const tip = side < 0 ? x + 3 : x - 3;
  const back = side < 0 ? x - 7 : x + 7;
  return (
    <G>
      <Path d={`M${tail} ${y} L${head} ${y}`} stroke={PALETTE.water} strokeWidth={1.5} />
      <Polygon
        points={`${tip},${y} ${back},${y - 4.5} ${back},${y + 4.5}`}
        fill={PALETTE.water}
      />
    </G>
  );
}

export default function PitScheme({ result, width = WIDTH, caption }) {
  const g = useMemo(() => pitGeometry(result), [result]);
  const height = (width * HEIGHT) / WIDTH;

  const layerWidth = g.x1 - g.x0;
  const pitPoints = `${g.pitTopLeft} ${g.groundY} ${g.pitTopRight} ${g.groundY} ${g.pitBottomRight} ${g.pitBottomY} ${g.pitBottomLeft} ${g.pitBottomY}`;
  const flowY = (g.groundY + g.pitBottomY) / 2 + 6;
  const lithologyX = g.x0 + 78;
  const storageX = g.river ? g.cx + g.r0px + (g.Rpx - g.r0px) * 0.42 : g.x1 - 62;
  const storageY = (g.confined ? (g.aquiferTop + g.aquiferBottom) / 2 : (g.waterLevelY + g.baseY) / 2) + 8;
  const r0End = g.cx + Math.max(g.pitBottomRight - g.cx, g.r0px);

  return (
    <View style={[styles.frame, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <Pattern
            id="pitHatch"
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(40)"
          >
            <Line x1={0} y1={0} x2={0} y2={6} stroke={PALETTE.hatch} strokeWidth={1} />
          </Pattern>
          <Pattern id="pitDots" width={8} height={8} patternUnits="userSpaceOnUse">
            <Circle cx={1.4} cy={1.4} r={0.7} fill={PALETTE.dots} />
          </Pattern>
          <Pattern id="pitTopsoil" width={10} height={6} patternUnits="userSpaceOnUse">
            <Path
              d="M0 6 L2 1 L4 6 L6 2 L8 6 L10 1 L12 6"
              fill="none"
              stroke={PALETTE.topsoil}
              strokeWidth={0.8}
            />
          </Pattern>
        </Defs>

        {g.confined ? (
          <G>
            <Rect x={g.x0} y={g.groundY} width={layerWidth} height={g.aquiferTop - g.groundY} fill={PALETTE.aquitard} />
            <Rect x={g.x0} y={g.groundY} width={layerWidth} height={g.aquiferTop - g.groundY} fill="url(#pitHatch)" opacity={0.55} />
            <Rect x={g.x0} y={g.aquiferTop} width={layerWidth} height={g.aquiferBottom - g.aquiferTop} fill={PALETTE.aquifer} />
            <Rect x={g.x0} y={g.aquiferTop} width={layerWidth} height={g.aquiferBottom - g.aquiferTop} fill="url(#pitDots)" opacity={0.7} />
            <Rect x={g.x0} y={g.aquiferBottom} width={layerWidth} height={g.baseY - g.aquiferBottom} fill={PALETTE.aquitard} />
            <Rect x={g.x0} y={g.aquiferBottom} width={layerWidth} height={g.baseY - g.aquiferBottom} fill="url(#pitHatch)" opacity={0.55} />
          </G>
        ) : (
          <G>
            <Rect x={g.x0} y={g.groundY} width={layerWidth} height={g.baseY - g.groundY} fill={PALETTE.aquifer} />
            <Rect x={g.x0} y={g.groundY} width={layerWidth} height={g.baseY - g.groundY} fill="url(#pitDots)" opacity={0.5} />
          </G>
        )}

        <Rect x={g.x0} y={g.groundY} width={layerWidth} height={7} fill="url(#pitTopsoil)" opacity={0.85} />

        <Polygon points={pitPoints} fill={PALETTE.paper} />
        <Polygon points={pitPoints} fill="none" stroke={PALETTE.ink} strokeWidth={1.85} />

        <Line x1={g.x0} y1={g.waterLevelY} x2={g.x1} y2={g.waterLevelY} stroke={PALETTE.water} strokeWidth={1.45} opacity={0.5} />
        <Polygon
          points={`${g.x1 - 24},${g.waterLevelY - 13} ${g.x1 - 8},${g.waterLevelY - 13} ${g.x1 - 16},${g.waterLevelY}`}
          fill={PALETTE.waterTri}
          stroke={PALETTE.water}
          strokeWidth={1.1}
        />

        <Path d={conePath(g, -1)} fill="none" stroke={PALETTE.water} strokeWidth={1.7} strokeDasharray="6 3.5" />
        <Path d={conePath(g, 1)} fill="none" stroke={PALETTE.water} strokeWidth={1.7} strokeDasharray="6 3.5" />

        <Line x1={g.x0} y1={g.groundY} x2={g.x1} y2={g.groundY} stroke={PALETTE.ink} strokeWidth={1.6} />
        <Line x1={g.x0} y1={g.baseY} x2={g.x1} y2={g.baseY} stroke={PALETTE.ink} strokeWidth={1.9} />

        {g.confined
          ? [g.aquiferTop, g.aquiferBottom].map((y) => (
              <G key={y}>
                <Line x1={g.x0} y1={y} x2={wallX(g, y, -1)} y2={y} stroke={PALETTE.ink} strokeWidth={1.05} />
                <Line x1={wallX(g, y, 1)} y1={y} x2={g.x1} y2={y} stroke={PALETTE.ink} strokeWidth={1.05} />
              </G>
            ))
          : null}

        {g.river ? (
          <G>
            <Rect
              x={g.riverX}
              y={g.waterLevelY}
              width={88}
              height={g.baseY - g.waterLevelY}
              fill={PALETTE.waterFill}
              stroke={PALETTE.water}
              strokeWidth={1.2}
            />
            <Path
              d={`M${g.riverX} ${g.waterLevelY} q 11 5 22 0 q 11 -5 22 0 q 11 5 22 0 q 11 -5 22 0`}
              fill="none"
              stroke={PALETTE.water}
              strokeWidth={1.7}
            />
            <Word x={g.riverX + 44} y={g.waterLevelY - 10} anchor="middle" fill={PALETTE.water} size={19}>
              {I18n.t('schemeRiver')}
            </Word>
          </G>
        ) : null}

        <InflowArrow x={g.pitTopLeft} y={flowY} side={-1} />
        <InflowArrow x={g.pitTopRight} y={flowY} side={1} />
        <SvgText
          x={g.pitTopLeft - 38}
          y={flowY - 7}
          fontSize={23}
          fontStyle="italic"
          fill={PALETTE.ink}
          fontFamily={MATH_FONT}
        >
          Q
        </SvgText>

        <Line
          x1={g.cx}
          y1={g.groundY - 4}
          x2={g.cx}
          y2={g.baseY + 40}
          stroke={PALETTE.mute}
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        <VerticalDimension x={g.cx + 8} y1={g.waterLevelY} y2={g.pitBottomY} label="s" />
        <Word x={g.cx + 28} y={(g.waterLevelY + g.pitBottomY) / 2 + 18} size={16}>
          {I18n.t('schemeDrawdownWord')}
        </Word>

        {g.confined ? (
          <VerticalDimension x={g.x0 + 16} y1={g.aquiferTop} y2={g.aquiferBottom} label="m" />
        ) : (
          <VerticalDimension x={g.x0 + 16} y1={g.waterLevelY} y2={g.baseY} label="h₀" />
        )}

        <SvgText x={storageX} y={storageY} fontSize={21} fontStyle="italic" fill={PALETTE.ink} fontFamily={MATH_FONT}>
          k
        </SvgText>
        <SvgText x={storageX + 22} y={storageY} fontSize={21} fontStyle="italic" fill={PALETTE.ink} fontFamily={MATH_FONT}>
          S
          {g.confined ? null : (
            <TSpan fontSize={15} dy={4}>
              y
            </TSpan>
          )}
        </SvgText>

        <Word x={g.x0 + 8} y={g.waterLevelY - 8} fill={PALETTE.water} size={18}>
          {I18n.t(g.confined ? 'schemeInitialHead' : 'schemeInitialGwl')}
        </Word>
        <Word x={(g.pitBottomLeft + g.pitBottomRight) / 2} y={g.pitBottomY + 16} anchor="middle" fill={PALETTE.ink}>
          {I18n.t('schemeFloor')}
        </Word>
        <Word x={g.pitTopLeft - 4} y={g.groundY - 8} anchor="end" size={16}>
          {I18n.t('schemeCrest')}
        </Word>

        {g.confined ? (
          <G>
            <Word x={lithologyX} y={(g.groundY + g.aquiferTop) / 2 + 5}>{I18n.t('schemeClay')}</Word>
            <Word x={lithologyX} y={(g.aquiferTop + g.aquiferBottom) / 2 + 5}>{I18n.t('schemeSand')}</Word>
            <Word x={lithologyX} y={(g.aquiferBottom + g.baseY) / 2 + 5}>{I18n.t('schemeClay')}</Word>
          </G>
        ) : (
          <Word x={lithologyX} y={(g.waterLevelY + g.baseY) / 2 + 4}>{I18n.t('schemeSand')}</Word>
        )}

        <HorizontalDimension y={g.baseY + 16} x1={g.cx} x2={r0End} label="r₀" />
        <HorizontalDimension
          y={g.baseY + 40}
          x1={g.cx}
          x2={g.river ? g.riverX : g.cx + g.Rpx}
          label={g.river ? 'L' : 'R'}
        />

        {caption ? (
          <Word x={g.x0} y={HEIGHT - 8} size={17}>
            {caption}
          </Word>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Разрез живёт на своей светлой подложке: палитра у него неизменная,
  // и в тёмной теме приложения он читается как вклеенный чертёж
  frame: {
    backgroundColor: PALETTE.paper,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
