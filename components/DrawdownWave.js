/**
 * Декоративная кривая понижения в основании герой-карточки
 *
 * Путь взят из дизайн-прототипа: плавная кривая с полупрозрачной заливкой
 * под ней. Растягивается по всей ширине карточки (preserveAspectRatio none),
 * поэтому работает как «дно» блока при любой ширине экрана.
 *
 * @param {number|string} width - ширина (по умолчанию '100%')
 * @param {number} height - высота полосы, px (по умолчанию 58)
 * @param {string} stroke - цвет линии
 * @param {string} fill - цвет заливки под линией
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function DrawdownWave({
  width = '100%',
  height = 58,
  stroke = 'rgba(255,255,255,0.55)',
  fill = 'rgba(255,255,255,0.13)',
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 340 58" preserveAspectRatio="none">
      <Path d="M0,10 C70,10 90,12 130,28 C185,50 250,52 340,53 L340,58 L0,58 Z" fill={fill} />
      <Path
        d="M0,10 C70,10 90,12 130,28 C185,50 250,52 340,53"
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
    </Svg>
  );
}
