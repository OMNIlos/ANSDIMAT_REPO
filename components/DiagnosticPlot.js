/**
 * Диагностический график: понижение и его производная в логарифмических осях
 *
 * Тот самый график, по которому в АНСДИМАТ выбирают расчётную схему. Обе
 * величины отложены по логарифму, потому что только так каждый режим даёт
 * свою узнаваемую форму:
 *
 *   производная лежит полкой  — радиальный поток, работает Купер — Джейкоба
 *   полка удвоилась           — непроницаемая граница
 *   производная падает        — переток из смежного пласта или река рядом
 *   наклон 45° в начале       — ёмкость ствола, эти точки в расчёт не берут
 *
 * Понижение показано рядом не для красоты: по нему видно, что данные вообще
 * разумны, а форму даёт производная. Сравнивать их между собой не нужно —
 * важно, что они на одной оси времени.
 *
 * Плоскость живая, как и у основного графика: полку производной ищут на
 * позднем участке, а он на общем масштабе сжат в несколько точек у правого
 * края. Прямую здесь по-прежнему не ведут — только смотрят, — поэтому от
 * основного графика взяты жесты и масштаб, но не подбор наклона.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, G, Rect, Defs, ClipPath } from 'react-native-svg';
import { GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';
import I18n from '../Localization';
import useChartViewport from './chart/useChartViewport';
import ChartToolbar from './chart/ChartToolbar';
import { spacing, radius, type } from '../theme';

const HEIGHT = 250;
// Те же пределы, что у основного графика: плоскости одинаковые, и разные
// пределы читались бы как поломка одной из них
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 50;

/** Отметок замеров у диагностики нет: общая ссылка вместо нового массива */
const EMPTY_POINTS = [];
// Снизу два ряда подписей: деления и название осей
const PADDING = { left: 48, right: 16, top: 16, bottom: 46 };

/**
 * Подпись деления логарифмической оси
 *
 * @param {number} value - значение (не логарифм)
 * @returns {string} подпись
 */
function tickLabel(value) {
  if (value >= 1000) return String(Math.round(value));
  if (value >= 1) return String(Number(value.toFixed(1)));
  if (value >= 0.01) return String(Number(value.toFixed(2)));
  return value.toExponential(0);
}

/**
 * Деления логарифмической оси
 *
 * Целых степеней десяти мало: опыт часто укладывается в одну декаду, и тогда
 * на всей оси остаётся единственная подпись. Поэтому внутри декады
 * добавляются 2 и 5 — стандартный набор логарифмической линейки, по которому
 * положение точки читается без пересчёта в уме.
 *
 * @param {number} lgFrom - нижняя граница, логарифм
 * @param {number} lgTo - верхняя граница, логарифм
 * @returns {number[]} значения делений
 */
function logTicks(lgFrom, lgTo) {
  const decades = lgTo - lgFrom;
  const mantissas = decades > 2.5 ? [1] : decades > 1.2 ? [1, 3] : [1, 2, 5];

  const values = [];
  for (let p = Math.floor(lgFrom); p <= Math.ceil(lgTo); p++) {
    for (const m of mantissas) {
      const lg = p + Math.log10(m);
      if (lg >= lgFrom && lg <= lgTo) values.push(Math.pow(10, lg));
    }
  }
  return values.slice(0, 8);
}

