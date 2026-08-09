/**
 * Подписка
 *
 * Экран переписан под дизайн-систему приложения: раньше здесь были
 * захардкоженные цвета и белые карточки, из-за чего в тёмной теме экран
 * выглядел чужим, а Alert.alert в вебе не показывал кнопок.
 *
 * Тарифы выбираются как сегменты, покупка подтверждается баннером,
 * отмена — общим диалогом подтверждения.
 */

import React, { useCallback, useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import { useEntitlements } from '../billing/EntitlementsContext';
import { useAuth } from '../AuthContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { spacing, radius, type, elevation, fontFamily, heroGradient } from '../theme';

/** Тарифы. Цены в долларах — как в текущем биллинге */
const PLANS = [
  {
    key: 'monthly',
    price: '$9.99',
    periodKey: 'perMonth',
    titleKey: 'monthlySubscription',
  },
  {
    key: 'yearly',
    price: '$99.99',
    periodKey: 'perYear',
    titleKey: 'yearlySubscription',
    recommended: true,
    // 12 × 9.99 − 99.99
    savings: '$19.89',
  },
];

const FEATURES = [
  { icon: 'all-inclusive', key: 'unlimitedProjects' },
  { icon: 'insights', key: 'advancedAnalytics' },
  { icon: 'tune', key: 'advancedFunctionality' },
  { icon: 'file-download', key: 'exportAllFormats' },
];

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { locale } = useContext(LanguageContext);

  const { entitlements, refresh } = useEntitlements();
  const { session } = useAuth();

  const isActive = entitlements.premium;
  const activeType = entitlements.source === 'promo' ? 'promo' : entitlements.source;
  const expiryDate = entitlements.expiresAt ? new Date(entitlements.expiresAt) : null;

  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [cancelAsked, setCancelAsked] = useState(false);

  const contentMaxWidth = width >= 700 ? 620 : undefined;

  const load = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /**
   * Оформление тарифа
   *
   * Покупка идёт через магазин приложений, и подтверждает её сервер по чеку —
   * клиент не может выдать себе премиум сам. Пока платёжный провайдер не
   * подключён, объясняем это прямо, а не имитируем оплату: показывать
   * заказчику фальшивое «оплачено» хуже, чем честную заглушку.
   */
  const purchase = async () => {
    if (!session) {
      setBanner({ kind: 'error', text: I18n.t('subscribeNeedsAccount', {
        defaultValue: 'Войдите в аккаунт: подписка привязывается к учётной записи.',
      }) });
      return;
    }
    setIsLoading(true);
    setBanner(null);
    // Задержка — не имитация запроса, а пауза перед показом объяснения:
    // без неё сообщение появляется раньше, чем палец отпустил кнопку
    setTimeout(() => {
      setIsLoading(false);
      setBanner({ kind: 'info', text: I18n.t('billingPending', {
        defaultValue: 'Оплата подключается через App Store и Google Play. Для доступа сейчас используйте промокод в разделе «Аккаунт».',
      }) });
    }, 400);
  };

  const confirmCancel = async () => {
    setCancelAsked(false);
    setBanner({ kind: 'info', text: I18n.t('cancelViaStore', {
      defaultValue: 'Подписка отменяется в настройках App Store или Google Play — так требуют правила магазинов.',
    }) });
  };

  /**
   * @param {Date|null} date - дата окончания подписки
   * @returns {string} дата в локали интерфейса
   */
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, contentMaxWidth && { maxWidth: contentMaxWidth }]}>
          {/* Герой-блок в фирменном градиенте */}
          <LinearGradient
            colors={heroGradient.colors}
            locations={heroGradient.locations}
            start={heroGradient.start}
            end={heroGradient.end}
            style={[styles.hero, elevation.brandButton]}
          >
            <View style={styles.heroIcon}>
              <MaterialIcons name="workspace-premium" size={26} color="#FFFFFF" />
            </View>
            <Text style={[type.title, styles.heroTitle]}>{I18n.t('subscriptionTitle')}</Text>
            <Text style={[type.caption, styles.heroSubtitle]}>
              {I18n.t('subscriptionDescription')}
            </Text>
          </LinearGradient>

          {/* Текущий статус */}
          <View
            style={[
              styles.card,
              elevation.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[type.eyebrow, { color: colors.textSecondary }]}>
              {I18n.t('currentPlan')}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? colors.success : colors.faint },
                ]}
              />
              <View style={styles.statusBox}>
                <Text style={[type.cardTitle, { color: colors.text }]}>
                  {isActive ? I18n.t('subscriptionActive') : I18n.t('subscriptionInactive')}
                </Text>
                {isActive && !!activeType && (
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    {activeType === 'monthly'
                      ? I18n.t('monthlySubscription')
                      : I18n.t('yearlySubscription')}
                    {expiryDate ? ` · ${I18n.t('subscriptionExpires')} ${formatDate(expiryDate)}` : ''}
                  </Text>
                )}
              </View>
            </View>

            {isActive && (
              <TouchableOpacity
                style={[styles.ghostButton, { borderColor: colors.border }]}
                onPress={() => setCancelAsked(true)}
                accessibilityRole="button"
              >
                <Text style={[styles.ghostButtonText, { color: colors.error }]}>
                  {I18n.t('cancelSubscription')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {!!banner && (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderLeftColor: banner.kind === 'error' ? colors.error : colors.primaryAccent,
                },
              ]}
            >
              <Text style={[type.caption, { color: colors.text }]}>{banner.text}</Text>
            </View>
          )}

          {/* Тарифы */}
          {!isActive && (
            <>
              <Text style={[type.eyebrow, styles.sectionLabel, { color: colors.textSecondary }]}>
                {I18n.t('upgradeToPremium')}
              </Text>

              {PLANS.map((plan) => {
                const selected = plan.key === selectedPlan;
                return (
                  <TouchableOpacity
                    key={plan.key}
                    onPress={() => setSelectedPlan(plan.key)}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.plan,
                      elevation.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: selected ? colors.primaryAccent : colors.border,
                        borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    {plan.recommended && (
                      <View style={[styles.badge, { backgroundColor: colors.primaryAccent }]}>
                        <Text style={styles.badgeText}>{I18n.t('saveWithYearly')}</Text>
                      </View>
                    )}

                    <View style={styles.planHead}>
                      <MaterialIcons
                        name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={selected ? colors.primaryAccent : colors.faint}
                      />
                      <Text style={[type.cardTitle, styles.planTitle, { color: colors.text }]}>
                        {I18n.t(plan.titleKey)}
                      </Text>
                      <View style={styles.priceBox}>
                        <Text style={[type.numeric, styles.price, { color: colors.text }]}>
                          {plan.price}
                        </Text>
                        <Text style={[type.caption, { color: colors.textSecondary }]}>
                          {I18n.t(plan.periodKey)}
                        </Text>
                      </View>
                    </View>

                    {!!plan.savings && (
                      <Text style={[type.caption, styles.savings, { color: colors.primaryAccent }]}>
                        {I18n.t('yearlySavings', {
                          amount: plan.savings,
                          defaultValue: `Экономия ${plan.savings} в год`,
                        })}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[
                  styles.cta,
                  elevation.brandButton,
                  { backgroundColor: colors.primary, opacity: isLoading ? 0.6 : 1 },
                ]}
                onPress={purchase}
                disabled={isLoading}
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>
                  {isLoading ? I18n.t('loading') : I18n.t('subscribe')}
                </Text>
                {!isLoading && <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />}
              </TouchableOpacity>
            </>
          )}

          {/* Что даёт подписка */}
          <Text style={[type.eyebrow, styles.sectionLabel, { color: colors.textSecondary }]}>
            {I18n.t('subscriptionFeatures')}
          </Text>
          <View
            style={[
              styles.card,
              elevation.card,
              { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.md },
            ]}
          >
            {FEATURES.map((feature) => (
              <View key={feature.key} style={styles.feature}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primaryWash }]}>
                  <MaterialIcons name={feature.icon} size={18} color={colors.primaryAccent} />
                </View>
                <Text style={[type.body, styles.featureText, { color: colors.text }]}>
                  {I18n.t(feature.key)}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[type.caption, styles.footer, { color: colors.faint }]}>
            {I18n.t('subscriptionAutoRenew', {
              defaultValue:
                'Подписка продлевается автоматически, если не отменить её не позднее чем за 24 часа до конца оплаченного периода.',
            })}
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={cancelAsked}
        title={I18n.t('cancelSubscription')}
        message={I18n.t('cancelSubscriptionConfirm')}
        confirmLabel={I18n.t('yes')}
        destructive
        onConfirm={confirmCancel}
        onCancel={() => setCancelAsked(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 128,
    alignItems: 'center',
  },
  content: { width: '100%' },

  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroTitle: { color: '#FFFFFF' },
  heroSubtitle: { color: 'rgba(255,255,255,0.82)' },

  card: {
    marginTop: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radius.round,
  },
  statusBox: { flex: 1, gap: 2 },

  ghostButton: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ghostButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
  },

  banner: {
    marginTop: spacing.lg,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    padding: spacing.md,
  },

  sectionLabel: { marginTop: spacing.xl },

  plan: {
    marginTop: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    marginBottom: spacing.md,
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planTitle: { flex: 1 },
  priceBox: { alignItems: 'flex-end' },
  price: {
    fontSize: 20,
    fontWeight: '700',
  },
  savings: {
    marginTop: spacing.sm,
    marginLeft: 36,
    fontWeight: '600',
  },

  cta: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
  },
  ctaText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1 },

  footer: {
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
