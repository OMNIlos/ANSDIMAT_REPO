import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

function formatDate(date) {
  return new Date(date).toLocaleString();
}

export default function ProjectManager() {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const { locale } = useContext(LanguageContext);

  useEffect(() => {
    loadProjects();
    loadActive();
  }, []);

  async function loadProjects() {
    const data = await AsyncStorage.getItem("pumping_projects");
    if (data) setProjects(JSON.parse(data));
  }

  async function loadActive() {
    const id = await AsyncStorage.getItem("pumping_active_project_id");
    setActiveId(id);
  }

  async function saveProjects(newProjects) {
    setProjects(newProjects);
    await AsyncStorage.setItem("pumping_projects", JSON.stringify(newProjects));
  }

  function createProject() {
    Alert.prompt(
      I18n.t("createProject"),
      I18n.t("projectNamePlaceholder"),
      async (name) => {
        if (!name) return;
        const newProject = {
          id: Date.now().toString(),
          name,
          created: Date.now(),
          favorite: false,
          journals: [],
        };
        const newProjects = [newProject, ...projects];
        await saveProjects(newProjects);
      }
    );
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

  function exportProject(id) {
    Alert.alert(I18n.t("exportProject"), I18n.t("exportProjectJsonDesc"));
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
        Alert.alert(I18n.t("error"), "Файл не является валидным JSON");
        return;
      }
      if (!imported || !imported.id || !imported.name) {
        Alert.alert(I18n.t("error"), "Файл не является проектом ANSDIMAT");
        return;
      }
      // Получаем текущие проекты
      const data = await AsyncStorage.getItem("pumping_projects");
      let projects = data ? JSON.parse(data) : [];
      // Проверка на дубликаты
      if (projects.some((p) => p.id === imported.id)) {
        Alert.alert(I18n.t("warning"), "Проект с таким ID уже существует");
        return;
      }
      projects = [imported, ...projects];
      await AsyncStorage.setItem("pumping_projects", JSON.stringify(projects));
      setProjects(projects);
      Alert.alert(I18n.t("success"), "Проект успешно импортирован!");
    } catch (e) {
      Alert.alert(I18n.t("error"), "Ошибка при импорте файла");
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
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 12,
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
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                {item.name}
              </Text>
              <Text style={{ color: "#888", fontSize: 12 }}>
                {I18n.t("created")}: {formatDate(item.created)}
              </Text>
              {item.id === activeId && (
                <Text style={{ color: "#800020", fontSize: 12 }}>
                  {I18n.t("activeProject")}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => toggleFavorite(item.id)}>
              <Text
                style={{
                  fontSize: 22,
                  color: item.favorite ? "#b22222" : "#aaa",
                }}
              >
                ★
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => exportProject(item.id)}
              style={{ marginLeft: 10 }}
            >
              <Text style={{ fontSize: 18 }}>⤴️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteProject(item.id)}
              style={{ marginLeft: 10 }}
            >
              <Text style={{ fontSize: 18, color: "#b22222" }}>🗑️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selectProject(item.id)}
              style={{ marginLeft: 10 }}
            >
              <Text
                style={{
                  fontSize: 18,
                  color: item.id === activeId ? "#800020" : "#222",
                }}
              >
                {I18n.t("selectProject")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#800020",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  projectItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  activeProject: {
    borderWidth: 2,
    borderColor: "#800020",
  },
});
