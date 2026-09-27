/**
 * Заявка на покупку лицензии
 *
 * Форма собирает данные и открывает почтовый клиент письмом в поддержку.
 * Отправки с сервера здесь нет — и именно поэтому важна честная обратная
 * связь: если клиент не открылся, пользователь должен это увидеть, а не
 * гадать, ушла заявка или нет.
 *
 * Вёрстка та же, что на остальных экранах: карточки на поверхности, подпись
 * слева, значение справа, ошибка под своим полем. Раньше экран был собран
 * на компонентах react-native-paper и выглядел чужим среди прочих.
 *
 * Тарифы — Pro, Lite, Net, Edu, как на странице заказа сайта; чем они
 * различаются, объясняет ссылка на неё.
 */

import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import { spacing, radius, type, elevation, fontFamily } from '../theme';
import { useContentMaxWidth } from '../lib/appPrefs';
import { orderUrl } from '../lib/siteLinks';

/** Поля формы: часть обязательна, часть нет */
const FIELDS = [
  { key: 'name', labelKey: 'fullName', fallback: 'ФИО', required: true },
  { key: 'company', labelKey: 'organization', fallback: 'Организация' },
  { key: 'email', labelKey: 'email', fallback: 'E-mail', required: true, keyboard: 'email-address' },
  { key: 'phone', labelKey: 'phone', fallback: 'Телефон', keyboard: 'phone-pad' },
  { key: 'address', labelKey: 'address', fallback: 'Адрес' },
];

/**
 * Тарифы — те же, что на странице заказа сайта. Название тарифа одно на все
 * языки, переводится только пояснение под ним
 */
const LICENSES = [
  { key: 'pro', name: 'Pro', descKey: 'licenseProDesc', fallback: 'Профессиональная' },
  { key: 'lite', name: 'Lite', descKey: 'licenseLiteDesc', fallback: 'Ограниченная' },
  { key: 'net', name: 'Net', descKey: 'licenseNetDesc', fallback: 'Сетевая' },
  { key: 'edu', name: 'Edu', descKey: 'licenseEduDesc', fallback: 'Учебная' },
];

/** Пояснение к тарифу на языке интерфейса */
const licenseDesc = (license) => I18n.t(license.descKey, { defaultValue: license.fallback });

