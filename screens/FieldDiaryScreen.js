import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
  Share,
  Linking,
} from 'react-native';
import {
  useTheme,
  FAB,
  Card,
  Title,
  Paragraph,
  Button,
  IconButton,
  Portal,
  Dialog,
  TextInput as PaperTextInput,
  Chip,
  Menu,
  Divider,
  Snackbar,
} from 'react-native-paper';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FieldDiaryStats from '../components/FieldDiaryStats';

const { width, height } = Dimensions.get('window');

export default function FieldDiaryScreen({ navigation }) {
  const theme = useTheme();
  
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [isEditingPoint, setIsEditingPoint] = useState(false);
  const [newPointData, setNewPointData] = useState({
    title: '',
    description: '',
    type: 'observation',
  });
  const [showPointList, setShowPointList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showStats, setShowStats] = useState(false);

  // Типы точек для полевого дневника
  const pointTypes = [
    { key: 'observation', label: 'Наблюдение', icon: 'eye', color: '#4CAF50' },
    { key: 'sample', label: 'Проба', icon: 'flask', color: '#2196F3' },
    { key: 'measurement', label: 'Измерение', icon: 'ruler', color: '#FF9800' },
    { key: 'photo', label: 'Фото', icon: 'camera', color: '#9C27B0' },
    { key: 'note', label: 'Заметка', icon: 'note-text', color: '#607D8B' },
  ];

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Разрешение на доступ к местоположению отклонено');
        showSnackbar('Разрешение на доступ к местоположению отклонено');
        return;
      }

      try {
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
      } catch (error) {
        console.error('Ошибка получения местоположения:', error);
        showSnackbar('Не удалось получить текущее местоположение');
      }
      
      // Загружаем сохраненные точки
      loadSavedPoints();
    })();
  }, []);

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const loadSavedPoints = async () => {
    try {
      const savedPoints = await AsyncStorage.getItem('fieldDiaryPoints');
      if (savedPoints) {
        setPoints(JSON.parse(savedPoints));
      }
    } catch (error) {
      console.error('Ошибка загрузки точек:', error);
      showSnackbar('Ошибка загрузки сохраненных точек');
    }
  };

  const savePoints = async (newPoints) => {
    try {
      await AsyncStorage.setItem('fieldDiaryPoints', JSON.stringify(newPoints));
    } catch (error) {
      console.error('Ошибка сохранения точек:', error);
      showSnackbar('Ошибка сохранения точек');
    }
  };

  const addPoint = () => {
    if (!location) {
      Alert.alert('Ошибка', 'Не удалось получить текущее местоположение');
      return;
    }
    
    setIsAddingPoint(true);
    setNewPointData({
      title: '',
      description: '',
      type: 'observation',
    });
  };

  const savePoint = () => {
    if (!newPointData.title.trim()) {
      Alert.alert('Ошибка', 'Введите название точки');
      return;
    }

    const newPoint = {
      id: Date.now().toString(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      title: newPointData.title,
      description: newPointData.description,
      type: newPointData.type,
      timestamp: new Date().toISOString(),
      accuracy: location.coords.accuracy,
    };

    const updatedPoints = [...points, newPoint];
    setPoints(updatedPoints);
    savePoints(updatedPoints);
    
    setIsAddingPoint(false);
    setNewPointData({ title: '', description: '', type: 'observation' });
    showSnackbar('Точка успешно добавлена');
  };

  const editPoint = (point) => {
    setSelectedPoint(point);
    setNewPointData({
      title: point.title,
      description: point.description,
      type: point.type,
    });
    setIsEditingPoint(true);
  };

  const updatePoint = () => {
    if (!newPointData.title.trim()) {
      Alert.alert('Ошибка', 'Введите название точки');
      return;
    }

    const updatedPoints = points.map(point => 
      point.id === selectedPoint.id 
        ? { ...point, ...newPointData }
        : point
    );
    
    setPoints(updatedPoints);
    savePoints(updatedPoints);
    
    setIsEditingPoint(false);
    setSelectedPoint(null);
    setNewPointData({ title: '', description: '', type: 'observation' });
    
    showSnackbar('Точка успешно обновлена');
  };

  const deletePoint = (pointId) => {
    Alert.alert(
      'Удаление точки',
      'Вы уверены, что хотите удалить эту точку?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            const updatedPoints = points.filter(point => point.id !== pointId);
            setPoints(updatedPoints);
            savePoints(updatedPoints);
            showSnackbar('Точка удалена');
          },
        },
      ]
    );
  };

  const deleteAllPoints = () => {
    Alert.alert(
      'Удаление всех точек',
      'Вы уверены, что хотите удалить все точки? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить все',
          style: 'destructive',
          onPress: () => {
            setPoints([]);
            savePoints([]);
            showSnackbar('Все точки удалены');
          },
        },
      ]
    );
  };

  const exportData = async () => {
    if (points.length === 0) {
      showSnackbar('Нет данных для экспорта');
      return;
    }

    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalPoints: points.length,
        points: points.map(point => ({
          ...point,
          typeLabel: getPointTypeInfo(point.type).label,
        })),
      };

      const csvContent = generateCSV(exportData.points);
      const fileName = `field_diary_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Экспорт полевого дневника',
        });
      } else {
        showSnackbar('Функция экспорта недоступна на этом устройстве');
      }
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      showSnackbar('Ошибка при экспорте данных');
    }
  };

  const generateCSV = (points) => {
    const headers = ['ID', 'Название', 'Тип', 'Описание', 'Широта', 'Долгота', 'Дата создания', 'Точность (м)'];
    const rows = points.map(point => [
      point.id,
      point.title,
      getPointTypeInfo(point.type).label,
      point.description || '',
      point.latitude,
      point.longitude,
      new Date(point.timestamp).toLocaleString('ru-RU'),
      point.accuracy ? Math.round(point.accuracy) : 'N/A'
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  };

  const openInMaps = (point) => {
    const url = Platform.OS === 'ios' 
      ? `http://maps.apple.com/?q=${point.latitude},${point.longitude}`
      : `geo:${point.latitude},${point.longitude}`;
    
    Linking.openURL(url).catch(() => {
      showSnackbar('Не удалось открыть карту');
    });
  };

  const getPointTypeInfo = (typeKey) => {
    return pointTypes.find(type => type.key === typeKey) || pointTypes[0];
  };

  const getFilteredPoints = () => {
    if (filterType === 'all') return points;
    return points.filter(point => point.type === filterType);
  };

  const renderPointCard = (point) => {
    const typeInfo = getPointTypeInfo(point.type);
    
    return (
      <Card key={point.id} style={[styles.pointCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <View style={styles.pointHeader}>
            <View style={[styles.pointIcon, { backgroundColor: typeInfo.color }]}>
              <MaterialCommunityIcons name={typeInfo.icon} size={20} color="white" />
            </View>
            <View style={styles.pointInfo}>
              <Text style={[styles.pointTitle, { color: theme.colors.text }]}>
                {point.title}
              </Text>
              <Text style={[styles.pointType, { color: theme.colors.textSecondary }]}>
                {typeInfo.label}
              </Text>
            </View>
            <View style={styles.pointActions}>
              <IconButton
                icon="map-marker"
                size={20}
                onPress={() => openInMaps(point)}
              />
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => editPoint(point)}
              />
              <IconButton
                icon="delete"
                size={20}
                onPress={() => deletePoint(point.id)}
              />
            </View>
          </View>
          
          {point.description && (
            <Text style={[styles.pointDescription, { color: theme.colors.textSecondary }]}>
              {point.description}
            </Text>
          )}
          
          <View style={styles.pointDetails}>
            <Text style={[styles.pointCoordinates, { color: theme.colors.textSecondary }]}>
              Координаты: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
            </Text>
            <Text style={[styles.pointDate, { color: theme.colors.textSecondary }]}>
              {new Date(point.timestamp).toLocaleString('ru-RU')}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />

      {/* Кнопки управления */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => setShowPointList(!showPointList)}
        >
          <MaterialIcons name="list" size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => setShowStats(!showStats)}
        >
          <MaterialIcons name="analytics" size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <Menu
          visible={showMenu}
          onDismiss={() => setShowMenu(false)}
          anchor={
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowMenu(true)}
            >
              <MaterialIcons name="more-vert" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          }
        >
          <Menu.Item
            onPress={() => {
              setShowMenu(false);
              exportData();
            }}
            title="Экспорт данных"
            leadingIcon="download"
          />
          <Menu.Item
            onPress={() => {
              setShowMenu(false);
              deleteAllPoints();
            }}
            title="Удалить все точки"
            leadingIcon="delete-sweep"
          />
        </Menu>
      </View>

      {/* Фильтр по типам */}
      {showPointList && (
        <Card style={[styles.filterCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
              Фильтр по типам:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Chip
                selected={filterType === 'all'}
                onPress={() => setFilterType('all')}
                style={styles.filterChip}
              >
                Все ({points.length})
              </Chip>
              {pointTypes.map(type => {
                const count = points.filter(point => point.type === type.key).length;
                return (
                  <Chip
                    key={type.key}
                    selected={filterType === type.key}
                    onPress={() => setFilterType(type.key)}
                    style={[styles.filterChip, { borderColor: type.color }]}
                    textStyle={{ color: filterType === type.key ? 'white' : theme.colors.text }}
                  >
                    <MaterialCommunityIcons 
                      name={type.icon} 
                      size={16} 
                      color={filterType === type.key ? 'white' : type.color} 
                    />
                    {' '}{type.label} ({count})
                  </Chip>
                );
              })}
            </ScrollView>
          </Card.Content>
        </Card>
      )}

      {/* Список точек */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {showStats && (
          <FieldDiaryStats points={points} theme={theme} />
        )}

        {getFilteredPoints().length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name="map-marker-off" 
              size={64} 
              color={theme.colors.textSecondary} 
            />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {filterType === 'all' ? 'Нет добавленных точек' : 'Нет точек выбранного типа'}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
              Добавьте первую точку, нажав кнопку "+"
            </Text>
          </View>
        ) : (
          <View style={styles.pointsContainer}>
            {getFilteredPoints().map(renderPointCard)}
          </View>
        )}
      </ScrollView>

      {/* FAB для добавления точки */}
      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        icon="plus"
        onPress={addPoint}
        label="Добавить точку"
        color="white"
      />

      {/* Модальное окно добавления точки */}
      <Portal>
        <Modal
          visible={isAddingPoint}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsAddingPoint(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Title style={{ color: theme.colors.text }}>Добавить точку</Title>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={() => setIsAddingPoint(false)}
                />
              </View>
              
              <ScrollView style={styles.modalBody}>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }]}
                  placeholder="Название точки"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newPointData.title}
                  onChangeText={(text) => setNewPointData({ ...newPointData, title: text })}
                />
                
                <Text style={[styles.label, { color: theme.colors.text }]}>Тип точки:</Text>
                <View style={styles.typeSelector}>
                  {pointTypes.map(type => (
                    <Chip
                      key={type.key}
                      selected={newPointData.type === type.key}
                      onPress={() => setNewPointData({ ...newPointData, type: type.key })}
                      style={[
                        styles.typeChip,
                        newPointData.type === type.key && { backgroundColor: type.color }
                      ]}
                      textStyle={{ color: newPointData.type === type.key ? 'white' : theme.colors.text }}
                    >
                      <MaterialCommunityIcons 
                        name={type.icon} 
                        size={16} 
                        color={newPointData.type === type.key ? 'white' : theme.colors.textSecondary} 
                      />
                      {' '}{type.label}
                    </Chip>
                  ))}
                </View>
                
                <TextInput
                  style={[styles.textArea, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }]}
                  placeholder="Описание (необязательно)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newPointData.description}
                  onChangeText={(text) => setNewPointData({ ...newPointData, description: text })}
                  multiline
                  numberOfLines={4}
                />

                {location && (
                  <View style={styles.locationInfo}>
                    <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                      Координаты: {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                    </Text>
                    <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                      Точность: {Math.round(location.coords.accuracy)} м
                    </Text>
                  </View>
                )}
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <Button
                  mode="outlined"
                  onPress={() => setIsAddingPoint(false)}
                  style={{ marginRight: 8 }}
                >
                  Отмена
                </Button>
                <Button
                  mode="contained"
                  onPress={savePoint}
                >
                  Добавить
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Модальное окно редактирования точки */}
      <Portal>
        <Modal
          visible={isEditingPoint}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsEditingPoint(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Title style={{ color: theme.colors.text }}>Изменить точку</Title>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={() => setIsEditingPoint(false)}
                />
              </View>
              
              <ScrollView style={styles.modalBody}>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }]}
                  placeholder="Название точки"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newPointData.title}
                  onChangeText={(text) => setNewPointData({ ...newPointData, title: text })}
                />
                
                <Text style={[styles.label, { color: theme.colors.text }]}>Тип точки:</Text>
                <View style={styles.typeSelector}>
                  {pointTypes.map(type => (
                    <Chip
                      key={type.key}
                      selected={newPointData.type === type.key}
                      onPress={() => setNewPointData({ ...newPointData, type: type.key })}
                      style={[
                        styles.typeChip,
                        newPointData.type === type.key && { backgroundColor: type.color }
                      ]}
                      textStyle={{ color: newPointData.type === type.key ? 'white' : theme.colors.text }}
                    >
                      <MaterialCommunityIcons 
                        name={type.icon} 
                        size={16} 
                        color={newPointData.type === type.key ? 'white' : theme.colors.textSecondary} 
                      />
                      {' '}{type.label}
                    </Chip>
                  ))}
                </View>
                
                <TextInput
                  style={[styles.textArea, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }]}
                  placeholder="Описание (необязательно)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newPointData.description}
                  onChangeText={(text) => setNewPointData({ ...newPointData, description: text })}
                  multiline
                  numberOfLines={4}
                />
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <Button
                  mode="outlined"
                  onPress={() => setIsEditingPoint(false)}
                  style={{ marginRight: 8 }}
                >
                  Отмена
                </Button>
                <Button
                  mode="contained"
                  onPress={updatePoint}
                >
                  Сохранить
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Snackbar для уведомлений */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: theme.colors.primary }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  filterCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 4,
  },
  pointsContainer: {
    gap: 12,
  },
  pointCard: {
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pointInfo: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  pointType: {
    fontSize: 12,
    marginBottom: 4,
  },
  pointActions: {
    flexDirection: 'row',
  },
  pointDescription: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 20,
  },
  pointDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointCoordinates: {
    fontSize: 12,
    opacity: 0.7,
  },
  pointDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: '6%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    marginBottom: 4,
  },
  locationInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 12,
    marginBottom: 2,
  },
}); 