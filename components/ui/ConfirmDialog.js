/**
 * Диалог подтверждения
 *
 * Заменяет Alert.alert: тот вообще не показывает кнопки в веб-сборке, из-за
 * чего подтверждение не появлялось и удаление молча не выполнялось. Свой
 * диалог работает одинаково на всех платформах и следует оформлению приложения.
 *
 * @param {boolean} visible - показан ли диалог
 * @param {string} title - заголовок
 * @param {string} [message] - пояснение
 * @param {string} [confirmLabel] - подпись подтверждающей кнопки
 * @param {boolean} [destructive] - опасное действие: кнопка красная
 * @param {Function} onConfirm - подтверждение
 * @param {Function} onCancel - отмена
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { AnimatedPressable, useDialogEntrance } from './dialogMotion';
import DialogLayer from './DialogLayer';
import { spacing, radius, fontFamily, elevation, scrim } from '../../theme';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const { colors } = useTheme();
  // Окно чуть подрастает на место вместе с затемнением фона, см. dialogMotion
  const cardMotion = useDialogEntrance(visible);

  return (
    // Слой на весь экран поверх приложения; на Android — без окна Modal,
    // которое открывалось пустым, см. DialogLayer
    <DialogLayer visible={visible} onRequestClose={onCancel}>
      {/* Нажатие мимо окна закрывает его — привычное поведение */}
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <AnimatedPressable
          style={[
            styles.card,
            elevation.raised,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardMotion,
          ]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {!!message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.surfaceSunken }]}
              onPress={onCancel}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                {I18n.t('cancel', { defaultValue: 'Отмена' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: destructive ? colors.errorFill : colors.primary },
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                {confirmLabel || I18n.t('confirm', { defaultValue: 'Подтвердить' })}
              </Text>
            </TouchableOpacity>
          </View>
        </AnimatedPressable>
      </Pressable>
    </DialogLayer>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  buttonText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
