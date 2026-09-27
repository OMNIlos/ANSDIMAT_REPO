/**
 * Разрез депрессионной воронки
 *
 * Прогноз по Тейсу отвечает на вопрос «сколько будет понижение в точке r
 * через время t» одним числом. Но проектировщику нужно другое: как выглядит
 * воронка целиком — где она обрывается, попадает ли в неё соседний водозабор,
 * достаёт ли до реки. Разрез отвечает на это сразу.
 *
 * Что нарисовано: вертикальный разрез через скважину. Горизонталь наверху —
 * уровень до откачки, кривая под ней — уровень во время откачки. Расстояние
 * между ними в любой точке и есть понижение. Расчётная точка отмечена.
 *
 * Разрез симметричен, потому что решение Тейса зависит только от расстояния
 * до скважины: показывать одну половину значило бы намекать на анизотропию,
 * которой в этом решении нет.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import I18n from '../Localization';
import { predictDrawdownTheis } from '../calc/aquifer';
import { wellFunction } from '../calc/wellFunction';
import { spacing, radius, type } from '../theme';

const HEIGHT = 210;
const PADDING = { left: 40, right: 16, top: 26, bottom: 30 };

/** Сколько точек на половину кривой */
const SAMPLES = 48;

/** Радиус ствола по умолчанию, м — с него начинается кривая */
const WELL_RADIUS = 0.1;

/**
 * Форматирует расстояние для подписи оси
 *
 * @param {number} value - метры
 * @returns {string} подпись
 */
