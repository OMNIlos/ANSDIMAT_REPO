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
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from "react-native-paper";
import I18n from "../../Localization";
import { LanguageContext } from "../../LanguageContext";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SubscriptionManager } from "../../utils/SubscriptionManager";
import { useFocusEffect } from '@react-navigation/native';

function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export default function ProjectManager({ route }) {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [showMenuForProject, setShowMenuForProject] = useState(null);
  const { locale } = useContext(LanguageContext);
  const theme = useTheme();

  useEffect(() => {
    loadProjects();
    loadActive();
    checkPremiumAccess();
    
    // Автоматически открываем модальное окно создания проекта, если передан параметр
    if (route?.params?.showCreateModal) {
      setShowCreateModal(true);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadProjects();
      loadActive();
    }, [])
  );

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
      // Приводим к строке для корректного сравнения
      setActiveId(id ? id.toString() : null);
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
    if (!newProjectName.trim()) {
              Alert.alert(I18n.t("error"), I18n.t("enterProjectName"));
      return;
    }

    try {
      const newProject = {
        id: Date.now().toString(),
        name: newProjectName.trim(),
        createdAt: new Date().toISOString(),
        lastAccessDate: new Date().toISOString(),
        journals: [],
        favorite: false,
      };

      const updatedProjects = [...projects, newProject];
      await saveProjects(updatedProjects);
      await AsyncStorage.setItem("pumping_active_project_id", String(newProject.id));
      
      setActiveId(String(newProject.id));
      setNewProjectName("");
      setShowCreateModal(false);
      
      Alert.alert(I18n.t("success"), I18n.t("projectCreated"));
    } catch (error) {
      console.error("Error creating project:", error);
              Alert.alert(I18n.t("error"), I18n.t("createProjectError"));
    }
  }

  function deleteProject(id) {
    const project = projects.find((p) => String(p.id) === String(id));
    Alert.alert(
      I18n.t("deleteProject"),
      I18n.t("deleteProjectConfirm", { name: project?.name || "" }),
      [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("delete"),
          style: "destructive",
          onPress: async () => {
            const newProjects = projects.filter((p) => String(p.id) !== String(id));
            await saveProjects(newProjects);
            if (String(activeId) === String(id)) {
              await AsyncStorage.removeItem("pumping_active_project_id");
              setActiveId(null);
            }
            setShowMenuForProject(null);
          },
        },
      ]
    );
  }

  function toggleFavorite(id) {
    const newProjects = projects.map((p) =>
      String(p.id) === String(id) ? { ...p, favorite: !p.favorite } : p
    );
    saveProjects(newProjects);
    setShowMenuForProject(null);
  }

  async function exportProject(id) {
    try {
      const project = projects.find((p) => String(p.id) === String(id));
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
      setShowMenuForProject(null);
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
      if (projects.some((p) => String(p.id) === String(imported.id))) {
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
    try {
      if (!id) {
        console.warn('selectProject: missing project id');
        return;
      }
      
      // Приводим ID к строке для корректного сравнения
      const searchId = id.toString();
      
      // Проверяем, что проект существует
              const project = projects.find(p => String(p.id) === String(searchId));
      if (!project) {
        console.warn('selectProject: project not found with id:', searchId);
        Alert.alert(I18n.t("error"), I18n.t("projectNotFound"));
        return;
      }
      

      
      // Обновляем состояние интерфейса сразу
      setActiveId(searchId);
      
      // Сохраняем в AsyncStorage
      await AsyncStorage.setItem("pumping_active_project_id", String(searchId));
      
      // Обновляем lastAccessDate для проекта
      const updatedProjects = projects.map(p => 
        String(p.id) === String(searchId) 
          ? { ...p, lastAccessDate: new Date().toISOString() }
          : p
      );
      await saveProjects(updatedProjects);
      

              Alert.alert(I18n.t("success"), I18n.t("projectSelected", { name: project.name }));
    } catch (error) {
      console.error('Error selecting project:', error);
              Alert.alert(I18n.t("error"), I18n.t("selectProjectError"));
    }
  }

  const MenuModal = ({ projectId, visible, onClose }) => {
    const project = projects.find(p => String(p.id) === String(projectId));
    if (!project) return null;

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPressOut={onClose}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => toggleFavorite(projectId)}
            >
              <MaterialIcons 
                name={project.favorite ? "star" : "star-border"} 
                size={20} 
                color={project.favorite ? "#FFD700" : theme.colors.text} 
              />
              <Text style={[styles.menuText, { color: theme.colors.text }]}>
                {project.favorite ? I18n.t("removeFromFavorites") : I18n.t("addToFavorites")}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => exportProject(projectId)}
            >
              <MaterialIcons name="file-download" size={20} color={theme.colors.text} />
              <Text style={[styles.menuText, { color: theme.colors.text }]}>
                {I18n.t("exportProject")}
              </Text>
            </TouchableOpacity>
            
            <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => deleteProject(projectId)}
            >
              <MaterialIcons name="delete" size={20} color="#FF4444" />
              <Text style={[styles.menuText, { color: "#FF4444" }]}>
                {I18n.t("deleteProject")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View key={locale} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.colors.primary }]} 
          onPress={createProject}
        >
          <MaterialIcons name="add" size={20} color={theme.colors.white} />
          <Text style={[styles.buttonText, { color: theme.colors.white }]}>
            {I18n.t("createProject")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]} 
          onPress={importProject}
        >
          <MaterialIcons name="file-upload" size={20} color={theme.colors.white} />
          <Text style={[styles.buttonText, { color: theme.colors.white }]}>
            {I18n.t("importProject")}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="folder-open" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {I18n.t("noProjects")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[
            styles.projectCard,
            { backgroundColor: theme.colors.surface },
            String(item.id) === String(activeId) && { borderColor: theme.colors.primary, borderWidth: 2 }
          ]}>
            {/* Заголовок проекта */}
            <View style={styles.projectHeader}>
              <View style={styles.projectInfo}>
                <View style={styles.projectNameRow}>
                  {item.favorite && (
                    <MaterialIcons name="star" size={16} color="#FFD700" style={styles.favoriteIcon} />
                  )}
                  <Text style={[styles.projectName, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text style={[styles.projectDate, { color: theme.colors.textSecondary }]}>
                  {I18n.t("created")}: {formatDate(item.createdAt || item.created)}
                </Text>
                {String(item.id) === String(activeId) && (
                  <View style={[styles.activeBadge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.activeBadgeText, { color: theme.colors.white }]}>
                      {I18n.t("activeProject")}
                    </Text>
                  </View>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setShowMenuForProject(item.id)}
              >
                <MaterialIcons name="more-vert" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Кнопка выбора */}
            {String(item.id) !== String(activeId) && (
              <TouchableOpacity
                style={[styles.selectButton, { borderColor: theme.colors.primary }]}
                onPress={() => {
                  selectProject(item.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectButtonText, { color: theme.colors.primary }]}>
                  {I18n.t("selectProject")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        contentContainerStyle={styles.listContainer}
      />

      {/* Модальное окно создания проекта */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.createModalOverlay}>
          <View style={[styles.createModalContainer, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.createModalTitle, { color: theme.colors.text }]}>
              {I18n.t("createProject")}
            </Text>
            <TextInput
              style={[styles.createModalInput, { 
                borderColor: theme.colors.border, 
                color: theme.colors.text 
              }]}
              placeholder={I18n.t("projectName")}
              placeholderTextColor={theme.colors.textSecondary}
              value={newProjectName}
              onChangeText={setNewProjectName}
              autoFocus
            />
            <View style={styles.createModalButtons}>
              <TouchableOpacity
                style={[styles.createModalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewProjectName("");
                }}
              >
                <Text style={[styles.createModalButtonText, { color: theme.colors.text }]}>
                  {I18n.t("cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createModalButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleCreateProject}
              >
                <Text style={[styles.createModalButtonText, { color: theme.colors.white }]}>
                  {I18n.t("create")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Меню действий */}
      <MenuModal
        projectId={showMenuForProject}
        visible={showMenuForProject !== null}
        onClose={() => setShowMenuForProject(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  buttonText: {
    fontWeight: "bold",
  },
  listContainer: {
    paddingBottom: 100, // Add padding for the modal
  },
  projectCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  projectInfo: {
    flex: 1,
  },
  projectNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  favoriteIcon: {
    marginRight: 4,
  },
  projectName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  projectDate: {
    fontSize: 12,
  },
  activeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  moreButton: {
    padding: 8,
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-end",
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menuContainer: {
    width: "80%",
    maxWidth: 300,
    borderRadius: 12,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuText: {
    marginLeft: 12,
    fontSize: 16,
  },
  menuDivider: {
    height: 1,
    marginVertical: 8,
  },
  createModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  createModalContainer: {
    width: "90%",
    maxWidth: 350,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  createModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  createModalInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: "#f5f5f5",
  },
  createModalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  createModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  createModalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
