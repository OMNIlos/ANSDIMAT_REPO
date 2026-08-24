/**
 * График понижения во времени
 *
 * Две кривые на одном полотне: понижение в опытной скважине и в
 * наблюдательной. Ось времени логарифмическая — понижение растёт как
 * логарифм времени, и на такой шкале обе кривые выпрямляются в прямые.
 * По наклону этих прямых гидрогеолог читает водопроводимость, а по расхождению
 * между ними — на сколько воронка успела дотянуться до точки наблюдения.
 *
 * По полотну можно вести пальцем: от точки касания к осям тянутся проекции со
 * значениями, а на кривых загораются отметки текущего момента времени —
 * легенда при этом показывает оба понижения на нём.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { spacing, radius, type, fontFamily } from '../../theme';
import {
  HEIGHT,
  plotArea,
  linearScale,
  logScale,
  niceTicks,
  decadeTicks,
  polyline,
  formatReadout,
} from './plotArea';
import { ChartCursor, useChartCursor } from './ChartCursor';

/**
 * Подпись деления логарифмической оси
 *
 * @param {number} value - значение
 * @returns {string} подпись вида 1e-3
 */
function decadeLabel(value) {
  const power = Math.round(Math.log10(value));
  return `1e${power >= 0 ? '+' : ''}${power}`;
}

export default function DrawdownLogChart({ series, width = 340 }) {
  const theme = useTheme();
  const plot = useMemo(() => plotArea(width), [width]);
  const { cursor, handlers } = useChartCursor(plot);

  const scales = useMemo(() => {
    if (!series || series.length < 2) return null;
    const times = series.map((point) => point.t);
    const values = series.flatMap((point) => [point.sWell, point.sObs]).filter(Number.isFinite);
    if (values.length === 0) return null;
    const maxDrawdown = Math.max(...values);
    return {
      x: logScale(Math.min(...times), Math.max(...times), plot.x, plot.x + plot.w),
      // Понижение отсчитывается от нуля вниз: так график читается как разрез,
      // а не как перевёрнутая кривая роста
      y: linearScale(0, maxDrawdown * 1.05, plot.y, plot.y + plot.h),
      minT: Math.min(...times),
      maxT: Math.max(...times),
      maxDrawdown,
    };
  }, [series, plot]);

  if (!scales) {
    return (
      <View style={[styles.empty, { borderColor: theme.colors.border }]}>
        <Text style={[type.caption, { color: theme.colors.textSecondary }]}>
          {I18n.t('chartNoData', { defaultValue: 'Недостаточно данных для графика' })}
        </Text>
      </View>
    );
  }

  const curveOf = (key) =>
    polyline(
      series
        .filter((point) => Number.isFinite(point[key]))
        .map((point) => ({ x: scales.x(point.t), y: scales.y(point[key]) }))
    );

  // Момент времени под пальцем и ближайшая к нему точка ряда: показания
  // берутся из расчёта, а не с пикселей кривой
  const cursorTime = cursor ? scales.x.invert(cursor.x) : null;
  const nearest =
    cursorTime === null
      ? null
      : series.reduce(
          (best, point) =>
            Math.abs(Math.log10(point.t) - Math.log10(cursorTime)) <
            Math.abs(Math.log10(best.t) - Math.log10(cursorTime))
              ? point
              : best,
          series[0]
        );

  const legend = [
    { key: 'sWell', color: theme.colors.primary, label: I18n.t('schemePumpedWell') },
    { key: 'sObs', color: theme.colors.secondary, label: I18n.t('schemeObsWell') },
  ];

  return (
    <View style={[styles.frame, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {/* Легенда стоит над полотном: внутри она ложилась на верхнюю линию
          сетки и на подпись нулевого деления оси понижения */}
      <View style={[styles.legend, { borderBottomColor: theme.colors.border }]}>
        {legend.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.legendMark, { backgroundColor: item.color }]} />
            <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>
              {item.label}
              {nearest ? (
                <Text style={[styles.legendValue, { color: theme.colors.text }]}>
                  {`  ${formatReadout(nearest[item.key])}`}
                </Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>
      <View {...handlers}>
        <Svg width={width} height={HEIGHT}>
        {niceTicks(0, scales.maxDrawdown * 1.05, 4).map((value) => (
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
              fontFamily={fontFamily.mono}
              fill={theme.colors.textSecondary}
            >
              {value.toFixed(value >= 10 ? 0 : 1)}
            </SvgText>
          </React.Fragment>
        ))}

        {decadeTicks(scales.minT, scales.maxT).map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={scales.x(value)}
              y1={plot.y}
              x2={scales.x(value)}
              y2={plot.y + plot.h}
              stroke={theme.colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
              strokeDasharray="2 4"
            />
            <SvgText
              x={scales.x(value)}
              y={HEIGHT - 16}
              fontSize={9}
              textAnchor="middle"
              fontFamily={fontFamily.mono}
              fill={theme.colors.textSecondary}
            >
              {decadeLabel(value)}
            </SvgText>
          </React.Fragment>
        ))}

        <Path d={curveOf('sWell')} fill="none" stroke={theme.colors.primary} strokeWidth={2} />
        <Path
          d={curveOf('sObs')}
          fill="none"
          stroke={theme.colors.secondary}
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        {/* Подпись оси ординат: повёрнута вокруг своей середины, поэтому
            стоит в левом поле и не наезжает на числа делений */}
        <SvgText
          x={11}
          y={plot.y + plot.h / 2}
          fontSize={10}
          textAnchor="middle"
          fontFamily={fontFamily.regular}
          fill={theme.colors.textSecondary}
          transform={`rotate(-90 11 ${plot.y + plot.h / 2})`}
        >
          {I18n.t('chartDrawdownAxis')}
        </SvgText>

        <SvgText
          x={plot.x + plot.w / 2}
          y={HEIGHT - 2}
          fontSize={10}
          textAnchor="middle"
          fontFamily={fontFamily.regular}
          fill={theme.colors.textSecondary}
        >
          {I18n.t('chartPumpingTimeAxis', { defaultValue: 'Время от начала откачки, сут' })}
        </SvgText>

        <ChartCursor
          cursor={cursor}
          plot={plot}
          width={width}
          accent={theme.colors.primaryAccent}
          chipColor={theme.colors.white}
          halo={theme.colors.surface}
          xLabel={cursorTime === null ? '' : formatReadout(cursorTime)}
          yLabel={cursor ? formatReadout(scales.y.invert(cursor.y)) : ''}
          marks={
            nearest
              ? legend
                  .filter((item) => Number.isFinite(nearest[item.key]))
                  .map((item) => ({ color: item.color, y: scales.y(nearest[item.key]) }))
              : []
          }
        />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendMark: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  legendValue: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 11,
    fontWeight: '600',
  },
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
