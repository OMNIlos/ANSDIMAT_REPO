/**
 * Полотно графика — отрисовка готовой сцены
 *
 * Компонент ничего не считает: вся геометрия приходит из `calc/chartScene.js`
 * уже в пикселях. Здесь только цвета, толщины и порядок наложения, то есть
 * ровно то, что нельзя проверить числом.
 *
 * Координаты не масштабируются трансформацией группы SVG: она растянула бы
 * вместе с данными и толщину линий, и радиусы точек. Сцена приходит
 * пересчитанной, поэтому при зуме меняется только положение элементов.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, G, Rect, Defs, ClipPath } from 'react-native-svg';
import { SERIES_ROLES } from '../../calc/chartSeries';
import { type } from '../../theme';

/** Радиус замера открытой скважины и отмеченного замера, px */
const DOT_RADIUS = 3.6;
const DOT_RADIUS_SELECTED = 5.5;

/** Радиус замера соседней скважины: она читается второй */
const REFERENCE_DOT_RADIUS = 2.6;

/**
 * Полотно с данными
 *
 * @param {Object} props
 * @param {Object} props.scene - сцена, см. calc/chartScene.js
 * @param {{x: number, y: number, w: number, h: number}} props.plot - область построения
 * @param {number} props.width - ширина полотна, px
 * @param {number} props.height - высота полотна, px
 * @param {Object} props.colors - цвета темы
 * @param {Array<number>} props.selected - отмеченные замеры
 * @param {Object|null} props.ghost - эскиз пустого состояния
 */
