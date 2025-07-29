import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import { ThemeContext } from '../ThemeContext';
import { getThemeSwitchLabel } from '../theme.js';

export default function SettingsScreen() {
  const { locale, toggleLanguage } = useContext(LanguageContext);
  const { themeMode, toggleTheme } = useContext(ThemeContext);
  const theme = useTheme();

  const settingsGroups = [
    {
      title: I18n.t('appearance', { defaultValue: 'Внешний вид' }),
      items: [
        {
          title: I18n.t('theme', { defaultValue: 'Тема' }),
          subtitle: getThemeSwitchLabel(themeMode, locale),
          type: 'switch',
          value: themeMode === 'dark',
          onToggle: toggleTheme,
          icon: themeMode === 'dark' ? '🌙' : '☀️',
        },
      ],
    },
    {
      title: I18n.t('language', { defaultValue: 'Язык' }),
      items: [
        {
          title: I18n.t('appLanguage', { defaultValue: 'Язык приложения' }),
          subtitle: locale === 'ru' ? 'Русский' : 'English',
          type: 'button',
          onPress: toggleLanguage,
          icon: '🌐',
        },
      ],
    },
    {
      title: I18n.t('about', { defaultValue: 'О приложении' }),
      items: [
        {
          title: I18n.t('version', { defaultValue: 'Версия' }),
          subtitle: '1.0.0',
          type: 'info',
          icon: 'ℹ️',
        },
        {
          title: I18n.t('website', { defaultValue: 'Сайт' }),
          subtitle: 'ansdimat.com',
          type: 'info',
          icon: '🌐',
        },
      ],
    },
  ];

  const renderSettingItem = (item, index) => {
    return (
      <View key={index} style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.settingContent}>
          <View style={styles.settingLeft}>
            <Text style={styles.settingIcon}>{item.icon}</Text>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text }]}>
                {item.subtitle}
              </Text>
            </View>
          </View>
          
          {item.type === 'switch' && (
            <Switch
              value={item.value}
              onValueChange={item.onToggle}
              trackColor={{ false: '#E0E0E0', true: theme.colors.primary + '40' }}
              thumbColor={item.value ? theme.colors.primary : '#F4F3F4'}
            />
          )}
          
          {item.type === 'button' && (
            <TouchableOpacity
              style={[styles.settingButton, { borderColor: theme.colors.border }]}
              onPress={item.onPress}
            >
              <Text style={[styles.settingButtonText, { color: theme.colors.primary }]}>
                {I18n.t('change', { defaultValue: 'Изменить' })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderSettingGroup = (group, groupIndex) => {
    return (
      <View key={groupIndex} style={styles.settingGroup}>
        <Text style={[styles.groupTitle, { color: theme.colors.primary }]}>
          {group.title}
        </Text>
        <View style={[styles.groupContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {group.items.map((item, index) => renderSettingItem(item, index))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Группы настроек */}
        {settingsGroups.map((group, index) => renderSettingGroup(group, index))}

        {/* Информационная секция */}
        <View style={styles.infoSection}>
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            {I18n.t('settingsInfo', { 
              defaultValue: 'Изменения настроек применяются немедленно и сохраняются автоматически.' 
            })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
  },
  settingGroup: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  groupContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  settingButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: 'rgba(128, 0, 32, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
    marginBottom: 40,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    textAlign: 'center',
  },
}); 