function formatDistance(value) {
  if (!isFinite(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(1)} км`;
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

export default function DepressionCone({ Q, T, S, t, markerR, width = 340 }) {
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

  const scene = useMemo(() => {
    if (!(Q > 0) || !(T > 0) || !(S > 0) || !(t > 0)) return { hasData: false };

    const drawdownAt = (r) => predictDrawdownTheis({ Q, T, S, r, t }, wellFunction).s;

    // Внешняя граница воронки: там, где понижение падает до сантиметра.
    // Радиус влияния R = 1.5·√(Tt/S) — обычная инженерная оценка, дальше
    // неё решение Тейса всё равно даёт исчезающе малые значения
    const influence = 1.5 * Math.sqrt((T * t) / S);
    const outer = Math.max(influence, (markerR > 0 ? markerR : 0) * 1.15, WELL_RADIUS * 10);

    // Точки берутся по логарифму: вблизи скважины воронка круто падает,
    // и равномерный шаг срезал бы ей вершину
    const lgFrom = Math.log10(WELL_RADIUS);
    const lgTo = Math.log10(outer);
    const half = Array.from({ length: SAMPLES }, (_, i) => {
      const r = Math.pow(10, lgFrom + ((lgTo - lgFrom) * i) / (SAMPLES - 1));
      return { r, s: drawdownAt(r) };
    }).filter((p) => isFinite(p.s) && p.s >= 0);

    if (half.length < 2) return { hasData: false };

    const maxS = Math.max(...half.map((p) => p.s));
    if (!(maxS > 0)) return { hasData: false };

    // По горизонтали — расстояние в линейном масштабе: разрез должен
    // читаться как разрез местности, а не как график
    const toX = (r) => plot.x + plot.w / 2 + (r / outer) * (plot.w / 2);
    const toY = (s) => plot.y + (s / (maxS * 1.15)) * plot.h;

    const right = half.map((p) => `${toX(p.r).toFixed(1)},${toY(p.s).toFixed(1)}`);
    const left = [...half].reverse().map((p) => `${toX(-p.r).toFixed(1)},${toY(p.s).toFixed(1)}`);

    // Замкнутый контур: от левого края по кривой и обратно по уровню
    const curve = `M${left.join(' L')} L${right.join(' L')}`;
    const area = `${curve} L${(plot.x + plot.w).toFixed(1)},${plot.y.toFixed(1)} L${plot.x.toFixed(
      1
    )},${plot.y.toFixed(1)} Z`;

    const marker =
      markerR > 0 && markerR <= outer
        ? { x: toX(markerR), y: toY(drawdownAt(markerR)), s: drawdownAt(markerR) }
        : null;

    return {
      hasData: true,
      curve,
      area,
      marker,
      outer,
      maxS,
      wellX: toX(0),
      wellTop: plot.y,
      wellBottom: toY(half[0].s),
      // Подписи прижимаются к краям канвы: у крайнего деления половина
      // надписи иначе уходит за границу и обрывается на середине числа
      ticks: [-1, -0.5, 0.5, 1].map((k) => ({
        x: Math.min(Math.max(toX(k * outer) - 26, 2), width - 54),
        label: formatDistance(Math.abs(k * outer)),
      })),
    };
  }, [Q, T, S, t, markerR, plot]);

  if (!scene.hasData) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: c.plotBg, borderColor: c.border, height: HEIGHT, width },
        ]}
      >
        <Text style={[type.caption, styles.emptyText, { color: c.textSecondary }]}>
          {I18n.t('coneEmpty', {
            defaultValue: 'Заполните дебит, водопроводимость, водоотдачу и время — разрез построится сразу.',
          })}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.canvas, { backgroundColor: c.plotBg, borderColor: c.border, width }]}>
        <Svg width={width} height={HEIGHT}>
          {/* Осушенная часть пласта */}
          <Path d={scene.area} fill={c.primaryAccent} opacity={0.16} />

          {/* Уровень до откачки */}
          <Line
            x1={plot.x}
            y1={plot.y}
            x2={plot.x + plot.w}
            y2={plot.y}
            stroke={c.secondary}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <SvgText x={plot.x + 2} y={plot.y - 8} fill={c.textSecondary} fontSize={10}>
            {I18n.t('coneStaticLevel', { defaultValue: 'уровень до откачки' })}
          </SvgText>

          {/* Ствол скважины — под кривой: она главнее, и пересечение
              не должно её разрывать */}
          <Rect
            x={scene.wellX - 2}
            y={plot.y - 12}
            width={4}
            height={scene.wellBottom - plot.y + 12}
            fill={c.textSecondary}
            opacity={0.55}
          />

          {/* Кривая воронки */}
          <Path d={scene.curve} stroke={c.primaryAccent} strokeWidth={2} fill="none" strokeLinejoin="round" />

          {/* Расчётная точка. Подпись обязательна: радиус влияния — это
              километры, и точка в полусотне метров от скважины иначе
              сливается со стволом, хотя понижение в ней самое интересное */}
          {scene.marker && (
            <G>
              <Line
                x1={scene.marker.x}
                y1={plot.y}
                x2={scene.marker.x}
                y2={scene.marker.y}
                stroke={c.secondary}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <Circle cx={scene.marker.x} cy={scene.marker.y} r={4.5} fill={c.secondary} />
              <SvgText
                x={Math.min(scene.marker.x + 10, plot.x + plot.w - 4)}
                y={scene.marker.y + 4}
                fill={c.secondary}
                fontSize={11}
                textAnchor={scene.marker.x + 10 > plot.x + plot.w - 70 ? 'end' : 'start'}
              >
                {`r = ${formatDistance(markerR)} м · s = ${scene.marker.s.toFixed(2)} м`}
              </SvgText>
            </G>
          )}

          {/* Дно разреза */}
          <Line
            x1={plot.x}
            y1={plot.y + plot.h}
            x2={plot.x + plot.w}
            y2={plot.y + plot.h}
            stroke={c.border}
            strokeWidth={1}
          />
        </Svg>

        {scene.ticks.map((tick, i) => (
          <Text key={`t${i}`} style={[styles.tick, { left: tick.x, color: c.faint }]}>
            {tick.label}
          </Text>
        ))}
        <Text style={[styles.axisName, { color: c.faint }]}>
          {I18n.t('coneAxis', { defaultValue: 'расстояние от скважины, м' })}
        </Text>
      </View>

      <Text style={[type.caption, styles.note, { color: c.textSecondary }]}>
        {I18n.t('coneInfluence', {
          radius: formatDistance(scene.outer),
          defaultValue: 'Радиус влияния ≈ %{radius} м — дальше понижение практически не ощущается.',
        })}
      </Text>
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
  emptyText: {
    textAlign: 'center',
  },
  tick: {
    ...type.numeric,
    position: 'absolute',
    bottom: 14,
    width: 52,
    fontSize: 10,
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
  note: {
    marginTop: spacing.sm,
  },
});
