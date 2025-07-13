import React, { useRef, useEffect, useState } from "react";
import { Dimensions } from "react-native";
import Svg, { Line, Circle } from "react-native-svg";

const { width, height } = Dimensions.get("window");

const POINTS_COUNT = 28;
const RADIUS = 5;
const COLOR = "#800020";
const LINE_OPACITY = 0.18;
const MAX_DISTANCE = 120;

function generatePoints() {
  // Каждая точка получает уникальную фазу и скорость
  return Array.from({ length: POINTS_COUNT }, (_, i) => ({
    baseX: Math.random() * width,
    baseY: Math.random() * height,
    amplitude: 30 + Math.random() * 40,
    freq: 0.5 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 0.7,
  }));
}

export default function AnimatedNetworkBackground() {
  const points = useRef(generatePoints()).current;
  const [time, setTime] = useState(0);

  useEffect(() => {
    let frame;
    const animate = () => {
      setTime((t) => t + 0.016); // ~60fps
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Вычисляем текущие позиции точек
  const animatedPoints = points.map((p, i) => {
    const t = time * p.speed + p.phase;
    return {
      x: p.baseX + Math.sin(t * p.freq) * p.amplitude,
      y: p.baseY + Math.cos(t * p.freq) * p.amplitude,
    };
  });

  return (
    <Svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
      }}
      width={width}
      height={height}
      pointerEvents="none"
    >
      {/* Линии */}
      {animatedPoints.map((p1, i) =>
        animatedPoints.map((p2, j) => {
          if (i < j) {
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < MAX_DISTANCE) {
              return (
                <Line
                  key={`line-${i}-${j}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={COLOR}
                  strokeWidth={1}
                  opacity={LINE_OPACITY * (1 - dist / MAX_DISTANCE)}
                />
              );
            }
          }
          return null;
        })
      )}
      {/* Точки */}
      {animatedPoints.map((p, i) => (
        <Circle
          key={`circle-${i}`}
          cx={p.x}
          cy={p.y}
          r={RADIUS}
          fill={COLOR}
          opacity={0.8}
        />
      ))}
    </Svg>
  );
}
