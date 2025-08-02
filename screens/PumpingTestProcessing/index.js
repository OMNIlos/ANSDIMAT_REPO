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
} from 'react-native';
import {
  useTheme,
  Card,
  Button,
  Surface,
  IconButton,
  Divider,
  Chip,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createStackNavigator } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import I18n from '../../Localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Импорт существующих компонентов
import DataProcessing from './DataProcessing';
import JournalManager from './JournalManager';
import ProjectManager from './ProjectManager';
import ExportManager from './ExportManager';
import NewWizard from './NewWizard';

const { width } = Dimensions.get('window');
const Stack = createStackNavigator();

// Утилиты
const formatDate = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const truncateText = (text, maxLength = 20) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

const getTestTypeIcon = (testType) => {
  switch (testType?.toLowerCase()) {
    case 'откачка':
      return 'water-pump';
    case 'люжон':
      return 'water-plus';
    case 'экспресс':
      return 'timer-sand';
    case 'наливка':
      return 'water-plus';
    default:
      return 'water-well';
  }
};

// Главный экран модуля
function MainScreen({ navigation }) {
  const theme = useTheme();
  const [recentProjects, setRecentProjects] = useState([]);

  useEffect(() => {
    loadRecentProjects();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadRecentProjects();
    }, [])
  );

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
        
        // Сортируем по дате создания и берем первые 3
        const sortedProjects = allProjects
          .filter(project => project && project.id && project.name) // Фильтруем валидные проекты
          .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
          .slice(0, 3)
          .map(project => ({
            id: project.id,
            name: project.name,
            date: project.createdAt || project.date || Date.now(),
            testType: project.testType || 'Откачка',
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
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
      });
      
      if (res.canceled || !res.assets || !res.assets[0]) return;
      
      const fileUri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);
      
      let imported;
      try {
        imported = JSON.parse(content);
      } catch (e) {
        Alert.alert('Ошибка', 'Неверный формат файла JSON');
        return;
      }
      
      if (!imported || !imported.name || !imported.id) {
        Alert.alert('Ошибка', 'Файл не является проектом Ansdimat');
        return;
      }
      
      // Загружаем существующие проекты
      const projectsData = await AsyncStorage.getItem('pumping_projects');
      let projects = projectsData ? JSON.parse(projectsData) : [];
      
      // Проверяем, не существует ли уже проект с таким именем
      const existingProject = projects.find(p => p.name === imported.name);
      if (existingProject) {
        Alert.alert(
          'Проект уже существует', 
          `Проект "${imported.name}" уже существует. Хотите заменить его?`,
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Заменить',
              style: 'destructive',
              onPress: async () => {
                const updatedProjects = projects.map(p => 
                  String(p.id) === String(existingProject.id) ? { ...imported, id: existingProject.id, createdAt: existingProject.createdAt } : p
                );
                await AsyncStorage.setItem('pumping_projects', JSON.stringify(updatedProjects));
                await AsyncStorage.setItem('pumping_active_project_id', String(existingProject.id));
                Alert.alert('Успех', 'Проект обновлен');
                loadRecentProjects();
              }
            }
          ]
        );
        return;
      }
      
      // Добавляем новый проект
      const newProject = {
        ...imported,
        id: Date.now().toString(),
        createdAt: Date.now(),
        favorite: false,
      };
      
      projects.unshift(newProject);
      await AsyncStorage.setItem('pumping_projects', JSON.stringify(projects));
      
      // Устанавливаем как активный
      await AsyncStorage.setItem('pumping_active_project_id', String(newProject.id));
      
      Alert.alert('Успех', 'Проект импортирован и установлен как активный');
      loadRecentProjects();
    } catch (e) {
      console.error('Import error:', e);
      Alert.alert('Ошибка', 'Не удалось импортировать файл');
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
                {formatDate(project.date)} | {project.testType}
              </Text>
            </View>
          </View>
          
          <View style={styles.projectActions}>
            <IconButton
              icon={project.favorite ? 'star' : 'star-outline'}
              iconColor={project.favorite ? '#FFD700' : theme.colors.outline}
              size={20}
              onPress={() => handleToggleFavorite(project.id)}
            />
            <IconButton
              icon="export"
              iconColor={theme.colors.tertiary}
              size={20}
              onPress={() => handleExportProject(project)}
            />
          </View>
        </View>

        <Divider style={{ marginVertical: 12 }} />

        {/* Кнопки действий */}
        <View style={styles.projectButtons}>
                     <TouchableOpacity
             style={[styles.actionButton, { backgroundColor: '#72002F' }]}
             onPress={async () => {
               try {
                 // Проверяем, что проект существует
                 if (!project || !project.id) {
                   Alert.alert('Ошибка', 'Неверные данные проекта');
                   return;
                 }
                 
                 // Устанавливаем активный проект
                 await AsyncStorage.setItem('pumping_active_project_id', String(project.id));
                 
                 // Переходим к журналу с параметрами
                 navigation.navigate('JournalManager', { 
                   projectId: project.id,
                   projectName: project.name 
                 });
               } catch (error) {
                 console.error('Navigation error:', error);
                 Alert.alert('Ошибка', 'Не удалось открыть журнал. Попробуйте еще раз.');
               }
             }}
             activeOpacity={0.7}
           >
             <MaterialIcons name="edit" size={20} color={'white'} />
             <Text style={[styles.buttonText, { color: 'white' }]}>
               {I18n.t("journal")}
             </Text>
             <MaterialIcons name="chevron-right" size={16} color={'white'} />
           </TouchableOpacity>

           <TouchableOpacity
             style={[styles.actionButton, { backgroundColor: '#031888' }]}
             onPress={async () => {
               try {
                 // Проверяем, что проект существует
                 if (!project || !project.id) {
                   Alert.alert('Ошибка', 'Неверные данные проекта');
                   return;
                 }
                 
                 // Устанавливаем активный проект
                 await AsyncStorage.setItem('pumping_active_project_id', String(project.id));
                 
                 // Переходим к обработке с параметрами
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
  // Нижнее меню
  const bottomMenuItems = [
    {
      key: 'menu',
      label: 'Меню',
      icon: <MaterialIcons name="menu" size={28} color="#fff" />,
      onPress: () => navigation.openDrawer(),
    },
    {
      key: 'settings',
      label: 'Настройки',
      icon: <MaterialIcons name="settings" size={28} color="#fff" />,
      onPress: () => navigation.navigate('Settings'),
    },
    {
      key: 'help',
      label: 'Справка',
      icon: <MaterialIcons name="help-outline" size={28} color="#fff" />,
      onPress: () => navigation.navigate('About'),
    },
    {
      key: 'exit',
      label: 'Выход',
      icon: <MaterialCommunityIcons name="exit-to-app" size={28} color="#fff" />,
      onPress: () => {
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        } else {
          Alert.alert(
            'Выход из приложения',
            'Для выхода из приложения на iOS используйте системное меню (свайп вверх и закройте приложение вручную).'
          );
        }
      },
    },
  ];
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Заголовок с кнопкой импорта */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                {I18n.t("pumpingTestProcessingTitle")}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {I18n.t("pumpingTestDesc")}
              </Text>
              <TouchableOpacity onPress={handleImportProject} style={{alignSelf: 'flex-start', marginTop: 10}}>
                <Text style={{color: theme.colors.primary, fontSize: 16, fontWeight: 'bold'}}>
                  {I18n.t("importProject")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Главная кнопка создания */}
        <Surface style={[styles.createCard, { backgroundColor: theme.colors.primary }]}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('Wizard')}
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

        {/* Последние проекты */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Последние проекты
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ProjectManager')}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
                все проекты
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
                  Обработка откачек
                </Text>
                <Text style={[styles.infoDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Модуль для анализа результатов откачных испытаний скважин. Создавайте проекты, ведите журналы наблюдений и получайте подробные отчёты.
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Нижний отступ */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Нижнее меню */}
      <View style={styles.bottomMenuContainer}>
        {bottomMenuItems.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.bottomMenuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            {item.icon}
            <Text style={styles.bottomMenuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
          title: 'Обработка откачек',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Wizard"
        component={NewWizard}
        options={{
          title: 'Мастер создания журнала',
        }}
      />
      <Stack.Screen
        name="DataProcessing"
        component={DataProcessing}
        options={{
          title: 'Обработка данных',
        }}
      />
      <Stack.Screen
        name="JournalManager"
        component={JournalManager}
        options={{
          title: 'Журнал наблюдений',
        }}
      />
      <Stack.Screen
        name="ProjectManager"
        component={ProjectManager}
        options={{
          title: 'Управление проектами',
        }}
      />
      <Stack.Screen
        name="ExportManager"
        component={ExportManager}
        options={{
          title: 'Экспорт результатов',
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
    padding: 20,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
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
    alignItems: 'center',
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectText: {
    marginLeft: 12,
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
  bottomMenuContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#7a1434', // бордовый
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginHorizontal: 16,
    marginBottom: 50,
    paddingVertical: 12,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomMenuItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMenuLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
