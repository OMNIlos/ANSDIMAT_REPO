/**
 * План поясов зоны санитарной охраны
 *
 * Вид сверху, а не разрез: у ЗСО важна форма в плане, и по ней сразу видно
 * главное — область захвата вытянута против течения. Круглые пояса объёмного
 * способа и капля аналитического отличаются на чертеже с одного взгляда,
 * тогда как в трёх парах чисел эта разница теряется.
 *
 * Север всегда вверх, поток развёрнут по своему азимуту: план ЗСО читают
 * вместе с картой участка, и разворачивать его под удобство рисунка нельзя.
 *
 * @param {Object} props
 * @param {Array<{key: string, contour: Array}>} props.contours - контуры поясов
 * @param {number} [props.azimuth] - азимут потока, °
 * @param {boolean} [props.showFlow] - рисовать стрелку потока
 * @param {number} [props.width] - ширина чертежа
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import I18n from '../../Localization';
import { fontFamily, radius, spacing } from '../../theme';

/** Отношение высоты чертежа к ширине */
const ASPECT = 0.74;
/** Поля вокруг контуров, доля от меньшей стороны */
const MARGIN = 0.13;

/**
 * Цвета поясов
 *
 * Палитра своя и в обеих темах одинаковая: чертёж лежит на светлой бумаге,
 * как разрезы скважины и котлована.
 */
export const BELT_COLORS = {
  first: { fill: 'rgba(114, 0, 47, 0.20)', stroke: '#72002F' },
  bacterial: { fill: 'rgba(224, 168, 60, 0.20)', stroke: '#C08420' },
  chemical: { fill: 'rgba(46, 155, 143, 0.16)', stroke: '#2E9B8F' },
};

const PALETTE = {
  paper: '#fbfaf6',
  frame: 'rgba(26, 7, 16, 0.12)',
  ink: '#555',
  muted: '#8a8884',
  ...BELT_COLORS,
  flow: '#3d8a94',
};

/**
 * Переводит точку из системы потока в экранную
 *
 * В расчёте ось x смотрит вниз по потоку. На чертеже север вверх, поэтому
 * поток разворачивается на свой азимут: 0° — на север, 90° — на восток.
 *
 * @param {{x: number, y: number}} point - точка в метрах
 * @param {number} sin - синус азимута
 * @param {number} cos - косинус азимута
 * @returns {{x: number, y: number}} точка в экранных метрах
 */
function toPlan(point, sin, cos) {
  return {
    x: point.x * sin + point.y * cos,
    y: -point.x * cos + point.y * sin,
  };
}

/**
 * Круглое число для масштабной линейки
 *
 * @param {number} value - желаемая длина, м
 * @returns {number} ближайшее круглое значение
 */
function niceScale(value) {
  if (!(value > 0)) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return step * magnitude;
}

