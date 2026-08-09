/**
 * Экран загрузки (Splash Screen)
 *
 * Композиция по макету заказчика: логотип со скруглёнными углами, название,
 * тонкая линия, слоган; внизу — адрес сайта и копирайт с текущим годом.
 *
 * Год подставляется автоматически, поэтому его не нужно править вручную
 * каждый январь.
 *
 * Появление собрано одной последовательностью — логотип, затем название
 * и слоган: спокойный вход вместо набора разрозненных эффектов.
 *
 * Системный экран запуска (expo-splash-screen) показывает тот же знак того же
 * размера на том же фоне и прячется, когда этот экран уже отрисован. Раньше
 * пользователь видел две разные заставки подряд — системную и эту.
 *
 * @param {Function} onFinish - Вызывается по истечении таймера показа
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import * as NativeSplash from 'expo-splash-screen';
import I18n from '../Localization';
import DrawdownCurve from './DrawdownCurve';
import { palette, spacing, type } from '../theme';

const SPLASH_DURATION = 2200;

export default function SplashScreen({ onFinish }) {
  const currentYear = new Date().getFullYear();

  const logoAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  // Системная заставка убирается только после первой отрисовки этой —
  // иначе между ними мелькает пустой экран
  useEffect(() => {
    NativeSplash.hideAsync().catch(() => {
      // Уже скрыта — не ошибка
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Уважаем системную настройку «уменьшить движение»
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;

      if (reduceMotion) {
        logoAnim.setValue(1);
        textAnim.setValue(1);
        return;
      }

      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textAnim, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });

    const timer = setTimeout(onFinish, SPLASH_DURATION);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onFinish, logoAnim, textAnim]);

  const rise = (anim) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={palette.wine} barStyle="light-content" />

      {/* Кривая понижения — фирменный фон, приглушённый до фактуры */}
      <View style={styles.ambient} pointerEvents="none">
        <DrawdownCurve
          width="100%"
          height={220}
          color="#FFFFFF"
          opacity={0.16}
          grid
          stretch
          strokeWidth={0.8}
        />
      </View>

      <View style={styles.center}>
        <Animated.View style={rise(logoAnim)}>
          <Image
            source={require('../assets/splash-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={I18n.t('homeTitle', { defaultValue: 'АНСДИМАТ' })}
          />
        </Animated.View>

        <Animated.View style={[styles.titleBlock, rise(textAnim)]}>
          <Text style={styles.appName}>
            {I18n.t('homeTitle', { defaultValue: 'АНСДИМАТ' })}
          </Text>

          <View style={styles.rule} />

          <Text style={styles.subtitle}>
            {I18n.t('appSubtitle', { defaultValue: 'полевой калькулятор гидрогеолога' })}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.website}>ansdimat.com</Text>
        <Text style={styles.copyright}>
          © {currentYear} {I18n.t('homeTitle', { defaultValue: 'АНСДИМАТ' })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.wine,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  ambient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 132,
    height: 132,
    borderRadius: 30,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  appName: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'stretch',
    marginVertical: spacing.md,
  },
  subtitle: {
    ...type.body,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  website: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: spacing.xs,
  },
  copyright: {
    ...type.numeric,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
  },
});