export default function ChartCanvas({
  scene,
  plot,
  width,
  height,
  colors: c,
  selected = [],
  ghost,
}) {
  // Соседние кривые рисуются раньше основных: открытая в журнале кривая
  // должна читаться первой, а порядок наложения в SVG задаётся порядком узлов
  const reference = scene.shapes.filter((one) => one.role === SERIES_ROLES.REFERENCE);
  const fitted = scene.shapes.filter((one) => one.role !== SERIES_ROLES.REFERENCE);

  return (
    <>
      <Svg width={width} height={height}>
        <Defs>
          {/* Данные не вылезают за область графика и не наезжают на оси */}
          <ClipPath id="plotClip">
            <Rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} />
          </ClipPath>
        </Defs>

        {/* Полосы осей: за них тянут, чтобы растянуть одну ось. Без заливки
            этот жест ничем не обозначен, и найти его можно только случайно.
            Заливка едва заметная — полосы подсказывают, а не спорят с данными */}
        <Rect
          x={plot.x}
          y={plot.y + plot.h}
          width={plot.w}
          height={Math.max(0, height - plot.y - plot.h)}
          fill={c.textSecondary}
          opacity={0.05}
        />
        <Rect
          x={0}
          y={plot.y}
          width={plot.x}
          height={plot.h}
          fill={c.textSecondary}
          opacity={0.05}
        />

        {/* Пустой график: вместо голых осей — эскиз того, что здесь появится.
            Ломаная в начале задрана ёмкостью ствола, дальше выходит на прямую
            Купера — Джейкоба */}
        {ghost && (
          <G opacity={0.28}>
            <Path
              d={ghost.curve}
              stroke={c.secondary}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={ghost.line}
              stroke={c.primaryAccent}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              fill="none"
            />
            {ghost.dots.map((dot, i) => (
              <Circle
                key={`g${i}`}
                cx={dot.x}
                cy={dot.y}
                r={DOT_RADIUS}
                fill={c.plotBg}
                stroke={c.secondary}
                strokeWidth={2}
              />
            ))}
          </G>
        )}

        <G clipPath="url(#plotClip)">
          {/* Подписанные деления держат сетку, мелкие — только намекают на
              кратности внутри декады и не должны спорить с данными */}
          {scene.xTicks.map((tick, i) => (
            <Line
              key={`gx${i}`}
              x1={tick.x}
              y1={plot.y}
              x2={tick.x}
              y2={plot.y + plot.h}
              stroke={c.border}
              strokeWidth={0.5}
              strokeDasharray="2 3"
              opacity={tick.label ? 1 : 0.45}
            />
          ))}
          {scene.yTicks.map((tick, i) => (
            <Line
              key={`gy${i}`}
              x1={plot.x}
              y1={tick.y}
              x2={plot.x + plot.w}
              y2={tick.y}
              stroke={c.border}
              strokeWidth={0.5}
            />
          ))}

          {scene.fitPath ? (
            <Path
              d={scene.fitPath}
              stroke={c.primaryAccent}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              fill="none"
            />
          ) : null}

          {reference.map((series) => (
            <React.Fragment key={series.id}>
              {series.path ? (
                <Path
                  d={series.path}
                  stroke={series.color}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="6 4"
                  fill="none"
                  opacity={0.9}
                />
              ) : null}
              {series.dots.map((dot, i) => (
                <Circle
                  key={`${series.id}-${i}`}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={REFERENCE_DOT_RADIUS}
                  fill={series.color}
                  opacity={0.85}
                />
              ))}
            </React.Fragment>
          ))}

          {fitted.map((series) =>
            series.path ? (
              <Path
                key={`pl${series.id}`}
                d={series.path}
                stroke={series.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            ) : null
          )}

          {fitted.map((series) =>
            series.dots.map((dot) => {
              const isSelected = selected.includes(dot.index);
              // Отмеченная точка красится акцентом всегда: её надо видеть
              // среди прочих, даже если у скважины свой цвет
              return (
                <Circle
                  key={`${series.id}-p${dot.index}`}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={isSelected ? DOT_RADIUS_SELECTED : DOT_RADIUS}
                  fill={isSelected ? c.primaryAccent : c.surface}
                  stroke={isSelected ? c.primaryAccent : series.color}
                  strokeWidth={2}
                />
              );
            })
          )}

          {/* Свободные точки крупнее замеров: их тащат пальцем, и попасть
              по ним надо с первого раза */}
          {scene.anchorDots?.map((dot, i) => (
            <React.Fragment key={`a${i}`}>
              <Circle cx={dot.cx} cy={dot.cy} r={11} fill={c.primaryAccent} opacity={0.18} />
              <Circle
                cx={dot.cx}
                cy={dot.cy}
                r={6.5}
                fill={c.plotBg}
                stroke={c.primaryAccent}
                strokeWidth={2.5}
              />
            </React.Fragment>
          ))}
        </G>

        {/* Оси рисуются поверх клипа: они не двигаются и не масштабируются.
            Начало отсчёта — в левом нижнем углу, поэтому ось абсцисс идёт
            понизу, а не поверху */}
        <Line
          x1={plot.x}
          y1={plot.y}
          x2={plot.x}
          y2={plot.y + plot.h}
          stroke={c.textSecondary}
          strokeWidth={1}
        />
        <Line
          x1={plot.x}
          y1={plot.y + plot.h}
          x2={plot.x + plot.w}
          y2={plot.y + plot.h}
          stroke={c.textSecondary}
          strokeWidth={1}
        />
      </Svg>

      {/* Подписи делений — обычным текстом, чтобы работали табличные цифры.
          У мелкой сетки подписи нет: она показывает кратности внутри декады,
          и числа на ней стояли бы сплошной строкой */}
      {scene.hasData && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {scene.xTicks.map((tick, i) =>
            tick.label == null ? null : (
              <Text
                key={`xl${i}`}
                style={[
                  styles.tickLabel,
                  styles.tickLabelX,
                  // Привязка к нижнему краю области построения, а не к низу
                  // полотна: в развёрнутом виде низ полотна — это низ экрана,
                  // и подписи уходили под плавающие переключатели
                  { left: tick.x - 26, top: plot.y + plot.h + 6, color: c.faint },
                ]}
                numberOfLines={1}
              >
                {tick.label}
              </Text>
            )
          )}
          {scene.yTicks.map((tick, i) => (
            <Text
              key={`yl${i}`}
              style={[styles.tickLabel, styles.tickLabelY, { top: tick.y - 7, color: c.faint }]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tickLabel: {
    position: 'absolute',
    ...type.numeric,
    fontSize: 10,
    lineHeight: 14,
  },
  tickLabelX: {
    width: 52,
    textAlign: 'center',
  },
  tickLabelY: {
    left: 2,
    width: 40,
    textAlign: 'right',
  },
});
