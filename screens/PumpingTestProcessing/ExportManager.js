import React, { useState, useEffect, useContext } from "react";
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
import LanguageContext from "../../LanguageContext";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export default function ExportManager() {
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const { locale } = useContext(LanguageContext);

  // Перезагружаем данные при фокусе на экране
  useFocusEffect(
    React.useCallback(() => {
      loadActiveProject();
    }, [])
  );

  async function loadActiveProject() {
    const id = await AsyncStorage.getItem("pumping_active_project_id");
    if (!id) {
      setActiveProject(null);
      setJournals([]);
      return;
    }
    const projectsRaw = await AsyncStorage.getItem("pumping_projects");
    if (!projectsRaw) return;
    const projects = JSON.parse(projectsRaw);
    const project = projects.find((p) => p.id === id);
    setActiveProject(project || null);
    setJournals(project && project.journals ? project.journals : []);
  }

  async function exportProjectToJSON() {
    if (!activeProject) {
      Alert.alert(I18n.t("error"), I18n.t("noActiveProject"));
      return;
    }
    try {
      const projectData = JSON.stringify(activeProject, null, 2);
      const fileUri =
        FileSystem.cacheDirectory + `${activeProject.name || "project"}.json`;
      await FileSystem.writeAsStringAsync(fileUri, projectData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, { mimeType: "application/json" });
    } catch (error) {
      Alert.alert(I18n.t("error"), I18n.t("exportError"));
    }
  }

  async function exportJournalToCSV() {
    if (!activeProject || !journals.length) {
      Alert.alert(I18n.t("error"), I18n.t("noDataToExport"));
      return;
    }
    try {
      let csvContent = `${I18n.t("journal")},${I18n.t("created")},${I18n.t(
        "testType"
      )},${I18n.t("boundaryConditions")}\n`;
      journals.forEach((journal, idx) => {
        csvContent += `Journal ${idx + 1},${new Date(
          journal.date
        ).toLocaleDateString()},${journal.testType},${
          journal.boundaryConditions
        }\n`;
        if (journal.dataRows && journal.dataRows.length) {
          csvContent += `${I18n.t("time")},${I18n.t("drawdown")}\n`;
          journal.dataRows.forEach((row) => {
            if (row.t && row.s) {
              csvContent += `${row.t},${row.s}\n`;
            }
          });
        }
        csvContent += "\n";
      });
      const fileUri =
        FileSystem.cacheDirectory + `${activeProject.name || "journals"}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
    } catch (error) {
      Alert.alert(I18n.t("error"), I18n.t("exportError"));
    }
  }

  async function exportChartAsImage() {
    Alert.alert(I18n.t("exportChartPng"), I18n.t("exportChartPngDesc"), [
      { text: I18n.t("ok") },
    ]);
  }

  async function exportAnalysisToPDF() {
    if (!activeProject || !journals.length) {
      Alert.alert(I18n.t("error"), I18n.t("noDataToExport"));
      return;
    }

    Alert.alert(I18n.t("exportAnalysisPdf"), I18n.t("exportAnalysisPdfDesc"), [
      { text: I18n.t("ok") },
    ]);
  }

  if (!activeProject) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#b22222", fontSize: 16 }}>
          {I18n.t("noActiveProject")}
        </Text>
        <Text style={{ marginTop: 8, textAlign: "center" }}>
          {I18n.t("selectProjectFirst")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView key={locale} style={styles.container}>
      <Text style={styles.title}>{I18n.t("exportData")}</Text>

      <View style={styles.projectInfo}>
        <Text style={styles.projectName}>
          {I18n.t("project")}: {activeProject.name}
        </Text>
        <Text style={styles.projectDate}>
          {I18n.t("created")}:{" "}
          {new Date(activeProject.createdAt).toLocaleDateString()}
        </Text>
        <Text style={styles.journalCount}>
          {I18n.t("journalsCount")}: {journals.length}
        </Text>
      </View>

      <View style={styles.exportSection}>
        <Text style={styles.sectionTitle}>{I18n.t("exportProjectJson")}</Text>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportProjectToJSON}
        >
          <Text style={styles.buttonText}>
            📁 {I18n.t("exportProjectJson")}
          </Text>
          <Text style={styles.buttonDescription}>
            {I18n.t("exportProjectJsonDesc")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportJournalToCSV}
        >
          <Text style={styles.buttonText}>
            📊 {I18n.t("exportJournalsCsv")}
          </Text>
          <Text style={styles.buttonDescription}>
            {I18n.t("exportJournalsCsvDesc")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.exportSection}>
        <Text style={styles.sectionTitle}>{I18n.t("export")}</Text>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportChartAsImage}
        >
          <Text style={styles.buttonText}>📈 {I18n.t("exportChartPng")}</Text>
          <Text style={styles.buttonDescription}>
            {I18n.t("exportChartPngDesc")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportAnalysisToPDF}
        >
          <Text style={styles.buttonText}>
            📄 {I18n.t("exportAnalysisPdf")}
          </Text>
          <Text style={styles.buttonDescription}>
            {I18n.t("exportAnalysisPdfDesc")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ {I18n.t("information")}</Text>
        <Text style={styles.infoText}>{I18n.t("infoText")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#800020",
    textAlign: "center",
    marginBottom: 20,
  },
  projectInfo: {
    backgroundColor: "#f9f9f9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  projectName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#800020",
    marginBottom: 4,
  },
  projectDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  journalCount: {
    fontSize: 14,
    color: "#666",
  },
  exportSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#800020",
    marginBottom: 12,
  },
  exportButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#800020",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#800020",
    marginBottom: 4,
  },
  buttonDescription: {
    fontSize: 14,
    color: "#666",
  },
  infoBox: {
    backgroundColor: "#f3eaea",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#800020",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
});
