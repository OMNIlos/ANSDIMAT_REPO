/**
 * Тумблер (по дизайн-прототипу)
 *
 * Дорожка 46×27 со скруглением, белая ручка 21×21 плавно сдвигается
 * при переключении. Включённое состояние — бордовая дорожка.
 *
 * @param {boolean} value - состояние
 * @param {Function} onValueChange - вызывается с новым значением
 * @param {string} [accessibilityLabel]
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

export default function Toggle({ value, onValueChange, accessibilityLabel }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });
  const knobX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 22],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.knob, { left: knobX }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 27,
    borderRadius: 16,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    top: 3,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
});
