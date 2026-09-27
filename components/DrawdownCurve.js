/**
 * Кривая понижения — фирменный графический элемент приложения
 *
 * Любая откачка рисует именно такую кривую: уровень резко падает в начале
 * и выполаживается со временем. Это визуальный язык гидрогеологии, поэтому
 * кривая работает как знак приложения — в главной кнопке, на пустых экранах
 * и как разделитель секций.
 *
 * @param {number} width - ширина области рисования
 * @param {number} height - высота области рисования
 * @param {string} color - цвет линии
 * @param {number} opacity - прозрачность
 * @param {boolean} filled - заливать ли площадь под кривой
 * @param {boolean} grid - рисовать ли сетку миллиметровки под кривой
 * @param {boolean} stretch - растянуть по всей ширине, игнорируя пропорции
 *   (для широких полос-оснований, где кривая работает как базовая линия)
 */

import React from 'react';
import Svg, { Path, Line, G } from 'react-native-svg';

export default function DrawdownCurve({
  width = 160,
  height = 64,
  color = '#FFFFFF',
  opacity = 0.9,
  filled = false,
  grid = false,
  strokeWidth = 2,
  stretch = false,
}) {
  // Кривая понижения в безразмерных координатах 0..100 x 0..50:
  // быстрый спад от статического уровня, затем выполаживание
  const curve = 'M2,6 C14,7 22,20 32,29 C42,37 56,41 72,43 C84,44 92,45 98,45';
  const area = `${curve} L98,50 L2,50 Z`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 100 50"
      fill="none"
      preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'}
    >
      {grid && (
        <G opacity={0.25}>
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => (
            <Line key={`v${x}`} x1={x} y1="0" x2={x} y2="50" stroke={color} strokeWidth="0.4" />
          ))}
          {[10, 20, 30, 40].map((y) => (
            <Line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke={color} strokeWidth="0.4" />
          ))}
        </G>
      )}

      {filled && <Path d={area} fill={color} opacity={opacity * 0.18} />}

      <Path
        d={curve}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
        fill="none"
      />
    </Svg>
  );
}
