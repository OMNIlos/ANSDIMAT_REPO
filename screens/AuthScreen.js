/**
 * Вход и регистрация
 *
 * Один экран с переключателем «Вход / Регистрация»: форма одинаковая, меняется
 * только действие — лишний переход между двумя почти идентичными экранами
 * в поле только мешает.
 *
 * Аккаунт нужен лишь для синхронизации между устройствами: без него приложение
 * работает полностью локально, и об этом сказано прямо на экране.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import Segmented from '../components/ui/Segmented';
import { useAuth } from '../AuthContext';
import { fontFamily, spacing, radius, elevation } from '../theme';

export default function AuthScreen({ navigation }) {
  const { colors } = useTheme();
  const { signIn, signUp, resetPassword, configured } = useAuth();
  const { width } = useWindowDimensions();
  const contentMaxWidth = width >= 700 ? 520 : undefined;

  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isSignUp = mode === 'signUp';

  /**
   * Отправляет письмо со ссылкой на смену пароля
   *
   * Отдельно от входа: пользователь уже ввёл почту, второй раз спрашивать
   * её незачем.
   */
  const handleForgot = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError(I18n.t('enterEmailFirst', { defaultValue: 'Введите адрес почты' }));
      return;
    }
    setBusy(true);
    const { error: err } = await resetPassword(email);
    setBusy(false);
    if (err) setError(err);
    else {
      setNotice(I18n.t('resetSent', {
        defaultValue: 'Письмо со ссылкой отправлено. Проверьте почту.',
      }));
    }
  };

  const handleSubmit = async () => {
    setError('');
    setNotice('');

    if (!email.trim() || !password) {
      setError(I18n.t('authFillFields', { defaultValue: 'Заполните почту и пароль' }));
      return;
    }

    setBusy(true);
    const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.needsConfirmation) {
      setNotice(
        I18n.t('authCheckEmail', {
          defaultValue: 'Подтвердите адрес по ссылке из письма, затем войдите',
        })
      );
      setMode('signIn');
      return;
    }

    // Успешный вход — возвращаемся туда, откуда пришли
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.content, contentMaxWidth && { maxWidth: contentMaxWidth }]}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
            {I18n.t('accountSection', { defaultValue: 'Аккаунт' })}
          </Text>

          <View style={[styles.card, elevation.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Segmented
              options={[
                { key: 'signIn', label: I18n.t('signIn', { defaultValue: 'Вход' }) },
                { key: 'signUp', label: I18n.t('signUp', { defaultValue: 'Регистрация' }) },
              ]}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError('');
                setNotice('');
              }}
            />

            <View style={styles.fields}>
              <Text style={[styles.label, { color: colors.text }]}>
                {I18n.t('email', { defaultValue: 'Почта' })}
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="geolog@example.com"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              />

              <Text style={[styles.label, { color: colors.text }]}>
                {I18n.t('password', { defaultValue: 'Пароль' })}
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                textContentType={isSignUp ? 'newPassword' : 'password'}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              />
            </View>

            {!!error && (
              <View style={styles.message}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={[styles.messageText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            {!!notice && (
              <View style={styles.message}>
                <MaterialIcons name="mark-email-unread" size={16} color={colors.secondary} />
                <Text style={[styles.messageText, { color: colors.secondary }]}>{notice}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submit,
                elevation.brandButton,
                { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={busy}
              accessibilityRole="button"
              // Метка отличает кнопку отправки от одноимённой вкладки:
              // по одному тексту их не различить ни человеку, ни скринридеру
              accessibilityLabel={
                isSignUp
                  ? I18n.t('signUpAction', { defaultValue: 'Зарегистрироваться' })
                  : I18n.t('signInAction', { defaultValue: 'Войти' })
              }
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {isSignUp
                      ? I18n.t('signUp', { defaultValue: 'Регистрация' })
                      : I18n.t('signIn', { defaultValue: 'Вход' })}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {!isSignUp && (
              <TouchableOpacity
                onPress={handleForgot}
                style={styles.forgot}
                accessibilityRole="button"
                disabled={busy}
              >
                <Text style={[styles.forgotText, { color: colors.primaryAccent }]}>
                  {I18n.t('forgotPassword', { defaultValue: 'Забыли пароль?' })}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Синхронизация — дополнение, а не условие работы */}
          <View style={[styles.note, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
            <MaterialIcons
              name={configured ? 'cloud-sync' : 'cloud-off'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              {configured
                ? I18n.t('accountPurpose', {
                    defaultValue:
                      'Аккаунт нужен, чтобы журналы и точки были на всех ваших устройствах. Без входа приложение работает локально.',
                  })
                : I18n.t('syncNotConfiguredHint', {
                    defaultValue:
                      'Синхронизация не настроена: не заданы ключи сервера. Приложение работает локально.',
                  })}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'center', marginTop: spacing.md, paddingVertical: spacing.xs },
  forgotText: { fontFamily: fontFamily.semibold, fontSize: 14, fontWeight: '600' },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 128,
    alignItems: 'center',
  },
  content: { width: '100%' },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  fields: { gap: spacing.sm },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  messageText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minHeight: 48,
  },
  submitText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