export default function OrderScreen() {
  const theme = useTheme();
  // Колонка 720 px — если включена «Адаптация под планшет»
  const column = useContentMaxWidth(720);
  const c = theme.colors;
  const { locale } = useContext(LanguageContext);

  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    licenseType: 'pro',
    comment: '',
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Ошибка снимается сразу при правке поля, а не после повторной отправки
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const to = locale === 'ru' ? 'support-russia@ansdimat.com' : 'support@ansdimat.com';

  const handleSubmit = async () => {
    // Проверка по полям: раньше все обязательные перечислялись одной строкой
    // в системном диалоге, который в веб-сборке вообще не показывается
    const next = {};
    if (!form.name.trim()) {
      next.name = I18n.t('fieldRequired', { defaultValue: 'Заполните поле' });
    }
    if (!form.email.trim()) {
      next.email = I18n.t('fieldRequired', { defaultValue: 'Заполните поле' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      // Ответить на заявку можно только по почте: опечатка в адресе означает,
      // что заявка потеряна и никто об этом не узнает
      next.email = I18n.t('emailInvalid', { defaultValue: 'Проверьте адрес почты' });
    }

    setErrors(next);
    setStatus(null);
    if (Object.keys(next).length > 0) return;

    const license = LICENSES.find((item) => item.key === form.licenseType);
    const body = [
      `${I18n.t('fullName')}: ${form.name}`,
      `${I18n.t('organization')}: ${form.company}`,
      `${I18n.t('email')}: ${form.email}`,
      `${I18n.t('phone')}: ${form.phone}`,
      `${I18n.t('address')}: ${form.address}`,
      `${I18n.t('licenseType')}: ${license.name} (${licenseDesc(license)})`,
      `${I18n.t('comment')}: ${form.comment}`,
    ].join('\n');

    const mailto = `mailto:${to}?subject=${encodeURIComponent(
      I18n.t('orderTitle')
    )}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (canOpen) {
        await Linking.openURL(mailto);
        setStatus({ ok: true, text: I18n.t('orderThanks', { name: form.name }) });
      } else {
        // Почтового клиента нет — сама заявка никуда не делась, поэтому
        // показываем адрес, на который её можно отправить вручную
        setStatus({ ok: false, text: `${I18n.t('mailClientError')} ${to}` });
      }
    } catch {
      setStatus({ ok: false, text: `${I18n.t('mailSendError')} ${to}` });
    }
  };

  /**
   * Поле ввода с подписью и сообщением об ошибке
   *
   * @param {Object} field - описание поля
   * @param {number} index - позиция, чтобы не рисовать линию над первым
   */
  const renderField = (field, index) => (
    <View key={field.key}>
      <View
        style={[
          styles.field,
          index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
        ]}
      >
        <Text style={[type.body, styles.label, { color: c.text }]}>
          {I18n.t(field.labelKey, { defaultValue: field.fallback })}
          {field.required ? ' *' : ''}
        </Text>
        <TextInput
          value={form[field.key]}
          onChangeText={(value) => handleChange(field.key, value)}
          keyboardType={field.keyboard ?? 'default'}
          autoCapitalize={field.key === 'email' ? 'none' : 'sentences'}
          placeholder="—"
          placeholderTextColor={c.faint}
          style={[styles.input, { color: errors[field.key] ? c.error : c.secondary }]}
        />
      </View>
      {!!errors[field.key] && (
        <Text style={[type.caption, styles.error, { color: c.error }]}>{errors[field.key]}</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: column ?? '100%' }]} keyboardShouldPersistTaps="handled">
        <Text style={[type.caption, styles.intro, { color: c.textSecondary }]}>
          {I18n.t('orderIntro', {
            defaultValue:
              'Заявка откроется письмом в почтовом приложении. Звёздочкой отмечены поля, без которых мы не сможем ответить.',
          })}
        </Text>

        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {FIELDS.map(renderField)}
        </View>

        <Text style={[type.eyebrow, styles.sectionLabel, { color: c.textSecondary }]}>
          {I18n.t('licenseType', { defaultValue: 'Тип лицензии' })}
        </Text>

        <View style={styles.licenseGrid}>
          {LICENSES.map((item) => {
            const active = item.key === form.licenseType;
            const desc = licenseDesc(item);
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => handleChange('licenseType', item.key)}
                style={[
                  styles.licenseChip,
                  {
                    backgroundColor: active ? c.primary : c.surfaceSunken,
                    borderColor: active ? c.primary : c.border,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.name} — ${desc}`}
              >
                <Text style={[styles.licenseName, { color: active ? '#FFFFFF' : c.text }]}>
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.licenseDesc,
                    { color: active ? 'rgba(255,255,255,0.85)' : c.textSecondary },
                  ]}
                >
                  {desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Чем тарифы различаются и сколько стоят — на сайте: цены
            меняются, и держать их в приложении значило бы показывать старые */}
        <TouchableOpacity
          style={styles.tariffsLink}
          onPress={() => Linking.openURL(orderUrl(locale)).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={I18n.t('tariffsLink', { defaultValue: 'Подробнее о тарифах на сайте' })}
        >
          <MaterialIcons name="open-in-new" size={16} color={c.secondary} />
          <Text style={[styles.tariffsLinkText, { color: c.secondary }]}>
            {I18n.t('tariffsLink', { defaultValue: 'Подробнее о тарифах на сайте' })}
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.card,
            elevation.card,
            styles.commentCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <TextInput
            value={form.comment}
            onChangeText={(value) => handleChange('comment', value)}
            placeholder={I18n.t('comment', { defaultValue: 'Комментарий' })}
            placeholderTextColor={c.faint}
            multiline
            style={[styles.comment, { color: c.text }]}
          />
        </View>

        <TouchableOpacity
          style={[styles.submit, elevation.brandButton, { backgroundColor: c.primary }]}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel={I18n.t('submit', { defaultValue: 'Отправить' })}
        >
          <MaterialIcons name="send" size={18} color="#FFFFFF" />
          <Text style={styles.submitText}>{I18n.t('submit', { defaultValue: 'Отправить' })}</Text>
        </TouchableOpacity>

        {!!status && (
          <Text style={[styles.status, { color: status.ok ? c.secondary : c.error }]}>
            {status.text}
          </Text>
        )}

        <View style={{ height: 140 }} />
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
  intro: {
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  label: {
    flexShrink: 1,
    marginRight: spacing.md,
  },
  // Имя, организация, почта и адрес — слова, а не числа: гарнитурой
  // интерфейса. Моноширинная делала заявку похожей на распечатку терминала.
  // Нулевой минимум — чтобы поле на вебе не держало ширину в двадцать знаков
  // и не выдавливало подпись
  input: {
    ...type.body,
    fontFamily: fontFamily.medium,
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    textAlign: 'right',
    paddingVertical: 2,
  },
  error: {
    marginBottom: spacing.sm,
    textAlign: 'right',
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  // Четыре тарифа сеткой два на два: названия короткие, а пояснение под
  // каждым умещается в половину ширины даже на узком телефоне
  licenseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  licenseChip: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  licenseName: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  licenseDesc: {
    marginTop: 2,
    fontSize: 12.5,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
  tariffsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  tariffsLinkText: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
  },
  commentCard: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  comment: {
    ...type.body,
    minHeight: 96,
    textAlignVertical: 'top',
    paddingVertical: spacing.sm,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  status: {
    ...type.body,
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 20,
  },
});
