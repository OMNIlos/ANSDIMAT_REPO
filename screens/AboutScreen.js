/**
 * Справка / О приложении (about)
 *
 * Воссоздаёт экран из дизайн-прототипа:
 * - логотип, название, слоган, пилюля версии
 * - список ссылок (руководство, видеоуроки, контакты, сайт)
 * - подпись о локальном хранении данных
 *
 * Год в пилюле версии подставляется автоматически.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { fontFamily, brandHeader } from '../theme';

export default function AboutScreen({ navigation }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const contentMaxWidth = width >= 700 ? 620 : undefined;
  const year = new Date().getFullYear();

  const rows = [
    {
      key: 'manual',
      icon: 'menu-book',
      label: I18n.t('aboutManual', { defaultValue: 'Руководство пользователя' }),
      onPress: () => navigation.navigate('UserManual'),
    },
    {
      key: 'videos',
      icon: 'ondemand-video',
      label: I18n.t('aboutVideos', { defaultValue: 'Видеоуроки' }),
      onPress: () => navigation.navigate('ExamplesAndVideos'),
    },
    {
      key: 'contact',
      icon: 'mail',
      label: I18n.t('aboutContact', { defaultValue: 'Связаться с нами' }),
      // Раньше здесь была ссылка mailto: на телефоне без настроенного
      // почтового клиента она молча не срабатывала. Экран контактов
      // показывает адреса, и их можно скопировать вручную
      onPress: () => navigation.navigate('ContactUs'),
    },
    {
      // Экран заявки был зарегистрирован в навигаторе, но попасть на него
      // было неоткуда: ни одной кнопки во всём приложении на него не вело
      key: 'order',
      icon: 'shopping-cart',
      label: I18n.t('orderLicense', { defaultValue: 'Заказать лицензию' }),
      onPress: () => navigation.navigate('Order'),
    },
    {
      key: 'site',
      icon: 'public',
      label: 'ansdimat.com',
      onPress: () => Linking.openURL('https://www.ansdimat.com/'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={brandHeader} barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.content, contentMaxWidth && { maxWidth: contentMaxWidth }]}>
          <View style={styles.head}>
            {/* Знак АНСДИМАТ. Прежний Logo_main.png был 36×36 и расплывался —
                logo-mark.png отрисован в 256 px */}
            <Image source={require('../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.title, { color: colors.text }]}>
              {I18n.t('homeTitle', { defaultValue: 'АНСДИМАТ' })}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {I18n.t('appSubtitle', { defaultValue: 'полевой калькулятор гидрогеолога' })}
            </Text>
            <View style={[styles.versionPill, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
              <Text style={[styles.versionText, { color: colors.textSecondary }]}>
                {I18n.t('versionLabel', { defaultValue: 'версия' })} 1.0.0 · 1993–{year}
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {rows.map((row, i) => (
              <TouchableOpacity
                key={row.key}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
                onPress={row.onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={row.label}
              >
                <MaterialIcons name={row.icon} size={22} color={colors.secondary} />
                <Text style={[styles.rowLabel, { color: colors.text }]}>{row.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.faint} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.footer, { color: colors.faint }]}>
            {I18n.t('aboutLocalData', {
              defaultValue: '© АНСДИМАТ. Все данные хранятся локально на устройстве.',
            })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 128,
    alignItems: 'center',
  },
  content: { width: '100%' },

  logo: { width: 76, height: 76 },
  head: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 14,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 14,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13.5,
    marginTop: 4,
  },
  versionPill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  versionText: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 11.5,
    fontWeight: '600',
  },

  card: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#14070E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 14.5,
    fontWeight: '600',
  },

  footer: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 22,
    lineHeight: 18,
  },
});
