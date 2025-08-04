import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import { LanguageContext } from "../../LanguageContext";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";
import { 
  TextInput, 
  useTheme, 
  Card, 
  Surface, 
  Button,
  Chip,
  IconButton,
  Divider,
  Portal
} from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

// Утилиты
const formatDate = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const getJournalTypeIcon = (testType) => {
  switch (testType?.toLowerCase()) {
    case 'откачка':
      return 'water-pump';
    case 'наливка':
      return 'water-plus';
    case 'экспресс':
      return 'timer-sand';
    default:
      return 'water-well';
  }
};

// Компонент выбора даты/времени (мемоизированный)
const DateTimeSelector = React.memo(({ value, onChange, theme }) => {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [tempDate, setTempDate] = useState(value ? new Date(value) : new Date());

  const openPicker = useCallback(() => {
    setTempDate(value ? new Date(value) : new Date());
    setShowDate(true);
  }, [value]);

  const onDateChange = useCallback((event, selectedDate) => {
    setShowDate(false);
    if (event.type === "set" && selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === 'android') {
      setShowTime(true);
      } else {
        onChange(selectedDate);
    }
  }
  }, [onChange]);

  const onTimeChange = useCallback((event, selectedTime) => {
    setShowTime(false);
    if (event.type === "set" && selectedTime) {
      const newDate = new Date(tempDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      newDate.setSeconds(selectedTime.getSeconds());
      onChange(newDate);
    }
  }, [tempDate, onChange]);

  return (
    <>
      <TouchableOpacity onPress={openPicker}>
        <Text style={[styles.dateText, { color: theme.colors.primary }]}>
                          {value ? formatDate(value) : I18n.t("selectDateTime")}
        </Text>
      </TouchableOpacity>
      
      {Platform.OS === "android" && showDate && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
      
      {Platform.OS === "android" && showTime && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          is24Hour={true}
          onChange={onTimeChange}
        />
      )}
      
      {Platform.OS === "ios" && showDate && (
        <Modal
          visible={showDate}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDate(false)}
        >
          <View style={styles.iosPickerOverlay}>
            <View style={[styles.iosPickerContainer, { backgroundColor: theme.colors.surface }]}>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    onChange(selectedDate);
                  }
                  setShowDate(false);
                }}
                style={styles.iosPickerStyle}
              />
              <Button
                mode="text"
                onPress={() => setShowDate(false)}
                textColor={theme.colors.primary}
                >
                  OK
              </Button>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
});

