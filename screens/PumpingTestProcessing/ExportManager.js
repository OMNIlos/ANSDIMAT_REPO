import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import { LanguageContext } from "../../LanguageContext";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { SubscriptionManager } from "../../utils/SubscriptionManager";
import PremiumBanner from "../../components/PremiumBanner";
import { 
  useTheme, 
  Card, 
  Surface, 
  Button,
  IconButton,
  Divider,
  ProgressBar
} from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// Компонент карточки экспорта (мемоизированный)
const ExportCard = React.memo(({ 
  title, 
  description, 
  icon, 
  iconColor, 
  onPress, 
  isPremium = false, 
  hasPremiumAccess = false,
  theme 
}) => {
  if (isPremium && !hasPremiumAccess) {
    return (
      <Card style={[styles.exportCard, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <MaterialCommunityIcons 
                name={icon} 
                size={24} 
                color={theme.colors.outline} 
              />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurfaceVariant }]}>
                {title}
              </Text>
              <Text style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
                {description}
              </Text>
            </View>
            <MaterialIcons name="lock" size={20} color={theme.colors.outline} />
          </View>
          
          <Divider style={{ marginVertical: 12 }} />
          
          <View style={styles.premiumContainer}>
            <MaterialIcons name="star" size={16} color="#FFD700" />
            <Text style={[styles.premiumText, { color: theme.colors.onSurfaceVariant }]}>
              Премиум функция
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={[styles.exportCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <TouchableOpacity 
          style={styles.cardTouchable} 
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconContainer, { backgroundColor: iconColor + '20' }]}>
              <MaterialCommunityIcons 
                name={icon} 
                size={24} 
                color={iconColor} 
              />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {title}
              </Text>
              <Text style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
                {description}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.primary} />
          </View>
        </TouchableOpacity>
      </Card.Content>
    </Card>
  );
});

// Компонент статистики проекта
const ProjectStats = React.memo(({ project, journals, theme }) => {
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const estimatedSize = useMemo(() => {
    const dataSize = JSON.stringify(project).length;
    return formatFileSize(dataSize);
  }, [project, formatFileSize]);

  const totalMeasurements = useMemo(() => {
    return journals.reduce((total, journal) => {
      return total + (journal.dataRows?.length || 0);
    }, 0);
  }, [journals]);

  return (
    <Card style={[styles.statsCard, { backgroundColor: theme.colors.primaryContainer }]}>
      <Card.Content>
        <View style={styles.statsHeader}>
          <MaterialCommunityIcons 
            name="chart-box" 
            size={28} 
            color={theme.colors.primary} 
          />
          <Text style={[styles.statsTitle, { color: theme.colors.primary }]}>
            Статистика проекта
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.onPrimaryContainer }]}>
              {journals.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onPrimaryContainer }]}>
              Журналов
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.onPrimaryContainer }]}>
              {totalMeasurements}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onPrimaryContainer }]}>
              Измерений
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.onPrimaryContainer }]}>
              {estimatedSize}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.onPrimaryContainer }]}>
              Размер данных
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

