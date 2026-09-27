/**
 * Главная (home)
 *
 * Воссоздаёт экран из дизайн-прототипа:
 * - герой-карточка откачек (бордовый градиент + кривая понижения): сверху
 *   «Создать откачку», под кривой — «Архив откачек»
 * - плитки: Калькулятор, Полевой дневник, Карты гидроизогипс
 * - баннер десктоп-версии
 *
 * Где искать журнал, набитый на прошлой неделе, с главной было непонятно —
 * на ней была только кнопка «Создать». Архив сначала встал плиткой на место
 * «Примеров и видео», в конце списка; заказчик попросил не разносить
 * создание и архив так далеко — теперь они в одной карточке.
 *
 * @param {Object} navigation - объект навигации React Navigation
 */

import React, { useCallback, useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  StatusBar,
  Linking,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import DrawdownWave from '../components/DrawdownWave';
import AppearIn from '../components/ui/AppearIn';
import PressableScale from '../components/ui/PressableScale';
import { spacing, radius, type, elevation, brandHeader, heroGradient, fontFamily } from '../theme';
import { useContentMaxWidth } from '../lib/appPrefs';
import { siteUrl } from '../lib/siteLinks';
import { countProjects } from '../db/projects';

export default function HomeScreen({ navigation }) {
  const theme = useTheme();
  const c = theme.colors;
  const { locale } = useContext(LanguageContext);
  const { width } = useWindowDimensions();

  // Сколько журналов в архиве. Перечитывается при каждом возврате на
  // главную: журнал могли только что завести или удалить
  const [archived, setArchived] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      countProjects()
        .then((total) => {
          if (active) setArchived(total);
        })
        .catch(() => {
          // База недоступна — плитка остаётся без числа
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const archiveSubtitle = I18n.t('pumpingArchiveSub', {
    defaultValue: 'Ранее созданные журналы',
  });
  const archiveTitle = I18n.t('pumpingArchive', { defaultValue: 'Архив откачек' });

  // На планшетах ограничиваем ширину контента — если в настройках включена
  // «Адаптация под планшет»; выключенная отдаёт содержимому всю ширину
  const isTablet = width >= 700;
  const column = useContentMaxWidth(620);
  const contentMaxWidth = isTablet ? column : undefined;

  const tiles = [
    {
      id: 'calculator',
      title: I18n.t('calculator', { defaultValue: 'Калькулятор' }),
      subtitle: I18n.t('calculatorDesc', { defaultValue: 'Гидрогеологические расчёты' }),
      icon: 'calculate',
      family: 'material',
      tone: c.secondary,
      onPress: () => navigation.navigate('Calculator'),
    },
    {
      id: 'field-diary',
      title: I18n.t('field', { defaultValue: 'Полевой дневник' }),
      subtitle: I18n.t('fieldDesc', { defaultValue: 'Точки наблюдения с координатами' }),
      icon: 'map',
      family: 'material',
      tone: c.primary,
      onPress: () => navigation.navigate('FieldDiary'),
    },
    {
      id: 'maps',
      title: I18n.t('maps', { defaultValue: 'Карты гидроизогипс' }),
      subtitle: I18n.t('mapsDesc', { defaultValue: 'Построение по скважинам' }),
      icon: 'layers',
      family: 'material',
      tone: c.secondary,
      onPress: () => navigation.navigate('Maps'),
    },
  ];

  const renderTile = (tile, index) => (
    // index + 2: герой занимает первые два шага очереди появления
    <AppearIn key={tile.id} index={index + 2}>
      <PressableScale
        style={[styles.tile, elevation.card, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={tile.onPress}
        accessibilityRole="button"
        accessibilityLabel={tile.title}
      >
        <View style={[styles.tileIcon, { backgroundColor: tile.tone }]}>
          {tile.family === 'community' ? (
            <MaterialCommunityIcons name={tile.icon} size={22} color="#FFFFFF" />
          ) : (
            <MaterialIcons name={tile.icon} size={22} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.tileText}>
          <Text style={[styles.tileTitle, { color: c.text }]}>{tile.title}</Text>
          <Text style={[styles.tileSubtitle, { color: c.textSecondary }]}>{tile.subtitle}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={c.faint} />
      </PressableScale>
    </AppearIn>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar backgroundColor={brandHeader} barStyle="light-content" />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.content, contentMaxWidth && { maxWidth: contentMaxWidth }]}>
          {/* Герой откачек: сверху «Создать откачку», под кривой — архив.
              Части — соседние кнопки, а не вложенные: экранный диктор
              находит каждую отдельно */}
          <AppearIn index={1}>
          <View style={[styles.heroWrap, elevation.brandButton]}>
            <LinearGradient
              colors={heroGradient.colors}
              locations={heroGradient.locations}
              start={heroGradient.start}
              end={heroGradient.end}
              style={styles.hero}
            >
              <Pressable
                onPress={() => navigation.navigate('PumpingMain')}
                style={({ pressed }) => pressed && styles.heroPressed}
                accessibilityRole="button"
                accessibilityLabel={I18n.t('createPumping', { defaultValue: 'Создать откачку' })}
              >
                <View style={styles.heroBody}>
                  <View style={styles.heroIcon}>
                    <MaterialCommunityIcons name="water-pump" size={28} color="#FFFFFF" />
                  </View>
                  <View style={styles.heroTextBox}>
                    <Text style={styles.heroTitle}>
                      {I18n.t('createPumping', { defaultValue: 'Создать откачку' })}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      {I18n.t('createPumpingSub', { defaultValue: 'Журнал и обработка ОФР' })}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={26} color="#FFFFFF" />
                </View>
                <DrawdownWave height={58} />
              </Pressable>

              {/* Подложка архива — того же тона, что заливка под кривой:
                  полоса продолжает её, и карточка читается одной. Тот же
                  экран, что у «Создать откачку», но сразу на списке журналов */}
              <Pressable
                onPress={() => navigation.navigate('PumpingMain', { focus: 'archive' })}
                style={({ pressed }) => [styles.heroArchive, pressed && styles.heroPressed]}
                accessibilityRole="button"
                accessibilityLabel={archiveTitle}
              >
                <View style={styles.heroArchiveIcon}>
                  <MaterialIcons name="inventory-2" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.heroTextBox}>
                  <Text style={styles.heroArchiveTitle}>{archiveTitle}</Text>
                  <Text style={styles.heroArchiveSubtitle}>
                    {archived === null ? archiveSubtitle : `${archiveSubtitle} · ${archived}`}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </LinearGradient>
          </View>
          </AppearIn>

          {/* Плитки разделов */}
          <View style={styles.tiles}>{tiles.map(renderTile)}</View>

          {/* Баннер десктоп-версии */}
          <AppearIn index={tiles.length + 2}>
          <PressableScale
            style={[styles.banner, { backgroundColor: c.surfaceSunken, borderColor: c.border }]}
            // Сайт на языке приложения: русская версия лежит в /Ru/
            onPress={() => Linking.openURL(siteUrl(locale))}
            accessibilityRole="link"
            accessibilityLabel={I18n.t('desktopBannerTitle', { defaultValue: 'Версия для Windows' })}
          >
            {/* Баннер собран как обычная плитка: тот же размер значка,
                заголовок и подпись на своих местах. Раньше он выпадал из
                ряда — мелкий логотип и одна серая строка в две строки */}
            <Image
              source={require('../assets/logo-mark.png')}
              style={styles.bannerIcon}
              resizeMode="contain"
            />
            <View style={styles.tileText}>
              <Text style={[styles.tileTitle, { color: c.text }]}>
                {I18n.t('desktopBannerTitle', { defaultValue: 'Версия для Windows' })}
              </Text>
              <Text style={[styles.tileSubtitle, { color: c.textSecondary }]}>
                {I18n.t('desktopBannerSub', { defaultValue: 'Полные расчёты на компьютере' })}
              </Text>
            </View>
            <MaterialIcons name="open-in-new" size={20} color={c.faint} />
          </PressableScale>
          </AppearIn>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 128,
    alignItems: 'center',
  },
  content: { width: '100%' },


  // Герой
  heroWrap: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  hero: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBox: { flex: 1 },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 3,
  },
  heroPressed: {
    opacity: 0.82,
  },
  // Заливка та же, что под кривой в DrawdownWave: полоса архива её продолжает
  heroArchive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  heroArchiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArchiveTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroArchiveSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },

  // Плитки
  tiles: {
    gap: 11,
    marginTop: 18,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { flex: 1 },
  tileTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15.5,
    fontWeight: '700',
  },
  tileSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    marginTop: 1,
  },

  // Баннер
  // Те же отступы и радиус, что у плиток: баннер стоит с ними в одном ряду
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
  },
});