// Компонент карточки журнала (мемоизированный)
const JournalCard = React.memo(({ 
  journal, 
  index, 
  onView, 
  onEdit, 
  onToggleFavorite, 
  onDelete, 
  onExport,
  onDateChange,
  theme 
}) => {
  const journalIcon = getJournalTypeIcon(journal.testType);
  
  return (
    <Card style={[styles.journalCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        {/* Заголовок журнала */}
        <View style={styles.journalHeader}>
          <View style={styles.journalTitleRow}>
            <MaterialCommunityIcons 
              name={journalIcon} 
              size={24} 
              color={theme.colors.primary} 
            />
            <View style={styles.journalTitleText}>
              <Text style={[styles.journalTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {journal.name || `${journal.testType} ${index + 1}`}
              </Text>
              <Text style={[styles.journalSubtitle, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                {journal.testType} • {journal.layerType}
              </Text>
            </View>
            
            {journal.favorite && (
              <MaterialIcons name="star" size={20} color="#FFD700" />
            )}
          </View>
        </View>

        {/* Кнопки действий */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.journalActions}
        >
          <IconButton
            icon="star"
            iconColor={journal.favorite ? "#FFD700" : theme.colors.outline}
            size={18}
            onPress={() => onToggleFavorite(journal)}
            style={styles.actionButton}
          />
          <IconButton
            icon="eye"
            iconColor={theme.colors.primary}
            size={18}
            onPress={() => onView(journal)}
            style={styles.actionButton}
          />
          <IconButton
            icon="pencil"
            iconColor={theme.colors.secondary}
            size={18}
            onPress={() => onEdit(journal)}
            style={styles.actionButton}
          />
          <IconButton
            icon="export"
            iconColor={theme.colors.tertiary}
            size={18}
            onPress={() => onExport(journal)}
            style={styles.actionButton}
          />
          <IconButton
            icon="delete"
            iconColor={theme.colors.error}
            size={18}
            onPress={() => onDelete(journal)}
            style={styles.actionButton}
          />
        </ScrollView>

        <Divider style={{ marginVertical: 12 }} />

        {/* Информация о журнале */}
        <View style={styles.journalInfo}>
          <View style={styles.infoRow}>
            <MaterialIcons name="category" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
              {journal.boundary}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="data-usage" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
              {journal.dataType} • {journal.dataRows?.length || 0} строк
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={16} color={theme.colors.onSurfaceVariant} />
            <DateTimeSelector
              value={journal.date}
              onChange={(newDate) => onDateChange(index, newDate)}
              theme={theme}
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

// Модальное окно просмотра журнала
const JournalDetailModal = React.memo(({ 
  journal, 
  visible, 
  onClose, 
  onEdit, 
  onExport,
  theme 
}) => {
  if (!journal) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: theme.colors.surface }
        ]}
      >
        {/* Заголовок */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            <MaterialCommunityIcons 
              name={getJournalTypeIcon(journal.testType)} 
              size={24} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.modalTitle, { color: theme.colors.primary }]}>
              Детали журнала
            </Text>
          </View>
          <IconButton
            icon="close"
            iconColor={theme.colors.onSurfaceVariant}
            onPress={onClose}
            size={20}
          />
        </View>

        <Divider style={{ marginBottom: 16 }} />

        {/* Основная информация */}
        <ScrollView 
          style={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalContent}>
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: theme.colors.primary }]}>
                Тип испытания
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
                {journal.testType}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: theme.colors.primary }]}>
                Тип пласта
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
                {journal.layerType}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: theme.colors.primary }]}>
                Граничные условия
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
                {journal.boundary}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: theme.colors.primary }]}>
                Тип данных
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
                {journal.dataType}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: theme.colors.primary }]}>
                Создан
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
                {formatDate(journal.date)}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: theme.colors.primary }]}>
                Количество измерений
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.onSurface }]}>
                {journal.dataRows?.length || 0} строк
              </Text>
            </View>

            {/* Превью данных */}
            {journal.dataRows?.length > 0 && (
              <Surface style={[styles.dataPreview, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.primary }]}>
                  Превью данных
                </Text>
                {journal.dataRows.slice(0, 5).map((row, index) => (
                  <Text key={index} style={[styles.dataRow, { color: theme.colors.onSurfaceVariant }]}>
                    {row.t && row.s
                      ? `t: ${row.t}, s: ${row.s}`
                      : row.t && row.s1 && row.s2
                      ? `t: ${row.t}, s1: ${row.s1}, s2: ${row.s2}`
                      : row.s && row.r
                      ? `s: ${row.s}, r: ${row.r}`
                      : I18n.t("noData")}
                  </Text>
                ))}
                {journal.dataRows.length > 5 && (
                  <Text style={[styles.moreData, { color: theme.colors.onSurfaceVariant }]}>
                    ... и еще {journal.dataRows.length - 5} строк
                  </Text>
                )}
              </Surface>
            )}
          </View>
        </ScrollView>

        {/* Кнопки действий - sticky footer */}
        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => {
              onClose();
              onEdit(journal);
            }}
            style={styles.modalButton}
            compact
          >
            Редактировать
          </Button>
          <Button
            mode="contained"
            onPress={() => onExport(journal)}
            style={styles.modalButton}
            compact
          >
            Экспорт
          </Button>
        </View>
      </Modal>
    </Portal>
  );
});

// Модальное окно редактирования
const EditJournalModal = React.memo(({ 
  journal, 
  visible, 
  onClose, 
  onSave,
  theme 
}) => {
  const [editData, setEditData] = useState({});

  useEffect(() => {
    if (journal) {
      setEditData({
        testType: journal.testType || '',
        layerType: journal.layerType || '',
        boundary: journal.boundary || '',
        dataType: journal.dataType || '',
      });
    }
  }, [journal]);

  const handleSave = useCallback(() => {
    onSave(editData);
  }, [editData, onSave]);

  if (!journal) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: theme.colors.surface }
        ]}
      >
        {/* Заголовок */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            <MaterialIcons name="edit" size={24} color={theme.colors.primary} />
            <Text style={[styles.modalTitle, { color: theme.colors.primary }]}>
              Редактировать журнал
            </Text>
          </View>
          <IconButton
            icon="close"
            iconColor={theme.colors.onSurfaceVariant}
            onPress={onClose}
            size={20}
          />
        </View>

        <Divider style={{ marginBottom: 16 }} />

        {/* Поля ввода */}
        <ScrollView 
          style={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalContent}>
            <TextInput
              label={I18n.t("testTypeLabel")}
              value={editData.testType}
              onChangeText={(text) => setEditData(prev => ({ ...prev, testType: text }))}
              style={styles.input}
              mode="outlined"
              dense
            />

            <TextInput
              label={I18n.t("layerTypeLabel")}
              value={editData.layerType}
              onChangeText={(text) => setEditData(prev => ({ ...prev, layerType: text }))}
              style={styles.input}
              mode="outlined"
              dense
            />

            <TextInput
              label={I18n.t("boundaryConditionsLabel")}
              value={editData.boundary}
              onChangeText={(text) => setEditData(prev => ({ ...prev, boundary: text }))}
              style={styles.input}
              mode="outlined"
              dense
            />

            <TextInput
              label={I18n.t("dataTypeLabel")}
              value={editData.dataType}
              onChangeText={(text) => setEditData(prev => ({ ...prev, dataType: text }))}
              style={styles.input}
              mode="outlined"
              dense
            />
          </View>
        </ScrollView>

        {/* Кнопки действий - sticky footer */}
        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={onClose}
            style={styles.modalButton}
            compact
          >
            Отмена
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.modalButton}
            compact
          >
            Сохранить
          </Button>
        </View>
      </Modal>
    </Portal>
  );
});

