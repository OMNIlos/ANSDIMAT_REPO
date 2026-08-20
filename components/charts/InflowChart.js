/**
 * График притока в котлован во времени
 *
 * Приток не постоянен: радиус влияния растёт как корень из времени, и вместе
 * с ним падает приток. Проектировщику это нужно, чтобы понимать, на какой
  * период рассчитан водоотлив — первый месяц откачки и второй год отличаются
 * в разы, а по одному числу этого не видно.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { spacing, radius, type } from '../../theme';
import { HEIGHT, plotArea, linearScale, niceTicks, polyline } from './plotArea';

/**
 * Сокращает подпись деления оси
 *
 * @param {number} value - значение
 * @returns {string} подпись
 */
function tickLabel(value) {
  if (!isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1000) return `${Math.round(value / 1000)}k`;
  if (abs >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

export default function InflowChart({ points, markerT, width = 340 }) {
  const theme = useTheme();
  const plot = useMemo(() => plotArea(width), [width]);

  const scales = useMemo(() => {
    if (!points || points.length < 2) return null;
    const times = points.map((point) => point.t);
    const flows = points.map((point) => point.Q);
    const maxFlow = Math.max(...flows);
    const x = linearScale(Math.min(...times), Math.max(...times), plot.x, plot.x + plot.w);
    // Ось расхода всегда начинается от нуля: иначе спад притока выглядел бы
    // обвалом, хотя за год он падает всего в полтора раза
    const y = linearScale(0, maxFlow * 1.05, plot.y + plot.h, plot.y);
    return { x, y, maxFlow, minT: Math.min(...times), maxT: Math.max(...times) };
  }, [points, plot]);

  if (!scales) {
    return (
      <View style={[styles.empty, { borderColor: theme.colors.border }]}>
        <Text style={[type.caption, { color: theme.colors.textSecondary }]}>
          {I18n.t('chartNoData', { defaultValue: 'Недостаточно данных для графика' })}
        </Text>
      </View>
    );
  }

  const curve = polyline(points.map((point) => ({ x: scales.x(point.t), y: scales.y(point.Q) })));
  const marker = markerT > 0 ? points.reduce(
    (best, point) => (Math.abs(point.t - markerT) < Math.abs(best.t - markerT) ? point : best),
    points[0]
  ) : null;

  return (
    <View style={[styles.frame, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Svg width={width} height={HEIGHT}>
        {niceTicks(0, scales.maxFlow * 1.05, 4).map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={plot.x}
              y1={scales.y(value)}
              x2={plot.x + plot.w}
              y2={scales.y(value)}
              stroke={theme.colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
            <SvgText
              x={plot.x - 6}
              y={scales.y(value) + 4}
              fontSize={10}
              textAnchor="end"
              fill={theme.colors.textSecondary}
            >
              {tickLabel(value)}
            </SvgText>
          </React.Fragment>
        ))}

        {niceTicks(scales.minT, scales.maxT, 4).map((value) => (
          <SvgText
            key={value}
            x={scales.x(value)}
            y={HEIGHT - 16}
            fontSize={10}
            textAnchor="middle"
            fill={theme.colors.textSecondary}
          >
            {tickLabel(value)}
          </SvgText>
        ))}

        <Path d={curve} fill="none" stroke={theme.colors.primary} strokeWidth={2} />

        {marker ? (
          <Circle
            cx={scales.x(marker.t)}
            cy={scales.y(marker.Q)}
            r={4}
            fill={theme.colors.primary}
            stroke={theme.colors.surface}
            strokeWidth={1.5}
          />
        ) : null}

        <SvgText
          x={plot.x + plot.w / 2}
          y={HEIGHT - 2}
          fontSize={10}
          textAnchor="middle"
          fill={theme.colors.textSecondary}
        >
          {I18n.t('chartTimeAxis', { defaultValue: 'Время работы дренажа, сут' })}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginTop: spacing.sm,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  empty: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
