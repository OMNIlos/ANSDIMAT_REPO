/**
 * Контакты
 *
 * Два офиса и техподдержка. Каждая строка — действие: адрес открывает карту,
 * телефон набирает номер, почта открывает письмо.
 *
 * Имён сотрудников здесь нет намеренно — по просьбе заказчика экран говорит
 * от лица офисов, а не людей.
 *
 * Экран заменил ссылку `mailto:` из «Справки»: на телефоне без настроенного
 * почтового клиента она молча не срабатывала, и «Связаться с нами» выглядело
 * как сломанная кнопка. Здесь адреса видны, их можно скопировать вручную.
 */

import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import { spacing, radius, type, elevation, fontFamily } from '../theme';
import { useContentMaxWidth } from '../lib/appPrefs';
import { siteUrl } from '../lib/siteLinks';

/** Адрес международного офиса пишется одинаково на обоих языках */
const AUSTRALIA_ADDRESS = '16 Newton Street, Bayswater 6053, WA, Australia';

/**
 * Ссылка на адрес в картах
 *
 * На Android geo: открывает то картографическое приложение, что стоит у
 * человека, на iOS — Apple Maps, в браузере — OpenStreetMap.
 *
 * @param {string} address - адрес строкой
 * @returns {string} ссылка
 */
function mapUrl(address) {
  const query = encodeURIComponent(address);
  return Platform.select({
    android: `geo:0,0?q=${query}`,
    ios: `https://maps.apple.com/?q=${query}`,
    default: `https://www.openstreetmap.org/search?query=${query}`,
  });
}

/**
 * Открывает ссылку, молча пропуская отказ системы
 *
 * @param {string} url - адрес
 */
function open(url) {
  Linking.openURL(url).catch(() => {
    // Нет приложения для этой схемы — адрес всё равно виден на экране
  });
}

export default function ContactUsScreen() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  // Колонка 720 px — если включена «Адаптация под планшет»
  const column = useContentMaxWidth(720);
  const c = theme.colors;

  const russiaAddress = I18n.t('russiaAddress', {
    defaultValue: 'РФ, Санкт-Петербург, Средний проспект В.О., д.41',
  });

  const offices = [
    {
      key: 'australia',
      title: I18n.t('australiaTitle', { defaultValue: 'Австралия' }),
      office: I18n.t('australiaOffice', { defaultValue: 'Международный офис АНСДИМАТ' }),
      rows: [
        { icon: 'place', label: AUSTRALIA_ADDRESS, url: mapUrl(AUSTRALIA_ADDRESS) },
        { icon: 'phone', label: '+61 478 633 429', url: 'tel:+61478633429' },
        { icon: 'mail-outline', label: 'support@ansdimat.com', url: 'mailto:support@ansdimat.com' },
      ],
    },
    {
      key: 'russia',
      title: I18n.t('russiaTitle', { defaultValue: 'Россия' }),
      office: I18n.t('russiaOffice', { defaultValue: 'Центральный офис разработки АНСДИМАТ' }),
      rows: [
        { icon: 'place', label: russiaAddress, url: mapUrl(russiaAddress) },
        { icon: 'phone', label: '+7 905 268 06 28', url: 'tel:+79052680628' },
        {
          icon: 'mail-outline',
          label: 'support-russia@ansdimat.com',
          url: 'mailto:support-russia@ansdimat.com',
        },
      ],
    },
    {
      key: 'support',
      title: I18n.t('websiteSupport', { defaultValue: 'Сайт и техническая поддержка' }),
      rows: [
        { icon: 'mail-outline', label: 'annik@ansdimat.com', url: 'mailto:annik@ansdimat.com' },
      ],
    },
  ];

  const websiteLabel = I18n.t('goToWebsite', { defaultValue: 'Перейти на сайт' });

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { maxWidth: column ?? '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {offices.map((office) => (
          <View
            key={office.key}
            style={[
              styles.card,
              elevation.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.eyebrow, { color: c.primaryAccent }]}>{office.title}</Text>

            {!!office.office && (
              <Text style={[type.cardTitle, { color: c.text }]}>{office.office}</Text>
            )}

            {/* Линия отделяет адрес, телефон и почту от названия офиса. У
                карточки поддержки названия нет, и линия под одним
                надзаголовком оставляла пустую полосу */}
            <View
              style={[
                styles.rows,
                office.office ? [styles.rowsDivided, { borderTopColor: c.border }] : null,
              ]}
            >
              {office.rows.map((row) => (
                <TouchableOpacity
                  key={row.label}
                  style={styles.row}
                  onPress={() => row.url && open(row.url)}
                  disabled={!row.url}
                  accessibilityRole={row.url ? 'link' : 'text'}
                  accessibilityLabel={row.label}
                >
                  <MaterialIcons name={row.icon} size={18} color={c.secondary} />
                  {/*
                    Строку не обрезаем: почтовый адрес на узком экране занимает
                    три строки, и обрезанный по второй он перестаёт быть адресом.
                    Высота строки здесь ни от чего не зависит — пусть переносится
                  */}
                  <Text style={[styles.rowText, { color: row.url ? c.secondary : c.textSecondary }]}>
                    {row.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Сайт на языке приложения: русская версия лежит в /Ru/ */}
        <TouchableOpacity
          style={[styles.website, elevation.brandButton, { backgroundColor: c.primary }]}
          onPress={() => open(siteUrl(locale))}
          accessibilityRole="link"
          accessibilityLabel={websiteLabel}
        >
          <MaterialIcons name="public" size={18} color="#FFFFFF" />
          <Text style={styles.websiteText}>{websiteLabel}</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...type.eyebrow,
    marginBottom: spacing.sm,
  },
  rows: {
    marginTop: spacing.xs,
  },
  rowsDivided: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.sm,
  },
  rowText: {
    ...type.body,
    flex: 1,
    fontSize: 14,
  },
  website: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  websiteText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
