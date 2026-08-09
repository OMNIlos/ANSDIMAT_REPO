/**
 * Контакты
 *
 * Три представительства и общая поддержка. Каждая строка — действие: почта
 * открывает письмо, телефон набирает номер, имя ведёт в профиль.
 *
 * Экран заменил ссылку `mailto:` из «Справки»: на телефоне без настроенного
 * почтового клиента она молча не срабатывала, и «Связаться с нами» выглядело
 * как сломанная кнопка. Здесь адреса видны, их можно скопировать вручную.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { spacing, radius, type, elevation, fontFamily } from '../theme';

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
  const c = theme.colors;

  const offices = [
    {
      key: 'australia',
      title: I18n.t('australiaTitle', { defaultValue: 'Австралия' }),
      person: I18n.t('anastasiaBoronina', { defaultValue: 'Анастасия Боронина' }),
      personUrl: 'https://www.linkedin.com/in/anastasia-boronina-48884431',
      org: I18n.t('nevaGroundwaterConsulting', { defaultValue: 'Neva Groundwater Consulting' }),
      rows: [
        { icon: 'phone', label: '+61 478 633 429', url: 'tel:+61478633429' },
        { icon: 'mail-outline', label: 'support@ansdimat.com', url: 'mailto:support@ansdimat.com' },
      ],
    },
    {
      key: 'russia',
      title: I18n.t('russiaTitle', { defaultValue: 'Россия' }),
      person: I18n.t('antonNikulenkov', { defaultValue: 'Антон Никуленков' }),
      personUrl: 'https://www.linkedin.com/in/anton-nikulenkov-274157a5/',
      org: I18n.t('instituteOfGeoecology', { defaultValue: 'Институт геоэкологии РАН' }),
      rows: [
        { icon: 'place', label: I18n.t('russiaAddress', { defaultValue: 'Санкт-Петербург' }) },
        {
          icon: 'mail-outline',
          label: 'support-russia@ansdimat.com',
          url: 'mailto:support-russia@ansdimat.com',
        },
      ],
    },
    {
      key: 'support',
      title: I18n.t('websiteSupport', { defaultValue: 'Поддержка сайта' }),
      rows: [
        { icon: 'mail-outline', label: 'info@ansdimat.com', url: 'mailto:info@ansdimat.com' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

            {!!office.person && (
              <TouchableOpacity
                onPress={() => office.personUrl && open(office.personUrl)}
                disabled={!office.personUrl}
                accessibilityRole={office.personUrl ? 'link' : 'text'}
              >
                <Text style={[type.cardTitle, { color: c.text }]}>{office.person}</Text>
              </TouchableOpacity>
            )}
            {!!office.org && (
              <Text style={[type.caption, styles.org, { color: c.textSecondary }]}>
                {office.org}
              </Text>
            )}

            <View style={[styles.rows, { borderTopColor: c.border }]}>
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

        <TouchableOpacity
          style={[styles.website, elevation.brandButton, { backgroundColor: c.primary }]}
          onPress={() => open('https://www.ansdimat.com/')}
          accessibilityRole="link"
        >
          <MaterialIcons name="public" size={18} color="#FFFFFF" />
          <Text style={styles.websiteText}>
            {I18n.t('goToWebsite', { defaultValue: 'Перейти на сайт' })}
          </Text>
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
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  org: {
    marginTop: 2,
  },
  rows: {
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
    fontSize: 15,
    fontWeight: '700',
  },
});