export default function WhpaPlan({ contours, azimuth = 0, showFlow = true, width = 340 }) {
  const height = Math.round(width * ASPECT);

  const plan = useMemo(() => {
    const drawn = (contours || []).filter((belt) => belt.contour && belt.contour.length > 2);
    if (!drawn.length) return null;

    const angle = ((azimuth % 360) + 360) % 360;
    const sin = Math.sin((angle * Math.PI) / 180);
    const cos = Math.cos((angle * Math.PI) / 180);

    const rotated = drawn.map((belt) => ({
      key: belt.key,
      points: belt.contour.map((point) => toPlan(point, sin, cos)),
    }));

    const all = rotated.flatMap((belt) => belt.points);
    const minX = Math.min(...all.map((p) => p.x));
    const maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y));
    const maxY = Math.max(...all.map((p) => p.y));

    const pad = MARGIN * Math.min(width, height);
    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);
    // Один масштаб на обе оси: план ЗСО нельзя растягивать по одной стороне,
    // иначе круг первого пояса превратится в эллипс
    const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);

    const originX = width / 2 - ((minX + maxX) / 2) * scale;
    const originY = height / 2 - ((minY + maxY) / 2) * scale;
    const project = (point) => ({
      x: originX + point.x * scale,
      y: originY + point.y * scale,
    });

    return {
      // Порядок обратный: самый широкий пояс ложится первым, остальные поверх
      belts: rotated
        .slice()
        .reverse()
        .map((belt) => ({
          key: belt.key,
          d: belt.points.map((point) => project(point)),
        })),
      well: { x: originX, y: originY },
      flow: { sin, cos },
      scale,
      spanX,
    };
  }, [contours, azimuth, width, height]);

  if (!plan) {
    return (
      <View style={[styles.frame, styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>{I18n.t('whpaPlanEmpty')}</Text>
      </View>
    );
  }

  const bar = niceScale(plan.spanX / 3);
  const barPx = bar * plan.scale;
  const arrow = 26;
  const flowX = plan.flow.sin * arrow;
  const flowY = -plan.flow.cos * arrow;

  return (
    <View style={{ width }}>
      <View style={[styles.frame, { width, height }]}>
        <Svg width={width} height={height}>
          {plan.belts.map((belt) => (
            <Polygon
              key={belt.key}
              points={belt.d.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
              fill={PALETTE[belt.key].fill}
              stroke={PALETTE[belt.key].stroke}
              strokeWidth={1.2}
            />
          ))}

          {/* Скважина: точка отбора, к ней сходится всё построение */}
          <Circle cx={plan.well.x} cy={plan.well.y} r={3.5} fill={PALETTE.first.stroke} />

          {/* Направление естественного потока от скважины. Объёмный способ
              поток не учитывает вовсе, и стрелка там врала бы */}
          {showFlow ? (
          <G>
            <Line
              x1={plan.well.x - flowX}
              y1={plan.well.y - flowY}
              x2={plan.well.x + flowX}
              y2={plan.well.y + flowY}
              stroke={PALETTE.flow}
              strokeWidth={1.4}
            />
            <Path
              d={`M${plan.well.x + flowX} ${plan.well.y + flowY} l${-flowY * 0.22 - flowX * 0.22} ${flowX * 0.22 - flowY * 0.22} l${flowY * 0.44} ${-flowX * 0.44} Z`}
              fill={PALETTE.flow}
            />
            <SvgText
              x={plan.well.x + flowX * 1.5}
              y={plan.well.y + flowY * 1.5 + 4}
              fontSize={11}
              fontFamily={fontFamily.regular}
              textAnchor="middle"
              fill={PALETTE.flow}
            >
              {I18n.t('whpaFlow')}
            </SvgText>
          </G>
          ) : null}

          {/* Север: план читают вместе с картой участка */}
          <G>
            <Line
              x1={width - 20}
              y1={26}
              x2={width - 20}
              y2={10}
              stroke={PALETTE.ink}
              strokeWidth={1.2}
            />
            <Path d={`M${width - 20} 8 l-4 7 l8 0 Z`} fill={PALETTE.ink} />
            <SvgText
              x={width - 20}
              y={38}
              fontSize={11}
              fontFamily={fontFamily.semibold}
              textAnchor="middle"
              fill={PALETTE.ink}
            >
              {I18n.t('whpaNorth')}
            </SvgText>
          </G>

          {/* Масштабная линейка: без неё по чертежу не оценить размер */}
          {barPx > 20 ? (
            <G>
              <Line
                x1={14}
                y1={height - 16}
                x2={14 + barPx}
                y2={height - 16}
                stroke={PALETTE.ink}
                strokeWidth={1.2}
              />
              <Line x1={14} y1={height - 20} x2={14} y2={height - 12} stroke={PALETTE.ink} />
              <Line
                x1={14 + barPx}
                y1={height - 20}
                x2={14 + barPx}
                y2={height - 12}
                stroke={PALETTE.ink}
              />
              <SvgText
                x={14 + barPx / 2}
                y={height - 22}
                fontSize={10}
                fontFamily={fontFamily.mono}
                textAnchor="middle"
                fill={PALETTE.muted}
              >
                {`${bar} ${I18n.t('unitMeters', { defaultValue: 'м' })}`}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      </View>

      <View style={styles.legend}>
        {['first', 'bacterial', 'chemical'].map((key) => (
          <View key={key} style={styles.legendItem}>
            <View
              style={[
                styles.legendMark,
                { backgroundColor: PALETTE[key].fill, borderColor: PALETTE[key].stroke },
              ]}
            />
            <Text style={styles.legendLabel}>{I18n.t(`whpaBelt_${key}Short`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: PALETTE.paper,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.frame,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: PALETTE.muted,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendMark: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
  },
  // Цвет совпадает с приглушённым текстом обеих тем: подписи стоят на фоне
  // приложения, а не на бумаге чертежа
  legendLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
    color: '#8A8087',
  },
});
