import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  useTheme,
  Card,
  Button,
  Surface,
  IconButton,
  Divider,
} from 'react-native-paper';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { createStackNavigator } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import I18n from '../../Localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Импорт существующих компонентов
import DataProcessing from './DataProcessing';
import JournalManager from './JournalManager';
import ProjectManager from './ProjectManager';
import ExportManager from './ExportManager';
import NewWizard from './NewWizard';

const { width } = Dimensions.get('window');
const Stack = createStackNavigator();

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
      // Загружаем все проекты из AsyncStorage
      const projectsData = await AsyncStorage.getItem('pumping_projects');
      if (projectsData) {
        const allProjects = JSON.parse(projectsData);
        
        // Сортируем по lastAccessDate (последние сначала) и берем первые 3
        const sortedProjects = allProjects
          .filter(project => project.lastAccessDate) // Только проекты с датой доступа
          .sort((a, b) => new Date(b.lastAccessDate) - new Date(a.lastAccessDate))
          .slice(0, 3)
          .map(project => ({
            id: project.id,
            name: project.name,
            date: new Date(project.lastAccessDate).toLocaleDateString('ru-RU'),
            wells: project.journals?.length || 0,
            favorite: project.favorite || false,
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

  const quickActions = [
    {
      id: 'new-wizard',
      title: 'Создать журнал',
      subtitle: 'Мастер создания журнала откачки',
      icon: 'add-box',
      color: theme.colors.primary,
      onPress: () => navigation.navigate('Wizard'),
      featured: true,
    },
    {
      id: 'data-processing',
      title: 'Обработка данных',
      subtitle: 'Анализ результатов откачки',
      icon: 'analytics',
      color: theme.colors.secondary,
      onPress: () => navigation.navigate('DataProcessing'),
    },
    {
      id: 'journal',
      title: 'Журнал наблюдений',
      subtitle: 'Ведение записей',
      icon: 'book',
      color: theme.colors.secondary,
      onPress: () => navigation.navigate('JournalManager'),
    },
    {
      id: 'projects',
      title: 'Управление проектами',
      subtitle: 'Сохранённые проекты',
      icon: 'folder',
      color: theme.colors.secondary,
      onPress: () => navigation.navigate('ProjectManager'),
    },
    {
      id: 'export',
      title: 'Экспорт результатов',
      subtitle: 'Выгрузка отчётов',
      icon: 'file-download',
      color: theme.colors.secondary,
      onPress: () => navigation.navigate('ExportManager'),
          },
  ];

  const renderQuickAction = (action) => (
    <TouchableOpacity
      key={action.id}
      style={[
        styles.actionCard,
        { 
          borderColor: theme.colors.border,
          backgroundColor: action.featured ? theme.colors.primary : theme.colors.surface,
        }
      ]}
      onPress={action.onPress}
      activeOpacity={0.7}
    >
      <Surface style={[
        styles.actionIcon,
        { backgroundColor: action.featured ? theme.colors.white : action.color }
      ]}>
        <Icon 
          name={action.icon} 
          size={24} 
          color={action.featured ? theme.colors.primary : theme.colors.white} 
        />
      </Surface>
      
      <View style={styles.actionContent}>
        <Text style={[
          styles.actionTitle,
          { color: action.featured ? theme.colors.white : theme.colors.text }
        ]}>
          {action.title}
        </Text>
        <Text style={[
          styles.actionSubtitle,
          { color: action.featured ? theme.colors.white : theme.colors.textSecondary }
        ]}>
          {action.subtitle}
        </Text>
      </View>
      
      <Icon 
        name="arrow-forward-ios" 
        size={16} 
        color={action.featured ? theme.colors.white : theme.colors.textSecondary} 
      />
    </TouchableOpacity>
  );

  const renderRecentProject = (project) => (
    <TouchableOpacity
      key={project.id}
      style={[styles.projectCard, { borderColor: theme.colors.border }]}
      onPress={() => {
        // Открыть проект
        navigation.navigate('DataProcessing', { projectId: project.id });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.projectHeader}>
        <View style={[styles.projectIcon, { backgroundColor: theme.colors.primary }]}>
          <Icon name="water-drop" size={20} color={theme.colors.white} />
        </View>
        <View style={styles.projectInfo}>
          <Text style={[styles.projectName, { color: theme.colors.text }]}>
            {project.name}
          </Text>
          <Text style={[styles.projectDate, { color: theme.colors.textSecondary }]}>
            {project.date} • {project.wells} скважин
          </Text>
                </View>
        <IconButton
          icon="dots-vertical"
          iconColor={theme.colors.textSecondary}
          size={20}
          onPress={() => {
            // Меню действий с проектом
          }}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Обработка откачек
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Анализ гидрогеологических данных
        </Text>
                </View>

      {/* Быстрый старт */}
      <View style={styles.section}>
        
        
        {/* Главная кнопка создания проекта */}
        <TouchableOpacity
          style={[styles.quickStartCard, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('Wizard')}
          activeOpacity={0.8}
        >
          <View style={styles.quickStartContent}>
            <View style={[styles.quickStartIcon, { backgroundColor: theme.colors.white }]}>
              <Icon name="add" size={32} color={theme.colors.primary} />
            </View>
            <View style={styles.quickStartText}>
              <Text style={[styles.quickStartTitle, { color: theme.colors.white }]}>
                Создать журнал откачки
              </Text>
              <Text style={[styles.quickStartSubtitle, { color: theme.colors.white }]}>
                Мастер создания нового журнала обработки откачки
              </Text>
            </View>
            <Icon name="arrow-forward" size={24} color={theme.colors.white} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Инструменты */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Инструменты
        </Text>
        
        <View style={styles.actionsGrid}>
          {quickActions.slice(1).map(renderQuickAction)}
        </View>
                </View>

      {/* Последние проекты */}
      {recentProjects.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Последние проекты
            </Text>
            <Button
              mode="text"
              textColor={theme.colors.primary}
              compact
              onPress={() => navigation.navigate('ProjectManager')}
            >
              Все проекты
            </Button>
          </View>
          
          <View style={styles.projectsList}>
            {recentProjects.map(renderRecentProject)}
          </View>
        </View>
      )}

      {/* Справочная информация */}
      <View style={styles.section}>
        <Card style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.infoContent}>
              <Icon name="info-outline" size={24} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                  Обработка откачек
                </Text>
                <Text style={[styles.infoDescription, { color: theme.colors.textSecondary }]}>
                  Модуль для анализа результатов откачных испытаний скважин. 
                  Создавайте проекты, ведите журналы наблюдений и получайте подробные отчёты.
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
                </View>
    </ScrollView>
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
    padding: 20,
  },
  header: {
    marginBottom: 24,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
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
  quickStartCard: {
    borderRadius: 16,
    padding: 20,
  },
  quickStartContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickStartIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickStartText: {
    flex: 1,
  },
  quickStartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quickStartSubtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
  },
  projectsList: {
    gap: 8,
  },
  projectCard: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  projectInfo: {
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
  infoCard: {
    elevation: 2,
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