// Основной компонент
export default function JournalManager({ route }) {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  
  // Получаем параметры из навигации
  const projectId = route?.params?.projectId;
  const projectName = route?.params?.projectName;
  
  // Состояние
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Мемоизированные функции
  const loadActiveProject = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Если у нас есть projectId из навигации, используем его
      const id = projectId || await AsyncStorage.getItem("pumping_active_project_id");
      if (!id) {
        setActiveProject(null);
        setJournals([]);
        setIsLoading(false);
        return;
      }
      
      const projectsRaw = await AsyncStorage.getItem("pumping_projects");
      if (!projectsRaw) {
        setActiveProject(null);
        setJournals([]);
        setIsLoading(false);
        return;
      }
      
      const projects = JSON.parse(projectsRaw);
      const project = projects.find((p) => String(p.id) === String(id));
      
      if (!project) {
        console.error("Project not found:", id);
        setActiveProject(null);
        setJournals([]);
        setIsLoading(false);
        return;
      }
      
      setActiveProject(project);
      setJournals(project.journals || []);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveProject(null);
      setJournals([]);
      setIsLoading(false);
    }
  }, [projectId]);

  const saveJournals = useCallback(async (newJournals) => {
    if (!activeProject) return;
    
    try {
    const projectsRaw = await AsyncStorage.getItem("pumping_projects");
    let projects = JSON.parse(projectsRaw);
      
    projects = projects.map((p) =>
      String(p.id) === String(activeProject.id) ? { ...p, journals: newJournals } : p
    );
      
    await AsyncStorage.setItem("pumping_projects", JSON.stringify(projects));
    setJournals(newJournals);
    } catch (error) {
      console.error("Error saving journals:", error);
  }
  }, [activeProject]);

  // Обработчики событий
  const handleViewJournal = useCallback((journal) => {
    setSelectedJournal(journal);
    setShowDetailModal(true);
  }, []);

  const handleEditJournal = useCallback((journal) => {
    setSelectedJournal(journal);
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(async (editData) => {
    if (!selectedJournal) return;
    
    const updatedJournals = journals.map((j) =>
      j === selectedJournal ? { ...j, ...editData } : j
    );
    
    await saveJournals(updatedJournals);
    setShowEditModal(false);
    setSelectedJournal(null);
            Alert.alert(I18n.t("success"), I18n.t("journalUpdated"));
  }, [selectedJournal, journals, saveJournals]);

  const handleToggleFavorite = useCallback(async (journal) => {
    const updatedJournals = journals.map((j) =>
      j === journal ? { ...j, favorite: !j.favorite } : j
    );
    await saveJournals(updatedJournals);
  }, [journals, saveJournals]);

  const handleDeleteJournal = useCallback((journal) => {
    Alert.alert(
              I18n.t("deleteJournalConfirm"),
      `Удалить журнал "${journal.name || journal.testType}"?`,
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
  }, [journals, saveJournals]);

  const handleExportJournal = useCallback(async (journal) => {
    try {
      const journalData = JSON.stringify(journal, null, 2);
      const fileName = `journal_${journal.testType}_${Date.now()}.json`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, journalData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      await Sharing.shareAsync(fileUri, { mimeType: "application/json" });
    } catch (error) {
              Alert.alert(I18n.t("error"), I18n.t("exportError"));
    }
  }, []);

  const handleImportJournal = useCallback(async () => {
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
        Alert.alert(I18n.t("error"), I18n.t("invalidFileFormat"));
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
              Alert.alert(I18n.t("success"), I18n.t("journalImported"));
    } catch (e) {
              Alert.alert(I18n.t("error"), I18n.t("importError"));
    }
  }, [journals, saveJournals]);

  const handleDateChange = useCallback(async (index, newDate) => {
    const newJournals = [...journals];
    if (newJournals[index]) {
      newJournals[index].date = newDate.getTime();
      await saveJournals(newJournals);
    }
  }, [journals, saveJournals]);

  // Загрузка данных
  useEffect(() => {
    loadActiveProject();
  }, [loadActiveProject]);

  // Мемоизированный рендер элемента списка
  const renderJournal = useCallback(({ item, index }) => (
    <JournalCard
      journal={item}
      index={index}
      onView={handleViewJournal}
      onEdit={handleEditJournal}
      onToggleFavorite={handleToggleFavorite}
      onDelete={handleDeleteJournal}
      onExport={handleExportJournal}
      onDateChange={handleDateChange}
      theme={theme}
    />
  ), [
    handleViewJournal,
    handleEditJournal, 
    handleToggleFavorite,
    handleDeleteJournal,
    handleExportJournal,
    handleDateChange,
    theme
  ]);

  // Проверка состояний
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="loading" size={64} color={theme.colors.outline} />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          Загрузка проекта...
        </Text>
      </View>
    );
  }

  if (!activeProject) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="folder-open" size={64} color={theme.colors.outline} />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          Нет активного проекта
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {I18n.t("selectProjectInManagement")}
        </Text>
      </View>
    );
  }

    return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Заголовок */}
      <Surface style={[styles.headerCard, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="notebook" size={32} color={theme.colors.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>
              {I18n.t("journalManagement")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {I18n.t("project")}: {activeProject.name}
            </Text>
          </View>
        </View>
        <View style={styles.headerActionsRow}>
          <Button
            mode="contained"
            icon={({ color, size }) => (
              <MaterialCommunityIcons name="plus" size={size} color={theme.colors.white} />
            )}
            onPress={handleImportJournal}
            compact
            style={{borderRadius: 12}}
          >
            <Text style={{ color: theme.colors.white }}>{I18n.t("import")}</Text>
          </Button>
        </View>
      </Surface>

      {/* Список журналов */}
      <FlatList
        data={journals}
        keyExtractor={(item, index) => `${item.id || index}`}
        renderItem={renderJournal}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="book-plus" size={64} color={theme.colors.outline} />
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
              Нет журналов
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Создайте журнал с помощью мастера или импортируйте существующий
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Модальные окна */}
      <JournalDetailModal
        journal={selectedJournal}
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedJournal(null);
        }}
        onEdit={handleEditJournal}
        onExport={handleExportJournal}
        theme={theme}
      />

      <EditJournalModal
        journal={selectedJournal}
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedJournal(null);
        }}
        onSave={handleSaveEdit}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 5,
    textAlign: "center",
  },
  container: {
    flex: 1,
    padding: 12,
  },
  headerCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerText: {
    marginLeft: 10,
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 100, // Add padding for the modal
    paddingHorizontal: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  journalCard: {
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    marginHorizontal: 4,
  },
  journalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  journalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  journalTitleText: {
    marginLeft: 8,
    flex: 1,
  },
  journalTitle: {
    fontSize: 15,
    fontWeight: "bold",
  },
  journalSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  journalActions: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 140,
  },
  actionButton: {
    padding: 1,
    marginHorizontal: 1,
  },
  favoriteIcon: {
    fontSize: 18,
  },
  actionIcon: {
    fontSize: 16,
  },
  journalInfo: {
    gap: 4,
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  infoText: {
    fontSize: 11,
    marginLeft: 5,
    flex: 1,
  },
  modalContainer: {
    borderRadius: 16,
    padding: 0,
    width: "85%",
    maxWidth: 400,
    maxHeight: "75%",
    margin: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 12,
  },
  modalScrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalContent: {
    paddingBottom: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  dataPreview: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  dataRow: {
    fontSize: 13,
    marginBottom: 4,
    fontFamily: "monospace",
  },
  moreData: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  dateText: {
    textDecorationLine: "underline",
  },
  iosPickerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  iosPickerContainer: {
    borderRadius: 12,
    padding: 20,
    width: 300,
    alignItems: "center",
  },
  iosPickerStyle: {
    width: 260,
  },
});
