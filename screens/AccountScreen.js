/**
 * Аккаунт: синхронизация, пароль, удаление учётной записи
 *
 * Экран открывается для вошедшего пользователя. Здесь собрано всё, что
 * касается серверной части: состояние обмена данными, смена пароля и
 * удаление учётки — последнее обязательно по правилам App Store и Google Play.
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
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { useAuth } from '../AuthContext';
import { useSync } from '../sync/SyncContext';
import { useEntitlements } from '../billing/EntitlementsContext';
import { PREMIUM_ENABLED } from '../billing/config';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PressableScale from '../components/ui/PressableScale';
import AppearIn from '../components/ui/AppearIn';
import { spacing, radius, type, elevation, fontFamily } from '../theme';
import { useContentMaxWidth } from '../lib/appPrefs';

/**
 * Человеческое описание времени последней синхронизации
 *
 * @param {number|null} ms - момент времени
 * @returns {string} подпись
 */
function formatSyncTime(ms) {
  if (!ms) return I18n.t('syncNever', { defaultValue: 'ещё не выполнялась' });
  const diff = Date.now() - ms;
  if (diff < 60_000) return I18n.t('syncJustNow', { defaultValue: 'только что' });
  if (diff < 3_600_000) {
    return I18n.t('syncMinutesAgo', {
      count: Math.round(diff / 60_000),
      defaultValue: `${Math.round(diff / 60_000)} мин назад`,
    });
  }
  return new Date(ms).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function AccountScreen({ navigation }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { user, signOut, changePassword, deleteAccount } = useAuth();
  const { status, lastSyncedAt, pending, conflicts, error, syncNow, resolve } = useSync();
  const { entitlements, redeemPromo } = useEntitlements();

  const [password, setPassword] = useState('');
  const [passwordNote, setPasswordNote] = useState(null);
  const [promo, setPromo] = useState('');
  const [promoNote, setPromoNote] = useState(null);
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // «Адаптация под планшет» в настройках: колонка по центру или вся ширина
  const column = useContentMaxWidth(620);
  const contentMaxWidth = width >= 700 ? column : undefined;

  const handlePassword = async () => {
    if (password.length < 6) {
      setPasswordNote({ ok: false, text: I18n.t('passwordTooShort', { defaultValue: 'Не короче 6 символов' }) });
      return;
    }
    setBusy(true);
    const { error: err } = await changePassword(password);
    setBusy(false);
    setPassword('');
    setPasswordNote(
      err
        ? { ok: false, text: err }
        : { ok: true, text: I18n.t('passwordChanged', { defaultValue: 'Пароль изменён' }) }
    );
  };

  const handlePromo = async () => {
    setBusy(true);
    const res = await redeemPromo(promo);
    setBusy(false);
    setPromo('');
    setPromoNote(
      res.ok
        ? { ok: true, text: I18n.t('promoApplied', { defaultValue: 'Промокод применён' }) }
        : { ok: false, text: res.error }
    );
  };

  const handleDelete = async () => {
    setAskDelete(false);
    setBusy(true);
    const { error: err } = await deleteAccount();
    setBusy(false);
    if (!err) navigation.navigate('Home');
  };

  const syncLabel = {
    syncing: I18n.t('syncInProgress', { defaultValue: 'Синхронизация…' }),
    done: I18n.t('syncUpToDate', { defaultValue: 'Данные актуальны' }),
    conflicts: I18n.t('syncConflicts', { defaultValue: 'Есть расхождения' }),
    error: I18n.t('syncFailed', { defaultValue: 'Не удалось синхронизировать' }),
    notConfigured: I18n.t('syncNotConfigured', { defaultValue: 'Синхронизация не настроена' }),
  }[status] ?? I18n.t('syncIdle', { defaultValue: 'Готово к обмену' });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, contentMaxWidth && { maxWidth: contentMaxWidth }]}>

          {/* Кто вошёл */}
          <AppearIn index={0}>
            <View style={[styles.card, elevation.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.userRow}>
                <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                  <MaterialIcons name="person" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.userText}>
                  <Text style={[type.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {user?.email ?? '—'}
                  </Text>
                  {/* Тариф. Пока премиум выключен, тарифов нет вовсе —
                      «Базовый доступ» намекал бы на платный сверху */}
                  {PREMIUM_ENABLED && (
                    <Text style={[type.caption, { color: colors.textSecondary }]}>
                      {entitlements.premium
                        ? I18n.t('planPremium', { defaultValue: 'Премиум-доступ' })
                        : I18n.t('planBasic', { defaultValue: 'Базовый доступ' })}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </AppearIn>

          {/* Синхронизация */}
          <AppearIn index={1}>
            <Text style={[type.eyebrow, styles.sectionLabel, { color: colors.textSecondary }]}>
              {I18n.t('syncSection', { defaultValue: 'Синхронизация' })}
            </Text>
            <View style={[styles.card, elevation.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.syncRow}>
                <View style={styles.syncText}>
                  <Text style={[type.body, { color: colors.text }]}>{syncLabel}</Text>
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    {I18n.t('syncLast', { defaultValue: 'Последний обмен' })}: {formatSyncTime(lastSyncedAt)}
                    {pending > 0 && ` · ${I18n.t('syncPending', { defaultValue: 'ждут отправки' })}: ${pending}`}
                  </Text>
                </View>
                {status === 'syncing' ? (
                  <ActivityIndicator color={colors.primaryAccent} />
                ) : (
                  <TouchableOpacity
                    onPress={syncNow}
                    style={[styles.syncButton, { backgroundColor: colors.primaryWash }]}
                    accessibilityRole="button"
                    accessibilityLabel={I18n.t('syncNow', { defaultValue: 'Синхронизировать' })}
                  >
                    <MaterialIcons name="sync" size={20} color={colors.primaryAccent} />
                  </TouchableOpacity>
                )}
              </View>

              {!!error && (
                <Text style={[type.caption, styles.note, { color: colors.error }]}>{error}</Text>
              )}
            </View>
          </AppearIn>

          {/* Расхождения между устройствами */}
          {conflicts.length > 0 && (
            <AppearIn index={2}>
              <Text style={[type.eyebrow, styles.sectionLabel, { color: colors.textSecondary }]}>
                {I18n.t('conflictsSection', { defaultValue: 'Расхождения' })}
              </Text>
              {conflicts.map((c) => (
                <View
                  key={`${c.table}-${c.id}`}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[type.body, { color: colors.text }]}>
                    {I18n.t('conflictQuestion', {
                      defaultValue: 'Запись изменена и здесь, и на другом устройстве. Какую версию оставить?',
                    })}
                  </Text>
                  <View style={styles.conflictActions}>
                    <TouchableOpacity
                      onPress={() => resolve(c, 'local')}
                      style={[styles.conflictButton, { backgroundColor: colors.primary }]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.conflictButtonText}>
                        {I18n.t('keepLocal', { defaultValue: 'Эту' })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => resolve(c, 'remote')}
                      style={[styles.conflictButton, { backgroundColor: colors.surfaceSunken }]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.conflictButtonText, { color: colors.text }]}>
                        {I18n.t('keepRemote', { defaultValue: 'С другого устройства' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </AppearIn>
          )}

          {/* Промокод. Скрыт вместе с премиумом: открывать ему нечего,
              все возможности и так доступны */}
          {PREMIUM_ENABLED && (
            <AppearIn index={3}>
              <Text style={[type.eyebrow, styles.sectionLabel, { color: colors.textSecondary }]}>
                {I18n.t('promoSection', { defaultValue: 'Промокод' })}
              </Text>
              <View style={[styles.card, elevation.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  value={promo}
                  onChangeText={setPromo}
                  autoCapitalize="characters"
                  placeholder={I18n.t('promoPlaceholder', { defaultValue: 'Код от партнёра' })}
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                />
                <PressableScale
                  onPress={handlePromo}
                  disabled={busy || !promo.trim()}
                  style={[styles.button, { backgroundColor: colors.primary, opacity: promo.trim() ? 1 : 0.5 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>
                    {I18n.t('promoApply', { defaultValue: 'Применить' })}
                  </Text>
                </PressableScale>
                {!!promoNote && (
                  <Text style={[type.caption, styles.note, { color: promoNote.ok ? colors.success : colors.error }]}>
                    {promoNote.text}
                  </Text>
                )}
              </View>
            </AppearIn>
          )}

          {/* Пароль */}
          <AppearIn index={4}>
            <Text style={[type.eyebrow, styles.sectionLabel, { color: colors.textSecondary }]}>
              {I18n.t('passwordSection', { defaultValue: 'Пароль' })}
            </Text>
            <View style={[styles.card, elevation.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={I18n.t('newPassword', { defaultValue: 'Новый пароль' })}
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              />
              <PressableScale
                onPress={handlePassword}
                disabled={busy || !password}
                style={[styles.button, { backgroundColor: colors.primary, opacity: password ? 1 : 0.5 }]}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>
                  {I18n.t('changePassword', { defaultValue: 'Сменить пароль' })}
                </Text>
              </PressableScale>
              {!!passwordNote && (
                <Text style={[type.caption, styles.note, { color: passwordNote.ok ? colors.success : colors.error }]}>
                  {passwordNote.text}
                </Text>
              )}
            </View>
          </AppearIn>

          {/* Опасная зона */}
          <AppearIn index={5}>
            <Text style={[type.eyebrow, styles.sectionLabel, { color: colors.textSecondary }]}>
              {I18n.t('dangerSection', { defaultValue: 'Управление учётной записью' })}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={signOut}
                style={[styles.ghostButton, { borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <Text style={[styles.ghostText, { color: colors.text }]}>
                  {I18n.t('exit', { defaultValue: 'Выход' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAskDelete(true)}
                style={[styles.ghostButton, { borderColor: colors.border, marginTop: spacing.sm }]}
                accessibilityRole="button"
              >
                <Text style={[styles.ghostText, { color: colors.error }]}>
                  {I18n.t('deleteAccount', { defaultValue: 'Удалить аккаунт' })}
                </Text>
              </TouchableOpacity>

              <Text style={[type.caption, styles.note, { color: colors.textSecondary }]}>
                {I18n.t('deleteAccountHint', {
                  defaultValue: 'Журналы и точки останутся на этом устройстве. С сервера данные будут удалены безвозвратно.',
                })}
              </Text>
            </View>
          </AppearIn>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={askDelete}
        title={I18n.t('deleteAccountTitle', { defaultValue: 'Удалить аккаунт?' })}
        message={I18n.t('deleteAccountMessage', {
          defaultValue: 'Учётная запись и все данные на сервере будут удалены без возможности восстановления.',
        })}
        confirmLabel={I18n.t('delete', { defaultValue: 'Удалить' })}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setAskDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 128, alignItems: 'center' },
  content: { width: '100%' },

  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.md },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48, height: 48, borderRadius: radius.round,
    alignItems: 'center', justifyContent: 'center',
  },
  userText: { flex: 1, gap: 2 },

  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  syncText: { flex: 1, gap: 2 },
  syncButton: {
    width: 40, height: 40, borderRadius: radius.round,
    alignItems: 'center', justifyContent: 'center',
  },

  conflictActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  conflictButton: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.pill,
  },
  conflictButtonText: {
    fontFamily: fontFamily.bold, fontSize: 14, fontWeight: '700', color: '#FFFFFF',
  },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 15,
  },
  button: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  buttonText: {
    fontFamily: fontFamily.bold, fontSize: 15, fontWeight: '700', color: '#FFFFFF',
  },
  ghostButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ghostText: { fontFamily: fontFamily.bold, fontSize: 15, fontWeight: '700' },
  note: { marginTop: spacing.sm },
});
