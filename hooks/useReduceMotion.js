/**
 * Уважение к системной настройке «уменьшить движение»
 *
 * Анимации в приложении декоративные: если человек попросил систему их
 * убавить, показываем конечное состояние сразу. Один хук на всё приложение,
 * чтобы каждая анимация не тянула подписку заново.
 *
 * @returns {boolean} включено ли «уменьшение движения»
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export default function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}
