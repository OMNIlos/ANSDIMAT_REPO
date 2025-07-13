import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Svg, { Path } from "react-native-svg";
import SubscriptionManager from "../../utils/SubscriptionManager";

function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export default function ProjectManager() {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const { locale } = useContext(LanguageContext);

  useEffect(() => {
    loadProjects();
    loadActive();
    checkPremiumAccess();
  }, []);

  async function checkPremiumAccess() {
    const hasAccess = await SubscriptionManager.hasPremiumAccess();
    setHasPremiumAccess(hasAccess);
  }

  async function loadProjects() {
    try {
      const data = await AsyncStorage.getItem("pumping_projects");
      if (data) setProjects(JSON.parse(data));
    } catch (error) {
      console.error("Error loading projects:", error);
      setProjects([]);
    }
  }

  async function loadActive() {
    try {
      const id = await AsyncStorage.getItem("pumping_active_project_id");
      setActiveId(id);
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveId(null);
    }
  }

  async function saveProjects(newProjects) {
    setProjects(newProjects);
    await AsyncStorage.setItem("pumping_projects", JSON.stringify(newProjects));
  }

  function createProject() {
    // Проверяем лимит проектов для бесплатных пользователей
    if (!hasPremiumAccess && projects.length >= 3) {
      Alert.alert(I18n.t("projectLimit"), I18n.t("projectLimitMessage"), [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("goToPremium"),
          onPress: () => {
            // Здесь можно добавить навигацию к экрану подписки
            Alert.alert(
              I18n.t("subscription"),
              I18n.t("subscriptionNavigation")
            );
          },
        },
      ]);
      return;
    }

    setShowCreateModal(true);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const newProject = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      created: Date.now(),
      favorite: false,
      journals: [],
    };
    const newProjects = [newProject, ...projects];
    await saveProjects(newProjects);
    setNewProjectName("");
    setShowCreateModal(false);
  }

  function deleteProject(id) {
    const project = projects.find((p) => p.id === id);
    Alert.alert(
      I18n.t("deleteProject"),
      I18n.t("deleteProjectConfirm", { name: project?.name || "" }),
      [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("delete"),
          style: "destructive",
          onPress: async () => {
            const newProjects = projects.filter((p) => p.id !== id);
            await saveProjects(newProjects);
            if (activeId === id) {
              await AsyncStorage.removeItem("pumping_active_project_id");
              setActiveId(null);
            }
          },
        },
      ]
    );
  }

  function toggleFavorite(id) {
    const newProjects = projects.map((p) =>
      p.id === id ? { ...p, favorite: !p.favorite } : p
    );
    saveProjects(newProjects);
  }

  async function exportProject(id) {
    try {
      const project = projects.find((p) => p.id === id);
      if (!project) {
        Alert.alert(I18n.t("error"), I18n.t("projectNotFound"));
        return;
      }

      // Создаем JSON с данными проекта
      const projectData = JSON.stringify(project, null, 2);

      // Создаем имя файла с датой
      const date = new Date().toISOString().split("T")[0];
      const fileName = `${project.name.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${date}.json`;

      // Сохраняем файл во временную директорию
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, projectData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Открываем диалог шаринга
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: `${I18n.t("exportProject")}: ${project.name}`,
      });
    } catch (error) {
      console.error("Error exporting project:", error);
      Alert.alert(I18n.t("error"), I18n.t("exportError"));
    }
  }

  async function importProject() {
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
      if (!imported || !imported.id || !imported.name) {
        Alert.alert(I18n.t("error"), I18n.t("notAnsdimatProject"));
        return;
      }
      // Получаем текущие проекты
      const data = await AsyncStorage.getItem("pumping_projects");
      let projects = data ? JSON.parse(data) : [];
      // Проверка на дубликаты
      if (projects.some((p) => p.id === imported.id)) {
        Alert.alert(I18n.t("warning"), I18n.t("projectIdExists"));
        return;
      }
      projects = [imported, ...projects];
      await AsyncStorage.setItem("pumping_projects", JSON.stringify(projects));
      setProjects(projects);
      Alert.alert(I18n.t("success"), I18n.t("projectImported"));
    } catch (e) {
      Alert.alert(I18n.t("error"), I18n.t("importError"));
    }
  }

  async function selectProject(id) {
    setActiveId(id);
    await AsyncStorage.setItem("pumping_active_project_id", id);
  }

  return (
    <View key={locale} style={{ flex: 1, padding: 16 }}>
      <View
        style={{
          flexDirection: "column",
          marginBottom: 12,
          gap: 8,
        }}
      >
        <TouchableOpacity style={styles.button} onPress={createProject}>
          <Text style={styles.buttonText}>{I18n.t("createProject")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={importProject}>
          <Text style={styles.buttonText}>{I18n.t("importProject")}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", marginTop: 40 }}>
            {I18n.t("noProjects")}
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.projectItem,
              item.id === activeId && styles.activeProject,
            ]}
          >
            {/* Первая строка: название проекта */}
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: "#666", fontSize: 12, marginBottom: 2 }}>
                {I18n.t("projectName")}:
              </Text>
              <Text
                style={{
                  fontWeight: "bold",
                  fontSize: 16,
                  flexWrap: "nowrap",
                }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </View>

            {/* Вторая строка: кнопки и информация */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {/* Левая часть: кнопки */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity
                  onPress={() => toggleFavorite(item.id)}
                  style={{ padding: 4 }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      color: item.favorite ? "#b22222" : "#aaa",
                    }}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => exportProject(item.id)}
                  style={{ padding: 4, marginLeft: 4 }}
                >
                  <Svg
                    width="30"
                    height="30"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
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
                  onPress={() => deleteProject(item.id)}
                  style={{ padding: 4, marginLeft: 4 }}
                >
                  <Svg
                    width="22"
                    height="22"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <Path
                      d="m87.281 27.238-5.1328 59.711c-0.51563 5.9805-5.4961 10.551-11.48 10.551h-41.336c-5.9844 0-10.969-4.5703-11.48-10.551l-5.1328-59.711h-7.4258c-1.543 0-2.793-1.25-2.793-2.793 0-1.543 1.25-2.793 2.793-2.793h21.938l1.4062-9.3398c0.42578-2.8281 1.8359-5.2812 3.8672-7.0312 2.0273-1.7461 4.6641-2.7773 7.5273-2.7773h19.934c5.7344 0 10.543 4.1523 11.395 9.8125l1.4062 9.3398h21.938c1.543 0 2.7969 1.25 2.7969 2.793s-1.2539 2.793-2.7969 2.793h-7.4258zm-48.805 15.426v33.82c0 1.543 1.25 2.793 2.793 2.793s2.793-1.25 2.793-2.793v-33.82c0-1.543-1.25-2.7969-2.793-2.7969s-2.793 1.2539-2.793 2.7969zm17.457 0v33.82c0 1.543 1.25 2.793 2.793 2.793 1.543 0 2.793-1.25 2.793-2.793v-33.82c0-1.543-1.25-2.7969-2.793-2.7969-1.543 0-2.793 1.2539-2.793 2.7969zm-23.055-21.012h34.242l-1.2812-8.5117c-0.44141-2.9375-2.8945-5.0508-5.8711-5.0508h-19.934c-1.4844 0-2.8477 0.52344-3.8867 1.4219-1.0391 0.91016-1.7578 2.1367-1.9844 3.6328l-1.2812 8.5117zm-14.555 5.5859 5.0938 59.254c0.26562 3.0781 2.8086 5.418 5.9141 5.418h41.336c3.1094 0 5.6523-2.3398 5.9141-5.418l5.0938-59.254z"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      fill="black"
                    />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => selectProject(item.id)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    marginLeft: 8,
                    backgroundColor:
                      item.id === activeId ? "#800020" : "#f0f0f0",
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: item.id === activeId ? "#fff" : "#222",
                      fontWeight: "600",
                    }}
                  >
                    {I18n.t("selectProject")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              {/* Правая часть: дата и статус */}
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color: "#888",
                    fontSize: 11,
                    textAlign: "right",
                    marginBottom: 2,
                  }}
                >
                  {I18n.t("created")}: {formatDate(item.created)}
                </Text>
                {item.id === activeId && (
                  <Text
                    style={{
                      color: "#800020",
                      fontSize: 11,
                      fontWeight: "600",
                      textAlign: "right",
                    }}
                  >
                    {I18n.t("activeProject")}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      />

      {/* Модальное окно создания проекта */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 20,
              width: "80%",
              maxWidth: 300,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              {I18n.t("createProject")}
            </Text>
            <TextInput
              placeholder={I18n.t("projectNamePlaceholder")}
              value={newProjectName}
              onChangeText={setNewProjectName}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                fontSize: 16,
              }}
              autoFocus
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setNewProjectName("");
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  marginRight: 8,
                  borderRadius: 8,
                  backgroundColor: "#f0f0f0",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#666" }}>{I18n.t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateProject}
                style={{
                  flex: 1,
                  padding: 12,
                  marginLeft: 8,
                  borderRadius: 8,
                  backgroundColor: "#800020",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  {I18n.t("create")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#800020",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  projectItem: {
    flexDirection: "column",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    minHeight: 120,
  },
  activeProject: {
    borderWidth: 2,
    borderColor: "#800020",
  },
});
