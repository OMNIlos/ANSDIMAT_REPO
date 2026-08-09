/**
 * Примеры и видео
 *
 * Каталог обучающих материалов АНСДИМАТ: заставка, название, площадка.
 * Нажатие открывает видео во внешнем приложении или браузере.
 *
 * Раньше здесь лежали выдуманные карточки со штриховкой вместо превью и
 * несуществующей длительностью — нажатие показывало «Воспроизведение» и
 * ничего не открывало. Теперь список берётся из каталога сайта.
 *
 * @param {Object} navigation - объект навигации
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Image,
  Linking,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import {
  STUDY_MATERIALS,
  VIDEO_CATEGORIES,
  VIDEO_LESSONS,
  videoHost,
} from '../data/videoLessons';
import AppearIn from '../components/ui/AppearIn';
import PressableScale from '../components/ui/PressableScale';
import { spacing, radius, type, elevation, fontFamily, brandHeader } from '../theme';

const FILTERS = [
  { key: 'all', labelKey: 'filterAll', fallback: 'Все' },
  { key: VIDEO_CATEGORIES.PUMPING, labelKey: 'filterPumping', fallback: 'Обработка ОФР' },
  { key: VIDEO_CATEGORIES.DEWATERING, labelKey: 'filterDewatering', fallback: 'Водопонижение' },
  { key: VIDEO_CATEGORIES.MODELING, labelKey: 'filterModeling', fallback: 'Моделирование' },
];

export default function ExamplesAndVideos() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const contentMaxWidth = width >= 700 ? 620 : undefined;

  const [filter, setFilter] = useState('all');
  // Заставки лежат на сайте: без сети показываем подложку вместо битой картинки
  const [failedThumbs, setFailedThumbs] = useState({});

  const open = (url) => {
    Linking.openURL(url).catch(() => {});
  };

  const videos = VIDEO_LESSONS.filter((v) => filter === 'all' || v.category === filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={brandHeader} barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.content, contentMaxWidth && { maxWidth: contentMaxWidth }]}>
          {/* Фильтр по разделам */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            style={styles.filtersWrap}
          >
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.secondary : colors.surface,
                      borderColor: active ? colors.secondary : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.filterText, { color: active ? '#FFFFFF' : colors.textSecondary }]}
                  >
                    {I18n.t(f.labelKey, { defaultValue: f.fallback })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[type.eyebrow, styles.eyebrow, { color: colors.textSecondary }]}>
            {I18n.t('videoLessons', { defaultValue: 'Видеоуроки' })} · {videos.length}
          </Text>

          <View style={styles.videoList}>
            {videos.map((video, index) => (
              <AppearIn key={video.id} index={index}>
              <PressableScale
                style={[
                  styles.videoCard,
                  elevation.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => open(video.url)}
                accessibilityRole="link"
                accessibilityLabel={video.title}
              >
                <View style={[styles.thumb, { backgroundColor: colors.surfaceSunken }]}>
                  {failedThumbs[video.id] ? (
                    <MaterialIcons name="movie" size={30} color={colors.faint} />
                  ) : (
                    <Image
                      source={{ uri: video.thumb }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      onError={() =>
                        setFailedThumbs((prev) => ({ ...prev, [video.id]: true }))
                      }
                    />
                  )}

                  {/* Затемнение под кнопкой: заставки светлые, белая иконка
                      на них терялась */}
                  <View style={styles.scrim} pointerEvents="none" />

                  <View style={styles.playCircle}>
                    <MaterialIcons name="play-arrow" size={30} color="#FFFFFF" />
                  </View>

                  <View style={styles.hostBadge}>
                    <Text style={styles.hostText}>{videoHost(video.url)}</Text>
                  </View>
                </View>

                <View style={styles.videoBody}>
                  <Text style={[styles.videoTitle, { color: colors.text }]}>{video.title}</Text>
                  <Text style={[styles.videoDesc, { color: colors.textSecondary }]}>
                    {video.description}
                  </Text>
                </View>
              </PressableScale>
              </AppearIn>
            ))}
          </View>

          <Text style={[type.eyebrow, styles.eyebrow, { color: colors.textSecondary }]}>
            {I18n.t('studyMaterials', { defaultValue: 'Материалы' })}
          </Text>

          <View style={styles.materialList}>
            {STUDY_MATERIALS.map((item) => (
              <PressableScale
                key={item.id}
                style={[
                  styles.materialCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => open(item.url)}
                accessibilityRole="link"
                accessibilityLabel={item.title}
              >
                <View style={[styles.materialIcon, { backgroundColor: colors.primaryWash }]}>
                  <MaterialIcons name={item.icon} size={20} color={colors.primaryAccent} />
                </View>
                <View style={styles.materialText}>
                  <Text style={[styles.materialTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.materialDesc, { color: colors.textSecondary }]}>
                    {item.description}
                  </Text>
                </View>
                <MaterialIcons name="open-in-new" size={18} color={colors.faint} />
              </PressableScale>
            ))}
          </View>
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

  filtersWrap: { marginHorizontal: -18, marginBottom: 4 },
  filters: { gap: 8, paddingHorizontal: 18, paddingVertical: 4 },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  filterText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    fontWeight: '700',
  },

  eyebrow: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    marginLeft: 4,
  },

  videoList: { gap: spacing.md },
  videoCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumb: {
    height: 148,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 7, 14, 0.28)',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.round,
    backgroundColor: 'rgba(114,0,47,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#72002F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  hostBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(12,10,13,0.78)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hostText: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  videoBody: { paddingHorizontal: 15, paddingVertical: 13 },
  videoTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  videoDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 12.5,
    marginTop: 3,
  },

  materialList: { gap: spacing.sm },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  materialIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialText: { flex: 1 },
  materialTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 14.5,
    fontWeight: '700',
  },
  materialDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 1,
  },
});
