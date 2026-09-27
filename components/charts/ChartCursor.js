/**
 * Курсор графика: проекции точки касания на оси
 *
 * Палец ведут по полотну, а от точки под ним к осям тянутся пунктирные
 * проекции с плашками значений. Это единственный способ прочитать с графика
 * конкретную пару чисел: подписей делений мало, а между ними на
 * логарифмической шкале лежит целый порядок.
 *
 * Курсор ничего не сглаживает и не догоняет палец анимацией: прямое
 * управление тем и хорошо, что рисунок стоит ровно там, где палец, без
 * задержки.
 */

import React, { useMemo, useState } from 'react';
import { PanResponder } from 'react-native';
import { G, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { fontFamily } from '../../theme';
import { clamp } from './plotArea';

/** Кегль подписей на плашках */
const LABEL_SIZE = 10;
/** Высота плашки значения */
const CHIP_H = 16;
/** Ширина знака моноширинного шрифта относительно кегля */
const CHAR_W = 0.62;
/** Поля внутри плашки */
const CHIP_PAD = 5;

/**
 * Ширина плашки под строку
 *
 * Измерить текст в SVG нечем, поэтому ширина считается по числу знаков:
 * шрифт моноширинный, и оценка совпадает с фактической.
 *
 * @param {string} text - строка
 * @returns {number} ширина плашки
 */
function chipWidth(text) {
  return String(text).length * LABEL_SIZE * CHAR_W + CHIP_PAD * 2;
}

/**
 * Слежение за пальцем по области построения
 *
 * @param {{x: number, y: number, w: number, h: number}} plot - область построения
 * @returns {{cursor: ?{x: number, y: number}, handlers: Object}} курсор и обработчики
 */
export function useChartCursor(plot) {
  const [cursor, setCursor] = useState(null);

  const handlers = useMemo(() => {
    /**
     * Переводит касание в точку внутри области построения
     *
     * @param {Object} event - событие касания
     * @returns {{x: number, y: number}} точка на полотне
     */
    const pointAt = (event) => {
      const { locationX, locationY } = event.nativeEvent;
      return {
        x: clamp(locationX, plot.x, plot.x + plot.w),
        y: clamp(locationY, plot.y, plot.y + plot.h),
      };
    };

    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Прокрутка экрана не должна перехватывать ведение по полотну
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => setCursor(pointAt(event)),
      onPanResponderMove: (event) => setCursor(pointAt(event)),
      onPanResponderRelease: () => setCursor(null),
      onPanResponderTerminate: () => setCursor(null),
    });
    return responder.panHandlers;
  }, [plot.x, plot.y, plot.w, plot.h]);

  return { cursor, handlers };
}

/**
 * Плашка значения на оси
 *
 * @param {Object} props
 * @returns {React.ReactElement} плашка
 */
function Chip({ x, y, text, fill, color, halo }) {
  const w = chipWidth(text);
  return (
    <G>
      {/* Обводка цветом полотна отбивает плашку от подписи деления, поверх
          которой она встаёт: без неё цифры сливались краями */}
      <Rect
        x={x}
        y={y}
        width={w}
        height={CHIP_H}
        rx={5}
        fill={fill}
        stroke={halo}
        strokeWidth={3}
      />
      <Rect x={x} y={y} width={w} height={CHIP_H} rx={5} fill={fill} />
      <SvgText
        x={x + w / 2}
        y={y + CHIP_H / 2 + LABEL_SIZE * 0.36}
        fontSize={LABEL_SIZE}
        fontFamily={fontFamily.mono}
        textAnchor="middle"
        fill={color}
      >
        {text}
      </SvgText>
    </G>
  );
}

/**
 * Проекции точки касания на оси со значениями
 *
 * @param {Object} props
 * @param {{x: number, y: number}} props.cursor - точка под пальцем
 * @param {{x: number, y: number, w: number, h: number}} props.plot - область построения
 * @param {string} props.xLabel - значение по оси абсцисс
 * @param {string} props.yLabel - значение по оси ординат
 * @param {Array<{y: number, color: string, label: ?string}>} [props.marks] - точки кривых
 *   на текущей абсциссе; подписанная отметка получает плашку со своим значением
 * @param {string} props.accent - цвет проекций
 * @param {string} props.chipColor - цвет текста на плашке
 * @param {string} props.halo - цвет полотна: обводка плашек
 * @param {number} props.width - ширина полотна
 * @returns {React.ReactElement|null} курсор
 */
export function ChartCursor({
  cursor,
  plot,
  xLabel,
  yLabel,
  marks = [],
  accent,
  chipColor,
  halo,
  width,
}) {
  if (!cursor) return null;

  const bottom = plot.y + plot.h;
  const xChipW = chipWidth(xLabel);
  const yChipW = chipWidth(yLabel);

  return (
    <G>
      {/* Проекция на ось абсцисс: от точки вниз к делениям */}
      <Line
        x1={cursor.x}
        y1={cursor.y}
        x2={cursor.x}
        y2={bottom}
        stroke={accent}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {/* Проекция на ось ординат: от точки влево к подписям */}
      <Line
        x1={plot.x}
        y1={cursor.y}
        x2={cursor.x}
        y2={cursor.y}
        stroke={accent}
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {/* Где кривые проходят через текущую абсциссу: видно, насколько палец
          отстоит от самой кривой */}
      {marks.map((mark) => {
        if (!mark.label) {
          return (
            <Circle
              key={mark.color}
              cx={cursor.x}
              cy={mark.y}
              r={3.5}
              fill={mark.color}
              stroke={halo}
              strokeWidth={1.5}
            />
          );
        }
        // Плашка встаёт справа от отметки, а у правого края полотна
        // перекидывается влево, чтобы не уехать за обрез
        const w = chipWidth(mark.label);
        const right = cursor.x + 9;
        const x = right + w > width ? cursor.x - 9 - w : right;
        return (
          <G key={mark.color}>
            <Circle
              cx={cursor.x}
              cy={mark.y}
              r={3.5}
              fill={mark.color}
              stroke={halo}
              strokeWidth={1.5}
            />
            <Chip
              x={x}
              y={clamp(mark.y - CHIP_H / 2, 0, Math.max(0, bottom - CHIP_H))}
              text={mark.label}
              fill={mark.color}
              color={chipColor}
              halo={halo}
            />
          </G>
        );
      })}

      <Circle cx={cursor.x} cy={cursor.y} r={4} fill="none" stroke={accent} strokeWidth={1.5} />

      <Chip
        x={clamp(cursor.x - xChipW / 2, 0, Math.max(0, width - xChipW))}
        y={bottom + 3}
        text={xLabel}
        fill={accent}
        color={chipColor}
        halo={halo}
      />
      <Chip
        x={Math.max(0, plot.x - 5 - yChipW)}
        y={clamp(cursor.y - CHIP_H / 2, 0, Math.max(0, bottom - CHIP_H))}
        text={yLabel}
        fill={accent}
        color={chipColor}
        halo={halo}
      />
    </G>
  );
}
