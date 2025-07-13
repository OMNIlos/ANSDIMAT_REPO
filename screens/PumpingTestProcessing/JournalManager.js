import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Svg, { Path } from "react-native-svg";

function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export default function JournalManager() {
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const { locale } = useContext(LanguageContext);

  useFocusEffect(
    React.useCallback(() => {
      loadActiveProject();
    }, [])
  );

  async function loadActiveProject() {
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
      const project = projects.find((p) => p.id === id);
      setActiveProject(project || null);
      setJournals(project && project.journals ? project.journals : []);
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveProject(null);
      setJournals([]);
    }
  }

  async function saveJournals(newJournals) {
    if (!activeProject) return;
    const projectsRaw = await AsyncStorage.getItem("pumping_projects");
    let projects = JSON.parse(projectsRaw);
    projects = projects.map((p) =>
      p.id === activeProject.id ? { ...p, journals: newJournals } : p
    );
    await AsyncStorage.setItem("pumping_projects", JSON.stringify(projects));
    setJournals(newJournals);
  }

  function viewJournal(journal) {
    setSelectedJournal(journal);
    setShowJournalModal(true);
  }

  function editJournal(journal) {
    setEditData({
      testType: journal.testType,
      layerType: journal.layerType,
      boundary: journal.boundary,
      dataType: journal.dataType,
    });
    setSelectedJournal(journal);
    setShowEditModal(true);
  }

  async function saveJournalEdit() {
    if (!selectedJournal) return;
    const updatedJournals = journals.map((j, index) => {
      if (j === selectedJournal) {
        return {
          ...j,
          testType: editData.testType,
          layerType: editData.layerType,
          boundary: editData.boundary,
          dataType: editData.dataType,
        };
      }
      return j;
    });
    await saveJournals(updatedJournals);
    setShowEditModal(false);
    setSelectedJournal(null);
    Alert.alert(I18n.t("success"), I18n.t("journalUpdated"));
  }

  function toggleFavorite(journal) {
    const updatedJournals = journals.map((j) =>
      j === journal ? { ...j, favorite: !j.favorite } : j
    );
    saveJournals(updatedJournals);
  }

  async function deleteJournal(journal) {
    Alert.alert(
      I18n.t("deleteJournal"),
      I18n.t("deleteJournalConfirm", { name: journal.testType }),
      [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("delete"),
          style: "destructive",
          onPress: async () => {
            const updatedJournals = journals.filter((j) => j !== journal);
            await saveJournals(updatedJournals);
            Alert.alert(I18n.t("success"), I18n.t("journalDeleted"));
          },
        },
      ]
    );
  }

  async function exportJournal(journal) {
    try {
      const journalData = JSON.stringify(journal, null, 2);
      const fileUri = FileSystem.cacheDirectory + `journal_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, journalData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, { mimeType: "application/json" });
    } catch (error) {
      Alert.alert(I18n.t("error"), I18n.t("exportError"));
    }
  }

  async function importJournal() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
      });
      if (res.canceled || !res.assets || !res.assets[0]) return;
      const fileUri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);
      let imported;
      try {
        imported = JSON.parse(content);
      } catch (e) {
        Alert.alert(I18n.t("error"), I18n.t("invalidJsonFile"));
        return;
      }
      if (!imported || !imported.testType || !imported.dataRows) {
        Alert.alert(I18n.t("error"), I18n.t("notAnsdimatJournal"));
        return;
      }
      const newJournal = {
        ...imported,
        id: Date.now().toString(),
        date: Date.now(),
        favorite: false,
      };
      const updatedJournals = [newJournal, ...journals];
      await saveJournals(updatedJournals);
      Alert.alert(I18n.t("success"), I18n.t("journalImportedSuccess"));
    } catch (e) {
      Alert.alert(I18n.t("error"), I18n.t("importFileError"));
    }
  }

  function JournalDetailModal() {
    if (!selectedJournal) return null;

    return (
      <Modal
        visible={showJournalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJournalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{I18n.t("journalDetails")}</Text>
              <TouchableOpacity
                onPress={() => setShowJournalModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>{I18n.t("testType")}:</Text>
                <Text style={styles.detailValue}>
                  {selectedJournal.testType}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>{I18n.t("layerType")}:</Text>
                <Text style={styles.detailValue}>
                  {selectedJournal.layerType}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {I18n.t("boundaryConditions")}:
                </Text>
                <Text style={styles.detailValue}>
                  {selectedJournal.boundary}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>{I18n.t("dataType")}:</Text>
                <Text style={styles.detailValue}>
                  {selectedJournal.dataType}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>{I18n.t("created")}:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedJournal.date)}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>{I18n.t("dataRows")}:</Text>
                <Text style={styles.detailValue}>
                  {selectedJournal.dataRows.length} {I18n.t("rows")}
                </Text>
              </View>

              <View style={styles.dataPreview}>
                <Text style={styles.detailLabel}>{I18n.t("dataPreview")}:</Text>
                {selectedJournal.dataRows.slice(0, 5).map((row, index) => (
                  <Text key={index} style={styles.dataRow}>
                    {row.t && row.s
                      ? `${row.t} → ${row.s}`
                      : row.t && row.s1 && row.s2
                      ? `${row.t} → ${row.s1}, ${row.s2}`
                      : row.s && row.r
                      ? `${row.s} → ${row.r}`
                      : I18n.t("noData")}
                  </Text>
                ))}
                {selectedJournal.dataRows.length > 5 && (
                  <Text style={styles.moreData}>
                    ... и еще {selectedJournal.dataRows.length - 5} строк
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.editButton]}
                onPress={() => {
                  setShowJournalModal(false);
                  editJournal(selectedJournal);
                }}
              >
                <Text style={styles.editButtonText}>{I18n.t("edit")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.exportButton]}
                onPress={() => exportJournal(selectedJournal)}
              >
                <Text style={styles.exportButtonText}>{I18n.t("export")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function EditJournalModal() {
    if (!selectedJournal) return null;

    return (
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{I18n.t("editJournal")}</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>{I18n.t("testType")}:</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.testType}
                  onChangeText={(text) =>
                    setEditData({ ...editData, testType: text })
                  }
                  placeholder={I18n.t("testType")}
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>{I18n.t("layerType")}:</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.layerType}
                  onChangeText={(text) =>
                    setEditData({ ...editData, layerType: text })
                  }
                  placeholder={I18n.t("layerType")}
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>
                  {I18n.t("boundaryConditions")}:
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.boundary}
                  onChangeText={(text) =>
                    setEditData({ ...editData, boundary: text })
                  }
                  placeholder={I18n.t("boundaryConditions")}
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>{I18n.t("dataType")}:</Text>
                <TextInput
                  style={styles.textInput}
                  value={editData.dataType}
                  onChangeText={(text) =>
                    setEditData({ ...editData, dataType: text })
                  }
                  placeholder={I18n.t("dataType")}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>{I18n.t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveJournalEdit}
              >
                <Text style={styles.saveButtonText}>{I18n.t("save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
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

  // Проверка на наличие активного проекта
  if (!activeProject) {
    return (
      <View style={styles.center}>
        <Text
          style={{
            color: "#b22222",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {I18n.t("noActiveProject")}
        </Text>
        <Text style={{ color: "#666", textAlign: "center" }}>
          {I18n.t("selectProjectFirst")}
        </Text>
      </View>
    );
  }

  return (
    <View key={locale} style={{ flex: 1, padding: 16 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{I18n.t("journalManagement")}</Text>
        <TouchableOpacity style={styles.importButton} onPress={importJournal}>
          <Text style={styles.importButtonText}>{I18n.t("importJournal")}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.projectInfo}>
        {I18n.t("project")}: {activeProject.name}
      </Text>

      <FlatList
        data={journals}
        keyExtractor={(item, index) => index.toString()}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{I18n.t("noJournals")}</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.journalItem}>
            <View style={styles.journalHeader}>
              <Text style={styles.journalTitle}>
                {item.testType} #{index + 1}
              </Text>
              <View style={styles.journalActions}>
                <TouchableOpacity
                  onPress={() => toggleFavorite(item)}
                  style={styles.actionButton}
                >
                  <Text
                    style={[
                      styles.favoriteIcon,
                      { color: item.favorite ? "#b22222" : "#aaa" },
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => viewJournal(item)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionIcon}>👁️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => editJournal(item)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => exportJournal(item)}
                  style={styles.actionButton}
                >
                  <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <Path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M3.89999 12.9845C3.07157 12.9845 2.39999 12.3129 2.39999 11.4845L2.39999 8.03632C2.39999 7.20789 3.07157 6.53632 3.89999 6.53632L4.67499 6.53632C4.95114 6.53632 5.17499 6.76017 5.17499 7.03632C5.17499 7.31246 4.95114 7.53632 4.67499 7.53632L3.89999 7.53632C3.62385 7.53632 3.39999 7.76017 3.39999 8.03632L3.39999 11.4845C3.39999 11.7606 3.62385 11.9845 3.89999 11.9845L10.1 11.9845C10.3761 11.9845 10.6 11.7606 10.6 11.4845L10.6 8.03632C10.6 7.76017 10.3761 7.53632 10.1 7.53632L9.32499 7.53632C9.04885 7.53632 8.82499 7.31246 8.82499 7.03632C8.82499 6.76017 9.04885 6.53632 9.32499 6.53632L10.1 6.53632C10.9284 6.53632 11.6 7.20789 11.6 8.03632L11.6 11.4845C11.6 12.3129 10.9284 12.9845 10.1 12.9845L3.89999 12.9845Z"
                      fill="black"
                    />
                    <Path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M6.99999 9.01553C7.27613 9.01553 7.49999 8.79167 7.49999 8.51553L7.49998 2.58317L9.99445 4.85117C10.1988 5.03693 10.515 5.0219 10.7008 4.81758C10.8865 4.61326 10.8715 4.29704 10.6672 4.11127L7.46632 1.20102C7.19346 0.952933 6.77646 0.953808 6.50464 1.20303L3.33127 4.11268C3.12773 4.2993 3.11402 4.61559 3.30064 4.81912C3.48726 5.02266 3.80355 5.03637 4.00709 4.84975L6.49998 2.56403L6.49999 8.51553C6.49999 8.79168 6.72385 9.01553 6.99999 9.01553Z"
                      fill="black"
                    />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteJournal(item)}
                  style={styles.actionButton}
                >
                  <Svg width="16" height="16" viewBox="0 0 100 100" fill="none">
                    <Path
                      d="m87.281 27.238-5.1328 59.711c-0.51563 5.9805-5.4961 10.551-11.48 10.551h-41.336c-5.9844 0-10.969-4.5703-11.48-10.551l-5.1328-59.711h-7.4258c-1.543 0-2.793-1.25-2.793-2.793 0-1.543 1.25-2.793 2.793-2.793h21.938l1.4062-9.3398c0.42578-2.8281 1.8359-5.2812 3.8672-7.0312 2.0273-1.7461 4.6641-2.7773 7.5273-2.7773h19.934c5.7344 0 10.543 4.1523 11.395 9.8125l1.4062 9.3398h21.938c1.543 0 2.7969 1.25 2.7969 2.793s-1.2539 2.793-2.7969 2.793h-7.4258zm-48.805 15.426v33.82c0 1.543 1.25 2.793 2.793 2.793s2.793-1.25 2.793-2.793v-33.82c0-1.543-1.25-2.7969-2.793-2.7969s-2.793 1.2539-2.793 2.7969zm17.457 0v33.82c0 1.543 1.25 2.793 2.793 2.793 1.543 0 2.793-1.25 2.793-2.793v-33.82c0-1.543-1.25-2.7969-2.793-2.7969-1.543 0-2.793 1.2539-2.793 2.7969zm-23.055-21.012h34.242l-1.2812-8.5117c-0.44141-2.9375-2.8945-5.0508-5.8711-5.0508h-19.934c-1.4844 0-2.8477 0.52344-3.8867 1.4219-1.0391 0.91016-1.7578 2.1367-1.9844 3.6328l-1.2812 8.5117zm-14.555 5.5859 5.0938 59.254c0.26562 3.0781 2.8086 5.418 5.9141 5.418h41.336c3.1094 0 5.6523-2.3398 5.9141-5.418l5.0938-59.254z"
                      fill="black"
                    />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.journalInfo}>
              <Text style={styles.journalDetail}>
                {I18n.t("layerType")}: {item.layerType}
              </Text>
              <Text style={styles.journalDetail}>
                {I18n.t("boundaryConditions")}: {item.boundary}
              </Text>
              <Text style={styles.journalDetail}>
                {I18n.t("dataType")}: {item.dataType}
              </Text>
              <Text style={styles.journalDetail}>
                {I18n.t("created")}: {formatDate(item.date)}
              </Text>
              <Text style={styles.journalDetail}>
                {I18n.t("dataRows")}: {item.dataRows.length} {I18n.t("rows")}
              </Text>
            </View>
          </View>
        )}
      />

      <JournalDetailModal />
      <EditJournalModal />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#800020",
  },
  importButton: {
    backgroundColor: "#800020",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  importButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  projectInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    color: "#888",
  },
  journalItem: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  journalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  journalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#800020",
  },
  journalActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 4,
    marginLeft: 4,
  },
  favoriteIcon: {
    fontSize: 18,
  },
  actionIcon: {
    fontSize: 16,
  },
  journalInfo: {
    gap: 4,
  },
  journalDetail: {
    fontSize: 12,
    color: "#666",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "90%",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#800020",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666",
  },
  modalBody: {
    padding: 16,
  },
  detailSection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#800020",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: "#333",
  },
  dataPreview: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  dataRow: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  moreData: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#800020",
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  exportButton: {
    backgroundColor: "#f0f0f0",
  },
  exportButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#800020",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#800020",
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
  },
});
