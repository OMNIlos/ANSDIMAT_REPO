import React, { useContext } from "react";
import { View, StyleSheet, ScrollView, Linking, TouchableOpacity } from "react-native";
import { Text, Button, Card, Surface, Chip } from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from "../Localization";
import { LanguageContext } from "../LanguageContext";
import { useTheme } from "react-native-paper";

export default function ExamplesAndVideosScreen() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);

  const handleLinkOpen = (url) => {
    Linking.openURL(url);
  };

  const examples = [
    {
      id: 1,
      title: I18n.t("pumpTestTitle"),
      description: I18n.t("pumpTestDescription"),
      url: "https://ansdimat.com/Ru/video_cases/case_01.shtml",
      icon: "water-pump",
      difficulty: "Средний",
      duration: "15 мин"
    },
    {
      id: 2,
      title: I18n.t("pitModelTitle"),
      description: I18n.t("pitModelDescription"),
      url: "https://ansdimat.com/Ru/video_cases/case_02.shtml",
      icon: "excavator",
      difficulty: "Сложный",
      duration: "25 мин"
    }
  ];

  const videos = [
    {
      id: 1,
      title: I18n.t("video1Title"),
      url: "https://rutube.ru/video/a86ee3f1bdd6896d95afc1bd8aa13851/",
      duration: "12:45",
      category: "Основы"
    },
    {
      id: 2,
      title: I18n.t("video2Title"),
      url: "https://rutube.ru/video/6107cc6ecaf01a721d30661569f92ac0/",
      duration: "8:30",
      category: "Настройка"
    },
    {
      id: 3,
      title: I18n.t("video3Title"),
      url: "https://rutube.ru/video/472c734ab749122fd95c4506a05e6d41/",
      duration: "15:20",
      category: "Расчеты"
    },
    {
      id: 4,
      title: I18n.t("video4Title"),
      url: "https://rutube.ru/video/2e106a4faaf4f34fa315b5a5ac8b8b2a/",
      duration: "10:15",
      category: "Анализ"
    },
    {
      id: 5,
      title: I18n.t("video5Title"),
      url: "https://rutube.ru/video/23f1fc0ac55afbec746b9689a30fae0c/",
      duration: "18:45",
      category: "Экспорт"
    },
    {
      id: 6,
      title: I18n.t("video6Title"),
      url: "https://rutube.ru/video/a96c453b0b730de20ac58e0cc097acff/",
      duration: "13:30",
      category: "Графики"
    },
    {
      id: 7,
      title: I18n.t("video7Title"),
      url: "https://rutube.ru/video/a96c453b0b730de20ac58e0cc097acff/",
      duration: "16:20",
      category: "Отчеты"
    }
  ];

  const renderExampleCard = (example) => (
    <Card key={example.id} style={[styles.exampleCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
            <MaterialCommunityIcons 
              name={example.icon} 
              size={32} 
              color={theme.colors.primary} 
            />
          </View>
          <View style={styles.cardMeta}>
            <Chip 
              mode="outlined" 
              compact 
              style={[styles.chip, { borderColor: theme.colors.secondary }]}
              textStyle={{ color: theme.colors.secondary }}
            >
              {example.difficulty}
            </Chip>
            <View style={styles.durationContainer}>
              <MaterialIcons name="schedule" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>
                {example.duration}
              </Text>
            </View>
          </View>
        </View>
        
        <Text style={[styles.exampleTitle, { color: theme.colors.text }]}>
          {example.title}
        </Text>
        <Text style={[styles.exampleDescription, { color: theme.colors.textSecondary }]}>
          {example.description}
        </Text>
        
        <TouchableOpacity
          style={[styles.detailsButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => handleLinkOpen(example.url)}
        >
          <MaterialIcons name="arrow-forward" size={20} color={theme.colors.white} />
          <Text style={[styles.buttonText, { color: theme.colors.white }]}>
            {I18n.t("moreDetails")}
          </Text>
        </TouchableOpacity>
        </Card.Content>
      </Card>
  );

  const renderVideoCard = (video) => (
    <Card key={video.id} style={[styles.videoCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
        <View style={styles.videoHeader}>
          <Surface style={[styles.videoThumbnail, { backgroundColor: theme.colors.background }]}>
            <MaterialIcons name="play-circle-filled" size={48} color={theme.colors.primary} />
          </Surface>
          
          <View style={styles.videoInfo}>
            <View style={styles.videoMeta}>
              <Chip 
                mode="flat" 
                compact 
                style={[styles.categoryChip, { backgroundColor: theme.colors.secondary + '20' }]}
                textStyle={{ color: theme.colors.secondary, fontSize: 12 }}
              >
                {video.category}
              </Chip>
              <View style={styles.durationContainer}>
                <MaterialIcons name="access-time" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.videoDuration, { color: theme.colors.textSecondary }]}>
                  {video.duration}
                </Text>
              </View>
          </View>
            
            <Text style={[styles.videoTitle, { color: theme.colors.text }]} numberOfLines={2}>
              {video.title}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.watchButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => handleLinkOpen(video.url)}
        >
          <MaterialIcons name="play-arrow" size={20} color={theme.colors.white} />
          <Text style={[styles.buttonText, { color: theme.colors.white }]}>
            {I18n.t("watch")}
          </Text>
        </TouchableOpacity>
        </Card.Content>
      </Card>
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Заголовок */}
      <Surface style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="school" size={48} color={theme.colors.primary} />
          <Text style={[styles.mainTitle, { color: theme.colors.primary }]}>
            {I18n.t("examplesTitle")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Изучайте ANSDIMAT с помощью примеров и видеоуроков
          </Text>
        </View>
      </Surface>

      {/* Примеры использования */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="book-open-variant" size={24} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            {I18n.t("usageExamples")}
          </Text>
        </View>
        
        {examples.map(renderExampleCard)}
          </View>

      {/* Видеоуроки */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="video-box" size={24} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
            {I18n.t("tutorialVideos")}
          </Text>
          </View>
        
        <View style={styles.videosGrid}>
          {videos.map(renderVideoCard)}
        </View>
          </View>

      {/* Нижний отступ */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  headerCard: {
    marginBottom: 24,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    alignItems: 'center',
    padding: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  exampleCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardMeta: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  chip: {
    height: 28,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryChip: {
    height: 24,
    alignSelf: 'flex-start',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  duration: {
    fontSize: 12,
    fontWeight: '500',
  },
  videoDuration: {
    fontSize: 11,
    fontWeight: '500',
  },
  exampleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 24,
  },
  exampleDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    alignSelf: 'flex-start',
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  videosGrid: {
    gap: 12,
  },
  videoCard: {
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  videoThumbnail: {
    width: 80,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  videoInfo: {
    flex: 1,
  },
  videoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
});
