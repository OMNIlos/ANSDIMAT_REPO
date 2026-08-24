/**
 * Заглушка закрытой подпиской возможности
 *
 * Встаёт ровно туда, где стояла бы сама возможность, и занимает столько же
 * места: так видно, что именно закрыто, а не просто чего-то не хватает.
 *
 * Обязательная часть — строка о том, как обойтись без подписки. Платная
 * функция здесь всегда удобство поверх бесплатного пути (карта вместо ввода
 * расстояний руками), и человек не должен решать, что работа встала.
 *
 * @param {Object} props
 * @param {string} props.title - что закрыто
 * @param {string} props.note - как сделать то же самое без подписки
 * @param {Function} props.onPress - переход к описанию подписки
 * @param {number} [props.height] - высота заглушки: под размер закрытого блока
 * @param {Object|Array} [props.style] - дополнительный стиль
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../../Localization';
import PressableScale from './PressableScale';
import { spacing, radius, type, fontFamily } from '../../theme';

export default function PremiumLock({ title, note, onPress, height, style }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceSunken,
          borderColor: colors.border,
        },
        height ? { minHeight: height } : null,
        style,
      ]}
    >
      <View style={[styles.badge, { backgroundColor: colors.primaryWash }]}>
        <MaterialIcons name="lock-outline" size={20} color={colors.primaryAccent} />
      </View>

      <Text style={[type.cardTitle, styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[type.caption, styles.note, { color: colors.textSecondary }]}>{note}</Text>

      <PressableScale
        onPress={onPress}
        style={[styles.button, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {I18n.t('premiumLearnMore', { defaultValue: 'Подробнее о Premium' })}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.semibold,
    textAlign: 'center',
  },
  note: {
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  button: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  buttonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
