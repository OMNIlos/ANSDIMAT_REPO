import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function Vector4({ 
  width = 155.398, 
  height = 52.038, 
  color = '#fff',
  strokeWidth = 2,
  style = {}
}) {
  return (
    <Svg 
      width={width} 
      height={height} 
      viewBox="0 0 155.398 52.038"
      style={[{ backgroundColor: 'transparent' }, style]}
    >
      <Path
        id="Vector_28"
        data-name="Vector 28"
        d="M0,42H11.5L23,28l8.5,21L45,25l3,9.5,15.5,5,11-23L86,46.5l17.5-7,5,9.5,12-49L127,39.5l8-19L141.5,42l13-26.5"
        transform="translate(0 0.238)"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray="0 0"
      />
    </Svg>
  );
} 