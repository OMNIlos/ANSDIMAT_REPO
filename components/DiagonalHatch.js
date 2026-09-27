/**
 * Диагональная штриховка
 *
 * Заливка «пустой» ячейки — той, что стоит на пересечении заголовков и
 * значения не имеет. Приём табличный и старый: заштрихованный угол читается
 * как «здесь ничего не вводят», и подписывать это словами не нужно.
 *
 * Полосы наклонены влево: верх каждой левее её низа. Идут от края до края —
 * шаг отсчитывается с запасом в высоту полотна, иначе левый и правый углы
 * оставались бы пустыми.
 *
 * Размер меряется по факту: ячейка тянется вместе с таблицей, а наклон
 * обязан остаться ровно 45°. Растянуть готовую картинку нельзя — при
 * неравномерном масштабе угол поедет.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

export default function DiagonalHatch({
  color = '#FFFFFF',
  opacity = 0.16,
  /** Расстояние между полосами, px */
  gap = 9,
  strokeWidth = 1.5,
  style,
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    // Перерисовываем только на настоящем изменении: onLayout срабатывает и
    // на каждом ре-рендере родителя, а setState с теми же числами гонял бы
    // компонент по кругу
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  const { width, height } = size;
  const lines = [];
  if (width > 0 && height > 0) {
    for (let x = -height; x < width; x += gap) {
      lines.push(
        <Line
          key={x}
          x1={x}
          y1={0}
          x2={x + height}
          y2={height}
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={strokeWidth}
        />
      );
    }
  }

  return (
    <View style={style} onLayout={handleLayout}>
      {lines.length > 0 && (
        <Svg width={width} height={height}>
          {lines}
        </Svg>
      )}
    </View>
  );
}