// Основной компонент
export default function ExportManager() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  
  // Состояние
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Загрузка данных при фокусе
  useFocusEffect(
    React.useCallback(() => {
      async function fetchData() {
        await loadActiveProject();
        await checkPremiumAccess();
      }
      fetchData();
    }, [])
  );

  const checkPremiumAccess = useCallback(async () => {
    const hasAccess = await SubscriptionManager.hasPremiumAccess();
    setHasPremiumAccess(hasAccess);
  }, []);

  const loadActiveProject = useCallback(async () => {
    try {
    const id = await AsyncStorage.getItem("pumping_active_project_id");
    if (!id) {
      setActiveProject(null);
      setJournals([]);
      return;
    }
      
    const projectsRaw = await AsyncStorage.getItem("pumping_projects");
    if (!projectsRaw) return;
      
    const projects = JSON.parse(projectsRaw);
      const project = projects.find((p) => p.id.toString() === id.toString());
      
    setActiveProject(project || null);
      setJournals(project?.journals || []);
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveProject(null);
      setJournals([]);
  }
  }, []);

  const exportProjectToJSON = useCallback(async () => {
    if (!activeProject) {
              Alert.alert(I18n.t("error"), I18n.t("noActiveProject"));
      return;
    }
    
    setIsExporting(true);
    try {
      const projectData = JSON.stringify(activeProject, null, 2);
      const fileName = `${activeProject.name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.json`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, projectData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      await Sharing.shareAsync(fileUri, { 
        mimeType: "application/json",
        dialogTitle: `Экспорт проекта: ${activeProject.name}`
      });
      
              Alert.alert(I18n.t("success"), I18n.t("projectExported"));
    } catch (error) {
      console.error("Export error:", error);
              Alert.alert(I18n.t("error"), I18n.t("exportProjectError"));
    } finally {
      setIsExporting(false);
    }
  }, [activeProject]);

  const exportJournalToCSV = useCallback(async () => {
    if (!hasPremiumAccess) {
              Alert.alert(I18n.t("premiumFeature"), I18n.t("premiumFeatureCSV"), [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("getPremium"),
          onPress: () => Alert.alert(I18n.t("subscription"), I18n.t("goToSubscription")),
        },
      ]);
      return;
    }

    if (!activeProject || !journals.length) {
      Alert.alert(I18n.t("error"), I18n.t("noDataToExport"));
      return;
    }
    
    setIsExporting(true);
    try {
      let csvContent = I18n.t("csvHeader") + "\n";
      
      journals.forEach((journal, idx) => {
        csvContent += `Журнал ${idx + 1},${new Date(journal.date).toLocaleDateString()},${journal.testType},${journal.boundary}\n`;
        
        if (journal.dataRows?.length) {
          csvContent += I18n.t("csvDataHeader") + "\n";
          journal.dataRows.forEach((row) => {
            if (row.t && row.s) {
              csvContent += `${row.t},${row.s}\n`;
            }
          });
        }
        csvContent += "\n";
      });
      
      const fileName = `${activeProject.name.replace(/[^a-zA-Z0-9]/g, "_")}_journals_${Date.now()}.csv`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      await Sharing.shareAsync(fileUri, { 
        mimeType: "text/csv",
        dialogTitle: `Экспорт журналов: ${activeProject.name}`
      });
      
      Alert.alert(I18n.t("success"), I18n.t("journalsExportedCSV"));
    } catch (error) {
      console.error("CSV export error:", error);
      Alert.alert(I18n.t("error"), I18n.t("exportJournalsError"));
    } finally {
      setIsExporting(false);
    }
  }, [activeProject, journals, hasPremiumAccess]);

  const exportAnalysisToPDF = useCallback(async () => {
    if (!hasPremiumAccess) {
      Alert.alert(I18n.t("premiumFeature"), I18n.t("premiumFeaturePDF"), [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("getPremium"), 
          onPress: () => Alert.alert(I18n.t("subscription"), I18n.t("goToSubscription")),
        },
      ]);
      return;
    }

    if (!activeProject || !journals.length) {
      Alert.alert(I18n.t("error"), I18n.t("noDataToExport"));
      return;
    }

    Alert.alert(I18n.t("inDevelopment"), I18n.t("pdfExportInDevelopment"), [
      { text: I18n.t("understand") }
    ]);
  }, [activeProject, journals, hasPremiumAccess]);

  // Проверка состояний
  if (!activeProject) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="folder-open" size={64} color={theme.colors.outline} />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          {I18n.t("noActiveProject")}
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {I18n.t("selectProjectInManagement")}
        </Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Заголовок */}
      <Surface style={[styles.headerCard, { backgroundColor: theme.colors.tertiaryContainer }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="export" size={32} color={theme.colors.tertiary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.tertiary }]}>
              Экспорт результатов
        </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onTertiaryContainer }]}>
              Проект: {activeProject.name}
        </Text>
          </View>
        </View>
      </Surface>

      {/* Статистика проекта */}
      <ProjectStats 
        project={activeProject} 
        journals={journals} 
        theme={theme} 
      />

      {/* Прогресс бар при экспорте */}
      {isExporting && (
        <Card style={[styles.progressCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.progressContainer}>
              <MaterialCommunityIcons 
                name="loading" 
                size={20} 
                color={theme.colors.primary} 
              />
              <Text style={[styles.progressText, { color: theme.colors.onSurface }]}>
                Экспортирование...
        </Text>
      </View>
            <ProgressBar 
              indeterminate 
              color={theme.colors.primary} 
              style={{ marginTop: 8 }}
            />
          </Card.Content>
        </Card>
      )}

      {/* Карточки экспорта */}
      <View style={styles.exportSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {I18n.t("availableExportFormats")}
        </Text>

        <ExportCard
          title={I18n.t("exportProjectJSON")}
          description={I18n.t("exportProjectJSONDesc")}
          icon="code-json"
          iconColor={theme.colors.primary}
          onPress={exportProjectToJSON}
          theme={theme}
        />

        <ExportCard
          title={I18n.t("exportJournalsCSV")}
          description={I18n.t("exportJournalsCSVDesc")}
          icon="file-delimited"
          iconColor={theme.colors.secondary}
            onPress={exportJournalToCSV}
          isPremium={true}
          hasPremiumAccess={hasPremiumAccess}
          theme={theme}
        />

        <ExportCard
          title={I18n.t("exportAnalysisPDF")}
          description={I18n.t("exportAnalysisPDFDesc")}
          icon="file-pdf-box"
          iconColor={theme.colors.tertiary}
          onPress={exportAnalysisToPDF}
          isPremium={true}
          hasPremiumAccess={hasPremiumAccess}
          theme={theme}
          />
      </View>

      {/* Информационная карточка */}
      <Card style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info" size={24} color={theme.colors.primary} />
            <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>
              {I18n.t("exportInformation")}
            </Text>
      </View>

          <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
            {I18n.t("exportInfoText")}
          </Text>
        </Card.Content>
      </Card>

      {/* Отступ снизу */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 5,
  },
  headerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  statsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
  },
  statItem: {
    alignItems: "center",
    marginHorizontal: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  exportSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  exportCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardTouchable: {
    padding: 0,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  premiumContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  premiumText: {
    fontSize: 12,
    marginLeft: 5,
  },
  progressCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 100,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
