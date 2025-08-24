/**
 * Главный модуль обработки откачек (Pumping Test Processing)
 * 
 * Этот модуль является центральной частью приложения для анализа данных откачки скважин.
 * Он включает в себя:
 * - Главный экран с обзором проектов и быстрым доступом к функциям
 * - Навигационный стек для всех подразделов модуля
 * - Управление проектами (создание, импорт, экспорт)
 * - Обработку данных откачки
 * - Управление журналами наблюдений
 * 
 * Структура модуля:
 * - MainScreen: главный экран с обзором проектов
 * - Wizard: мастер создания новых журналов
 * - DataProcessing: обработка и анализ данных
 * - JournalManager: управление журналами наблюдений
 * - ProjectManager: управление проектами
 * - ExportManager: экспорт результатов
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  BackHandler,
  Modal,
  TextInput,
} from 'react-native';
import {
  useTheme,
  Card,
  Button,
  Surface,
  IconButton,
  Divider,
  Chip,
  Menu,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createStackNavigator } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import I18n from '../../Localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Импорт компонентов модуля
import DataProcessing from './DataProcessing';
// Удалены экраны старого менеджмента: все действия теперь на карточке
// import JournalManager from './JournalManager';
// import ProjectManager from './ProjectManager';
// import ExportManager from './ExportManager';
import NewWizard from './NewWizard';

// Получаем ширину экрана для адаптивного дизайна
const { width } = Dimensions.get('window');
// Создаем стек навигатор для модуля
const Stack = createStackNavigator();

/**
 * Утилиты для работы с данными
 */

/**
 * Форматирует дату в формат DD.MM.YYYY
 * 
 * @param {Date|string|number} date - Дата для форматирования
 * @returns {string} Отформатированная дата
 */
const formatDate = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Обрезает текст до указанной длины с добавлением многоточия
 * 
 * @param {string} text - Текст для обрезки
 * @param {number} maxLength - Максимальная длина (по умолчанию 20)
 * @returns {string} Обрезанный текст
 */
const truncateText = (text, maxLength = 20) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Возвращает иконку для типа испытания
 * 
 * @param {string} testType - Тип испытания
 * @returns {string} Название иконки
 */
const getTestTypeIcon = (testType) => {
  switch (testType?.toLowerCase()) {
    case 'откачка/восстановление':
      return 'water-pump';
    case 'люжон':
      return 'water-plus';
    case 'экспресс откачка':
      return 'timer-sand';
    case 'пакерное испытание':
      return 'water-plus';
    default:
      return 'water-well';
  }
};

/**
 * Переводит тип испытания в английский для локализации
 * 
 * @param {string} testType - Тип испытания на русском
 * @returns {string} Ключ локализации для типа испытания
 */
const translateTestType = (testType) => {
  if (!testType) return 'pumping';
  
  const testTypeLower = testType.toLowerCase();
  switch (testTypeLower) {
    case 'откачка/восстановление':
      return 'pumping';
    case 'люжон':
      return 'lugeon';
    case 'экспресс откачка':
      return 'express';
    case 'пакерное испытание':
      return 'injection';
    default:
      return testType; // Возвращаем как есть, если не знаем перевод
  }
};

/**
 * Главный экран модуля обработки откачек
 * 
 * Отображает:
 * - Кнопку создания нового журнала
 * - Список последних проектов
 * - Возможность импорта проектов
 * - Информационную карточку о модуле
 * 
 * @param {Object} navigation - Объект навигации
 */
