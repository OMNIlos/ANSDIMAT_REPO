/**
 * Логотип-«кардиограмма» АНСДИМАТ
 *
 * Тонкая ломаная в стиле кардиограммы — фирменный знак в топ-баре.
 * Путь взят из дизайн-прототипа без изменений.
 *
 * Линия прорисовывается слева направо при появлении экрана. Приём тот же,
 * что в прототипе: длина штриха равна длине пути, а смещение штриха уходит
 * от полной длины к нулю — линия будто вычерчивается пером самописца.
 *
 * Анимация на Reanimated: обычный Animated в вебе прогоняет SVG-атрибуты
 * через setNativeProps, который react-native-svg там не поддерживает, и
 * линия появлялась рывком в конце вместо плавной отрисовки.
 *
 * @param {number} width - ширина, px
 * @param {number} height - высота, px
 * @param {string} color - цвет линии
 * @param {number} strokeWidth - толщина линии
 * @param {boolean} animate - прорисовывать ли линию при появлении
 * @param {number} duration - длительность прорисовки, мс
 */

import React, { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Длина штриха в единицах viewBox. Фактическая длина ломаной — 356.3;
 * берём с запасом, иначе при нулевом прогрессе хвост кривой остаётся видимым.
 */
const PATH_LENGTH = 360;

const LOGO_PATH =
  'M0,42H11.5L23,28l8.5,21L45,25l3,9.5,15.5,5,11-23L86,46.5l17.5-7,5,9.5,12-49L127,39.5l8-19L141.5,42l13-26.5';

export default function CardiogramLogo({
  width = 66,
  height = 22,
  color = '#FFFFFF',
  strokeWidth = 3,
  animate = true,
  duration = 1400,
}) {
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      return undefined;
    }

    let cancelled = false;

    // При включённом «уменьшении движения» показываем линию сразу
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        progress.value = 1;
        return;
      }
      progress.value = 0;
      progress.value = withTiming(1, { duration, easing: Easing.out(Easing.ease) });
    });

    return () => {
      cancelled = true;
    };
  }, [animate, duration, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LENGTH * (1 - progress.value),
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 155.398 52.038" fill="none">
      <AnimatedPath
        d={LOGO_PATH}
        transform="translate(0 0.238)"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={PATH_LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
