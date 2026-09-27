/**
 * Справка / О приложении (about)
 *
 * Воссоздаёт экран из дизайн-прототипа:
 * - логотип, название, слоган, имя релиза и пилюля версии
 * - список ссылок (руководство, контакты, лицензия, сайт)
 * - подпись о локальном хранении данных
 *
 * Год в пилюле версии подставляется автоматически, номер версии — из
 * app.json (см. lib/release.js).
 *
 * Видеоуроков здесь больше нет: они лежат на сайте, куда ведёт последняя
 * строка, и отдельный экран в приложении только дублировал его.
 */

import React, { useContext } from 'react';
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
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import { fontFamily, brandHeader } from '../theme';
import { useContentMaxWidth } from '../lib/appPrefs';
import { RELEASE_NAME, RELEASE_VERSION } from '../lib/release';
import { siteUrl } from '../lib/siteLinks';

export default function AboutScreen({ navigation }) {
  const { colors } = useTheme();
  const { locale } = useContext(LanguageContext);
  const { width } = useWindowDimensions();
  // «Адаптация под планшет» в настройках: колонка по центру или вся ширина
  const column = useContentMaxWidth(620);
  const contentMaxWidth = width >= 700 ? column : undefined;

  const rows = [
    {
      key: 'manual',
      icon: 'menu-book',
      label: I18n.t('aboutManual', { defaultValue: 'Руководство пользователя' }),
      onPress: () => navigation.navigate('UserManual'),
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
      // Уводит из приложения в браузер — значок «наружу», как у баннера
      // десктоп-версии на главной, а не шеврон перехода внутрь. Версия
      // сайта — на языке приложения
      external: true,
      onPress: () => Linking.openURL(siteUrl(locale)),
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
            {/* Имя релиза и номер версии — одной строкой: на узком экране
                пилюли переносятся по центру, а не обрезаются */}
            <View style={styles.releaseRow}>
              <View
                style={[styles.releaseChip, { backgroundColor: colors.primaryWash }]}
                accessible
                accessibilityLabel={I18n.t('releaseLabel', {
                  name: RELEASE_NAME,
                  version: RELEASE_VERSION,
                  defaultValue: `Релиз ${RELEASE_NAME}, версия ${RELEASE_VERSION}`,
                })}
              >
                <MaterialCommunityIcons name="flower-outline" size={15} color={colors.primaryAccent} />
                <Text style={[styles.releaseText, { color: colors.primaryAccent }]}>{RELEASE_NAME}</Text>
              </View>
              <View style={[styles.versionPill, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
                <Text style={[styles.versionText, { color: colors.textSecondary }]}>
                  {I18n.t('versionLabel', { defaultValue: 'версия' })} {RELEASE_VERSION}
                </Text>
              </View>
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
                <MaterialIcons
                  name={row.external ? 'open-in-new' : 'chevron-right'}
                  size={row.external ? 18 : 20}
                  color={colors.faint}
                />
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
  releaseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  releaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  releaseText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  versionPill: {
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

  // Ширина подвала ограничена, чтобы две строки легли поровну, а не
  // «…работают без» и одинокое «связи.» на второй
  footer: {
    alignSelf: 'center',
    maxWidth: 300,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 22,
    lineHeight: 18,
  },
});