function MainScreen({ navigation }) {
  // Получаем текущую тему для адаптивного дизайна
  const theme = useTheme();
  // Состояние для хранения последних проектов
  const [recentProjects, setRecentProjects] = useState([]);
  const [createName, setCreateName] = useState('');
  const [createOfrType, setCreateOfrType] = useState('Откачка/Восстановление');
  const [ofrMenuVisible, setOfrMenuVisible] = useState(false);
  const [ofrMenuAnchor, setOfrMenuAnchor] = useState(null);
  const [editProject, setEditProject] = useState(null);

  /**
   * Загружает последние проекты при монтировании компонента
   */
  useEffect(() => {
    loadRecentProjects();
  }, []);

  /**
   * Обновляет список проектов при фокусе на экране
   * Позволяет обновить данные после возврата с других экранов
   */
  useFocusEffect(
    React.useCallback(() => {
      loadRecentProjects();
    }, [])
  );

  /**
   * Загружает последние проекты из AsyncStorage
   * 
   * Логика загрузки:
   * 1. Получает данные проектов из AsyncStorage
   * 2. Парсит JSON и валидирует структуру
   * 3. Сортирует по дате создания (новые первые)
   * 4. Берет первые 3 проекта для отображения
   * 5. Обрабатывает ошибки и устанавливает пустой массив при проблемах
   */
  const loadRecentProjects = async () => {
    try {
      const projectsData = await AsyncStorage.getItem('pumping_projects');
      if (projectsData) {
        const allProjects = JSON.parse(projectsData);
        
        // Проверяем, что это массив
        if (!Array.isArray(allProjects)) {
          console.error('Invalid projects data format');
          setRecentProjects([]);
          return;
        }
        
        // Сортируем: избранные наверху, затем по дате создания (новые первые)
        const sortedProjects = allProjects
          .filter(project => project && project.id && project.name) // Фильтруем валидные проекты
          .sort((a, b) => {
            if ((b.favorite ? 1 : 0) !== (a.favorite ? 1 : 0)) {
              return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
            }
            return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
          })
          .map(project => ({
            id: project.id,
            name: project.name,
            date: project.createdAt || project.date || Date.now(),
            testType: project.testType || 'Откачка/Восстановление',
            favorite: project.favorite || false,
            journals: project.journals || [],
          }));
        
        setRecentProjects(sortedProjects);
      } else {
        setRecentProjects([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки последних проектов:', error);
      setRecentProjects([]);
    }
  };

  const handleImportProject = async () => {
    try {
      // Открываем выбор файла с таймаутом для предотвращения зависаний
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const res = await Promise.race([
        DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true, // Важно для больших файлов
        }),
        timeoutPromise
      ]);
      
      if (res.canceled || !res.assets || !res.assets[0]) return;
      
      const fileUri = res.assets[0].uri;
      
      // Добавляем обработку ошибок и таймаут для чтения файла
      const readPromise = FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      const content = await Promise.race([
        readPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Read timeout')), 5000))
      ]);
      
      // Валидируем файл с размером
      if (!content || content.length === 0) {
        Alert.alert(I18n.t("error"), "Файл пуст или не может быть прочитан");
        return;
      }
      
      // Для больших файлов JSON обрабатываем частями
      let imported;
      try {
        imported = JSON.parse(content);
      } catch (e) {
        console.error('JSON parse error:', e);
        Alert.alert(I18n.t("error"), I18n.t("invalidJSONFormat"));
        return;
      }
      
      if (!imported || !imported.name || !imported.id) {
        Alert.alert(I18n.t("error"), I18n.t("invalidProjectFile"));
        return;
      }
      
      // Проверяем, нет ли в импортированном проекте слишком больших данных
      const cleanImported = {...imported};
      
      // Ограничиваем размер некоторых больших полей, если они есть
      if (cleanImported.measurements && typeof cleanImported.measurements === 'object') {
        // Убедимся, что нет повреждений в данных измерений
        Object.keys(cleanImported.measurements).forEach(wellId => {
          const well = cleanImported.measurements[wellId];
          if (typeof well !== 'object') {
            cleanImported.measurements[wellId] = { 
              pumping: [], recovery: []
            };
          }
          
          // Проверим наличие ключей и их правильный формат
          ['pumping', 'recovery'].forEach(type => {
            if (!Array.isArray(well[type])) {
              well[type] = [];
            }
            
            // Проверяем и корректируем каждое измерение
            well[type] = well[type].map(m => {
              if (!m || typeof m !== 'object') return { 
                id: Date.now() + Math.random(), 
                time: '', 
                timeUnit: 'мин', 
                drawdown: '', 
                date: new Date() 
              };
              
              // Добавим проверку даты
              if (m.date && typeof m.date === 'string') {
                try {
                  const parsedDate = new Date(m.date);
                  if (isNaN(parsedDate.getTime())) {
                    m.date = new Date();
                  } else {
                    m.date = parsedDate;
                  }
                } catch (e) {
                  m.date = new Date();
                }
              } else if (!m.date) {
                m.date = new Date();
              }
              
              return m;
            });
          });
        });
      }
      
      // Загружаем существующие проекты
      const projectsData = await AsyncStorage.getItem('pumping_projects');
      let projects = projectsData ? JSON.parse(projectsData) : [];
      if (!Array.isArray(projects)) projects = []; // Защита от ошибок в AsyncStorage
      
      // Проверяем, не существует ли уже проект с таким именем
      const existingProject = projects.find(p => p.name === cleanImported.name);
      if (existingProject) {
        Alert.alert(
          I18n.t("projectAlreadyExists"), 
          I18n.t("projectAlreadyExistsDescription", { name: cleanImported.name }),
          [
            { text: I18n.t("cancel"), style: 'cancel' },
            {
              text: I18n.t("replace"),
              style: 'destructive',
              onPress: async () => {
                try {
                  const updatedProjects = projects.map(p => 
                    String(p.id) === String(existingProject.id) ? { 
                      ...cleanImported, 
                      id: existingProject.id, 
                      createdAt: existingProject.createdAt 
                    } : p
                  );
                  await AsyncStorage.setItem('pumping_projects', JSON.stringify(updatedProjects));
                  await AsyncStorage.setItem('pumping_active_project_id', String(existingProject.id));
                  Alert.alert(I18n.t("success"), I18n.t("projectUpdated"));
                  loadRecentProjects();
                } catch (err) {
                  console.error('Error replacing project:', err);
                  Alert.alert('Ошибка', 'Не удалось заменить проект');
                }
              }
            }
          ]
        );
        return;
      }
      
      // Добавляем новый проект
      const newProject = {
        ...cleanImported,
        id: Date.now().toString(),
        createdAt: Date.now(),
        favorite: false,
      };
      
      // Добавляем с проверкой размера и структуры
      projects.unshift(newProject);
      await AsyncStorage.setItem('pumping_projects', JSON.stringify(projects));
      
      // Устанавливаем как активный
      await AsyncStorage.setItem('pumping_active_project_id', String(newProject.id));
      
      Alert.alert('Успех', 'Проект импортирован и установлен как активный');
      loadRecentProjects();
    } catch (e) {
      console.error('Import error:', e);
      Alert.alert('Ошибка', 'Не удалось импортировать файл. ' + (e.message || ''));
    }
  };

  const handleToggleFavorite = async (projectId) => {
    try {
      const projectsData = await AsyncStorage.getItem('pumping_projects');
      if (!projectsData) return;
      
      let projects = JSON.parse(projectsData);
      const projectIndex = projects.findIndex(p => String(p.id) === String(projectId));
      
      if (projectIndex !== -1) {
        projects[projectIndex].favorite = !projects[projectIndex].favorite;
        await AsyncStorage.setItem('pumping_projects', JSON.stringify(projects));
        loadRecentProjects();
      }
    } catch (error) {
      console.error('Ошибка обновления избранного:', error);
      Alert.alert('Ошибка', 'Не удалось обновить избранное');
    }
  };

  const handleExportProject = async (project) => {
    try {
      // Проверяем, что проект содержит необходимые данные
      if (!project || !project.name || !project.id) {
        Alert.alert('Ошибка', 'Неверные данные проекта для экспорта');
        return;
      }
      
      const projectData = JSON.stringify(project, null, 2);
      const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, projectData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      // Проверяем доступность sharing
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Ошибка', 'Функция экспорта недоступна на этом устройстве');
        return;
      }
      
      await Sharing.shareAsync(fileUri, { 
        mimeType: 'application/json',
        dialogTitle: `Экспорт проекта: ${project.name}`
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Ошибка', 'Не удалось экспортировать проект');
    }
  };

  const handleDeleteProject = async (projectId) => {
    Alert.alert(
      I18n.t('delete'),
      I18n.t('deleteJournalConfirm'),
      [
        { text: I18n.t('cancel'), style: 'cancel' },
        {
          text: I18n.t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const projectsData = await AsyncStorage.getItem('pumping_projects');
              if (!projectsData) return;
              let projects = JSON.parse(projectsData);
              projects = projects.filter(p => String(p.id) !== String(projectId));
              await AsyncStorage.setItem('pumping_projects', JSON.stringify(projects));
              const activeId = await AsyncStorage.getItem('pumping_active_project_id');
              if (activeId && String(activeId) === String(projectId)) {
                await AsyncStorage.removeItem('pumping_active_project_id');
              }
              loadRecentProjects();
            } catch (e) {
              Alert.alert('Ошибка', 'Не удалось удалить проект');
            }
          }
        }
      ]
    );
  };

  const openEditModal = (project) => {
    setEditProject(project);
    // Вместо простого модального окна, открываем полноценный редактор
    navigation.navigate('Wizard', { 
      projectId: project.id,
      projectName: project.name,
      ofrType: project.testType,
      isEditing: true 
    });
  };

  const renderRecentProject = (project) => (
    <Card key={project.id} style={[styles.projectCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        {/* Заголовок проекта */}
        <View style={styles.projectHeader}>
          <View style={styles.projectInfo}>
            <MaterialCommunityIcons 
              name={getTestTypeIcon(project.testType)} 
              size={24} 
              color={theme.colors.primary} 
            />
            <View style={styles.projectText}>
              <Text style={[styles.projectName, { color: theme.colors.onSurface }]}>
                {truncateText(project.name)}
              </Text>
              <Text style={[styles.projectDate, { color: theme.colors.onSurfaceVariant }]}>
                {formatDate(project.date)} | {I18n.t(String(translateTestType(project.testType)))}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.projectActions, { 
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: theme.colors.outline,
            
          }]}>
            <IconButton
              icon={project.favorite ? 'star' : 'star-outline'}
              iconColor={project.favorite ? '#FFD700' : theme.colors.outline}
              size={20}
              onPress={() => handleToggleFavorite(project.id)}
              style={{ marginHorizontal: 2 }}
            />
            <IconButton
              icon="pencil"
              iconColor={theme.colors.primary}
              size={20}
              onPress={() => openEditModal(project)}
              style={{ marginHorizontal: 2 }}
            />
            <IconButton
              icon="export"
              iconColor={theme.colors.primary}
              size={20}
              onPress={() => handleExportProject(project)}
              style={{ marginHorizontal: 2 }}
            />
            <IconButton
              icon="delete"
              iconColor={theme.colors.error}
              size={20}
              onPress={() => handleDeleteProject(project.id)}
              style={{ marginHorizontal: 2 }}
            />
          </View>
        <Divider style={{ marginVertical: 12 }} />

        {/* Кнопки действий */}
        <View style={styles.projectButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#031888' }]}
            onPress={async () => {
              try {
                if (!project || !project.id) {
                  Alert.alert('Ошибка', 'Неверные данные проекта');
                  return;
                }
                await AsyncStorage.setItem('pumping_active_project_id', String(project.id));
                navigation.navigate('DataProcessing', { 
                  projectId: project.id,
                  projectName: project.name 
                });
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Ошибка', 'Не удалось открыть обработку. Попробуйте еще раз.');
              }
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="analytics" size={20} color={'white'} />
            <Text style={[styles.buttonText, { color: 'white' }]}>
              {I18n.t("dataProcessing")}
            </Text>
            <MaterialIcons name="chevron-right" size={16} color={'white'} />
          </TouchableOpacity>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        

        {/* Главная кнопка создания */}
        <Surface style={[styles.createCard, { backgroundColor: theme.colors.primary }]}>
          {/* Поля над кнопкой */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: 'white', marginBottom: 6, fontWeight: '600' }}>Название проекта/журнала</Text>
            <TextInput
              value={createName}
              onChangeText={setCreateName}
              placeholder={I18n.t('project')}
              placeholderTextColor={'#EEE'}
              style={{ backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: 'black' }}
            />
            <Text style={{ color: 'white', marginTop: 12, marginBottom: 6, fontWeight: '600' }}>Тип ОФР</Text>
            <View style={{ alignSelf: 'flex-start' }}>
              <Menu
                visible={ofrMenuVisible}
                onDismiss={() => setOfrMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    onPress={() => setOfrMenuVisible(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: 'white' }}
                  >
                    <Text style={{ color: theme.colors.primary, fontWeight: '600', marginRight: 8 }}>{createOfrType}</Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={theme.colors.primary} />
                  </TouchableOpacity>
                }
              >
                {['Откачка/Восстановление','Экспресс-откачка','Пакерные испытания'].map(option => (
                  <Menu.Item
                    key={option}
                    onPress={() => { setCreateOfrType(option); setOfrMenuVisible(false); }}
                    title={option}
                  />
                ))}
              </Menu>
            </View>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('Wizard', { projectName: createName, ofrType: createOfrType })}
            activeOpacity={0.8}
          >
            <View style={styles.createContent}>
              <View style={[styles.createIcon, { backgroundColor: 'white' }]}>
                <MaterialIcons name="add" size={32} color={'black'} />
              </View>
              <View style={styles.createText}>
                <Text style={[styles.createTitle, { color: 'white' }]}>
                  {I18n.t("journalProcessing")}
                </Text>
                <Text style={[styles.createSubtitle, { color: 'white' }]}>
                  {I18n.t("journalProcessingSubtitle")}
                </Text>
              </View>
              <MaterialIcons name="arrow-forward" size={24} color={'white'} />
            </View>
          </TouchableOpacity>
        </Surface>

        {/* Проекты/Журналы */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}> 
              {I18n.t("recentProjects")}
            </Text>
            <TouchableOpacity onPress={handleImportProject} style={{alignSelf: 'flex-start'}}>
                <Text style={{color: theme.colors.primary, fontSize: 16, fontWeight: 'bold'}}>
                  {I18n.t("importProject")}
                </Text>
            </TouchableOpacity>
          </View>
          
          {recentProjects.length > 0 ? (
            <View style={styles.projectsList}>
              {recentProjects.map(renderRecentProject)}
            </View>
          ) : (
            <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Card.Content>
                <View style={styles.emptyContent}>
                  <MaterialCommunityIcons name="book-plus" size={48} color={theme.colors.outline} />
                  <Text style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}>
                    {I18n.t("noProjects")}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {I18n.t("createFirstProject")}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        </View>

        {/* Информационная карточка */}
        <Card style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content>
            <View style={styles.infoContent}>
              <MaterialIcons name="info" size={24} color={theme.colors.onSurfaceVariant} />
              <View style={styles.infoText}>
                <Text style={[styles.infoTitle, { color: theme.colors.onSurfaceVariant }]}>
                  {I18n.t("journalProcessing")}
                </Text>
                <Text style={[styles.infoDescription, { color: theme.colors.onSurfaceVariant }]}>
                  {I18n.t("journalProcessingDescription")}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Нижний отступ */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// Основной навигатор модуля
export default function PumpingTestProcessing() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="MainScreen"
        component={MainScreen}
        options={{
          title: I18n.t("pumpingTestProcessingTitle"),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Wizard"
        component={NewWizard}
        options={{
          title: I18n.t("journalCreationWizard"),
        }}
      />
      <Stack.Screen
        name="DataProcessing"
        component={DataProcessing}
        options={{
          title: I18n.t("dataProcessing"),
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100, // Отступ для нижнего меню
  },
  header: {
    marginBottom: 24,
    paddingTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  importButton: {
    marginLeft: 10,
  },
  createCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  createText: {
    flex: 1,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  createSubtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  projectsList: {
    gap: 8,
  },
  projectCard: {
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  projectText: {
    marginLeft: 12,
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  projectDate: {
    fontSize: 14,
  },
  projectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexWrap: 'wrap',
  },
  projectButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyCard: {
    borderRadius: 12,
    elevation: 1,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    elevation: 2,
    marginTop: 24,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },

});