export default function DiagnosticPlot({
  result,
  width = 340,
  viewportStore,
  scrollRef,
}) {
  const theme = useTheme();
  const c = theme.colors;

  const plot = useMemo(
    () => ({
      x: PADDING.left,
      y: PADDING.top,
      w: Math.max(40, width - PADDING.left - PADDING.right),
      h: HEIGHT - PADDING.top - PADDING.bottom,
    }),
    [width]
  );

  const points = useMemo(
    () => (result?.derivative ?? []).filter((p) => p.t > 0 && p.d > 0 && p.s > 0),
    [result]
  );

  // Обе величины на одной оси Y: масштаб общий, поэтому расстояние между
  // кривыми на графике означает ровно то, что оно означает в расчёте
  const base = useMemo(() => {
    if (points.length < 2) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    const values = points.flatMap((p) => [p.d, p.s]);
    const lgT = points.map((p) => Math.log10(p.t));
    return {
      x0: Math.min(...lgT) - 0.15,
      x1: Math.max(...lgT) + 0.15,
      y0: Math.log10(Math.min(...values)) - 0.2,
      y1: Math.log10(Math.max(...values)) + 0.2,
    };
  }, [points]);

  // Ключ системы координат: у диагностики она одна, но хранилище областей
  // общее с основным графиком, и без своего ключа они делили бы одно окно
  const { view, gesture, zoomBy, reset } = useChartViewport({
    base,
    plot,
    viewKey: 'diagnostic',
    viewportStore,
    scrollRef,
    freedom: false,
    fitPoints: EMPTY_POINTS,
    anchors: null,
    onAnchorsChange: undefined,
    onSelectPoint: undefined,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  });

  const scene = useMemo(() => {
    if (points.length < 2) return { hasData: false };

    const { x0, x1, y0, y1 } = view;

    const toX = (lg) => plot.x + ((lg - x0) / (x1 - x0)) * plot.w;
    const toY = (lg) => plot.y + plot.h - ((lg - y0) / (y1 - y0)) * plot.h;

    const path = (key) =>
      points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(Math.log10(p.t)).toFixed(1)},${toY(Math.log10(p[key])).toFixed(1)}`)
        .join(' ');

    const ticks = (from, to, mapper) =>
      logTicks(from, to).map((value) => ({
        pos: mapper(Math.log10(value)),
        label: tickLabel(value),
      }));

    // Уровень полки: по нему считается T, поэтому он показан явной линией
    const plateauY = result.plateau > 0 ? toY(Math.log10(result.plateau)) : null;
    const earlyX =
      result.wellboreEndsAt > 0 ? toX(Math.log10(result.wellboreEndsAt)) : null;

    return {
      hasData: true,
      drawdown: path('s'),
      derivative: path('d'),
      dots: points.map((p) => ({
        x: toX(Math.log10(p.t)),
        ys: toY(Math.log10(p.s)),
        yd: toY(Math.log10(p.d)),
      })),
      xTicks: ticks(x0, x1, (p) => toX(p)),
      yTicks: ticks(y0, y1, (p) => toY(p)),
      plateauY,
      earlyX,
    };
  }, [points, result, plot, view]);

  if (!scene.hasData) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: c.plotBg, borderColor: c.border, height: HEIGHT, width },
        ]}
      >
        <Text style={[type.body, styles.emptyTitle, { color: c.text }]}>
          {I18n.t('diagnosticEmptyTitle', {
            defaultValue: 'Диагностике нужно не меньше пяти замеров',
          })}
        </Text>
        <Text style={[type.caption, styles.emptyText, { color: c.textSecondary }]}>
          {I18n.t('diagnosticEmptyHint', {
            defaultValue:
              'И желательно вразбивку по времени: 1, 2, 5, 10, 30 минут. По равномерному ряду форма кривой не читается.',
          })}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <ChartToolbar
        caption={I18n.t('diagnosticCaption', { defaultValue: 's и ds/dlnt — lg t' })}
        onZoomIn={() => zoomBy(1.6)}
        onZoomOut={() => zoomBy(1 / 1.6)}
        onReset={reset}
        colors={c}
      />
      <GestureDetector gesture={gesture}>
        <View
          style={[
            styles.canvas,
            { backgroundColor: c.plotBg, borderColor: c.border, width },
          ]}
        >
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <ClipPath id="diagClip">
              <Rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} />
            </ClipPath>
          </Defs>

          <G clipPath="url(#diagClip)">
            {scene.xTicks.map((tick, i) => (
              <Line
                key={`gx${i}`}
                x1={tick.pos}
                y1={plot.y}
                x2={tick.pos}
                y2={plot.y + plot.h}
                stroke={c.border}
                strokeWidth={0.5}
                strokeDasharray="2 3"
              />
            ))}
            {scene.yTicks.map((tick, i) => (
              <Line
                key={`gy${i}`}
                x1={plot.x}
                y1={tick.pos}
                x2={plot.x + plot.w}
                y2={tick.pos}
                stroke={c.border}
                strokeWidth={0.5}
              />
            ))}

            {/* Ранний участок затенён: эти замеры характеризуют скважину,
                а не пласт, и в расчёт T они не идут */}
            {scene.earlyX != null && (
              <Rect
                x={plot.x}
                y={plot.y}
                width={Math.max(0, scene.earlyX - plot.x)}
                height={plot.h}
                fill={c.textSecondary}
                opacity={0.09}
              />
            )}

            {/* Полка производной — уровень, по которому считается T */}
            {scene.plateauY != null && (
              <Line
                x1={plot.x}
                y1={scene.plateauY}
                x2={plot.x + plot.w}
                y2={scene.plateauY}
                stroke={c.primaryAccent}
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            )}

            <Path d={scene.drawdown} stroke={c.secondary} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <Path d={scene.derivative} stroke={c.primaryAccent} strokeWidth={2} fill="none" strokeLinejoin="round" />

            {scene.dots.map((dot, i) => (
              <G key={`d${i}`}>
                <Circle cx={dot.x} cy={dot.ys} r={2.6} fill={c.secondary} />
                <Circle cx={dot.x} cy={dot.yd} r={3.2} fill={c.plotBg} stroke={c.primaryAccent} strokeWidth={1.8} />
              </G>
            ))}
          </G>

          <Line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y + plot.h} stroke={c.textSecondary} strokeWidth={1} />
          <Line
            x1={plot.x}
            y1={plot.y + plot.h}
            x2={plot.x + plot.w}
            y2={plot.y + plot.h}
            stroke={c.textSecondary}
            strokeWidth={1}
          />
        </Svg>

        {scene.xTicks.map((tick, i) => (
          <Text key={`xl${i}`} style={[styles.tick, styles.tickX, { left: tick.pos - 26, color: c.faint }]}>
            {tick.label}
          </Text>
        ))}
        {scene.yTicks.map((tick, i) => (
          <Text key={`yl${i}`} style={[styles.tick, styles.tickY, { top: tick.pos - 7, color: c.faint }]}>
            {tick.label}
          </Text>
        ))}

        {/* Что отложено по осям. Без этого график читается как абстрактная
            картинка: обе величины в метрах, но время — в тех же минутах,
            что и в журнале замеров */}
        <Text style={[styles.axisName, { color: c.faint }]}>
          {I18n.t('diagnosticAxes', { defaultValue: 't, мин · по вертикали — метры' })}
        </Text>
        </View>
      </GestureDetector>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: c.primaryAccent }]} />
          <Text style={[styles.legendText, { color: c.textSecondary }]}>
            {I18n.t('legendDerivative', { defaultValue: 'производная ds/d(ln t)' })}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: c.secondary }]} />
          <Text style={[styles.legendText, { color: c.textSecondary }]}>
            {I18n.t('legendDrawdown', { defaultValue: 'понижение s' })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  empty: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  tick: {
    ...type.numeric,
    position: 'absolute',
    fontSize: 10,
  },
  tickX: {
    bottom: 14,
    width: 52,
    textAlign: 'center',
  },
  axisName: {
    ...type.caption,
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    fontSize: 10,
    textAlign: 'center',
  },
  tickY: {
    left: 0,
    width: 42,
    textAlign: 'right',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 12,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    ...type.caption,
    fontSize: 12,
  },
});
