import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, TextInput, Button, SegmentedButtons, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const FieldDiaryAddPoint = ({ onAddPoint, theme }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('observation');
  const [location, setLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const pointTypes = [
    { key: 'observation', label: 'Наблюдение', icon: 'eye', color: '#4CAF50' },
    { key: 'sample', label: 'Проба', icon: 'flask', color: '#2196F3' },
    { key: 'measurement', label: 'Измерение', icon: 'ruler', color: '#FF9800' },
    { key: 'photo', label: 'Фото', icon: 'camera', color: '#9C27B0' },
    { key: 'note', label: 'Заметка', icon: 'note-text', color: '#607D8B' },
  ];

  const getCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Необходимо разрешение на доступ к местоположению');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
      });
    } catch (error) {
      console.error('Ошибка получения местоположения:', error);
      alert('Не удалось получить местоположение');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPoint = () => {
    if (!title.trim()) {
      alert('Пожалуйста, введите название точки');
      return;
    }

    if (!location) {
      alert('Пожалуйста, получите местоположение');
      return;
    }

    const newPoint = {
      id: Date.now().toString(),
      title: title.trim(),
      description: description.trim(),
      type,
      location,
      timestamp: new Date().toISOString(),
    };

    onAddPoint(newPoint);
    
    // Сброс формы
    setTitle('');
    setDescription('');
    setType('observation');
    setLocation(null);
  };

  const selectedType = pointTypes.find(t => t.key === type);

  return (
    <Card style={[styles.addPointCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <Title style={[styles.addPointTitle, { color: theme.colors.text }]}>
          Добавить новую точку
        </Title>

        {/* Выбор типа точки */}
        <View style={styles.typeSelection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
            Тип точки:
          </Text>
          <View style={styles.typeChips}>
            {pointTypes.map(pointType => (
              <Chip
                key={pointType.key}
                selected={type === pointType.key}
                onPress={() => setType(pointType.key)}
                style={[
                  styles.typeChip,
                  type === pointType.key && { backgroundColor: pointType.color }
                ]}
                textStyle={[
                  styles.typeChipText,
                  type === pointType.key && { color: 'white' }
                ]}
                icon={() => (
                  <MaterialCommunityIcons
                    name={pointType.icon}
                    size={16}
                    color={type === pointType.key ? 'white' : pointType.color}
                  />
                )}
              >
                {pointType.label}
              </Chip>
            ))}
          </View>
        </View>

        {/* Название точки */}
        <View style={styles.inputSection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
            Название точки:
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Введите название точки"
            mode="outlined"
            style={styles.textInput}
            theme={theme}
          />
        </View>

        {/* Описание */}
        <View style={styles.inputSection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
            Описание (необязательно):
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Добавьте описание или заметки"
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.textInput}
            theme={theme}
          />
        </View>

        {/* Местоположение */}
        <View style={styles.locationSection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
            Местоположение:
          </Text>
          
          {location ? (
            <View style={styles.locationInfo}>
              <View style={[styles.locationIcon, { backgroundColor: '#4CAF50' }]}>
                <MaterialCommunityIcons name="map-marker-check" size={20} color="white" />
              </View>
              <View style={styles.locationDetails}>
                <Text style={[styles.locationText, { color: theme.colors.text }]}>
                  Координаты получены
                </Text>
                <Text style={[styles.locationCoords, { color: theme.colors.textSecondary }]}>
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
                <Text style={[styles.locationAccuracy, { color: theme.colors.textSecondary }]}>
                  Точность: ±{Math.round(location.accuracy)}м
                </Text>
              </View>
              <Button
                mode="outlined"
                onPress={() => setLocation(null)}
                style={styles.changeLocationButton}
                theme={theme}
              >
                Изменить
              </Button>
            </View>
          ) : (
            <View style={styles.getLocationSection}>
              <View style={[styles.locationIcon, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons name="map-marker" size={20} color="white" />
              </View>
              <View style={styles.locationPrompt}>
                <Text style={[styles.locationPromptText, { color: theme.colors.text }]}>
                  Нажмите кнопку для получения текущего местоположения
                </Text>
                <Button
                  mode="contained"
                  onPress={getCurrentLocation}
                  loading={isLoading}
                  disabled={isLoading}
                  icon="crosshairs-gps"
                  style={styles.getLocationButton}
                  theme={theme}
                >
                  {isLoading ? 'Получение...' : 'Получить местоположение'}
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* Кнопка добавления */}
        <View style={styles.addButtonSection}>
          <Button
            mode="contained"
            onPress={handleAddPoint}
            disabled={!title.trim() || !location || isLoading}
            icon={() => (
              <MaterialCommunityIcons
                name={selectedType ? selectedType.icon : 'plus'}
                size={20}
                color="white"
              />
            )}
            style={[
              styles.addButton,
              { backgroundColor: selectedType ? selectedType.color : theme.colors.primary }
            ]}
            theme={theme}
          >
            Добавить точку
          </Button>
        </View>

        {/* Информация о выбранном типе */}
        {selectedType && (
          <View style={styles.typeInfo}>
            <View style={[styles.typeInfoIcon, { backgroundColor: selectedType.color }]}>
              <MaterialCommunityIcons name={selectedType.icon} size={20} color="white" />
            </View>
            <View style={styles.typeInfoContent}>
              <Text style={[styles.typeInfoTitle, { color: theme.colors.text }]}>
                {selectedType.label}
              </Text>
              <Text style={[styles.typeInfoDescription, { color: theme.colors.textSecondary }]}>
                {getTypeDescription(selectedType.key)}
              </Text>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const getTypeDescription = (type) => {
  const descriptions = {
    observation: 'Запись наблюдений за природными явлениями или объектами',
    sample: 'Сбор образцов для дальнейшего анализа',
    measurement: 'Измерение различных параметров (температура, влажность и т.д.)',
    photo: 'Фотографирование объектов или явлений',
    note: 'Общие заметки и комментарии',
  };
  return descriptions[type] || '';
};

const styles = StyleSheet.create({
  addPointCard: {
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addPointTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  typeSelection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    marginBottom: 4,
  },
  typeChipText: {
    fontSize: 12,
  },
  inputSection: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
  locationSection: {
    marginBottom: 20,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationDetails: {
    flex: 1,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: 12,
    marginBottom: 2,
  },
  locationAccuracy: {
    fontSize: 11,
  },
  changeLocationButton: {
    marginLeft: 8,
  },
  getLocationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  locationPrompt: {
    flex: 1,
  },
  locationPromptText: {
    fontSize: 14,
    marginBottom: 8,
  },
  getLocationButton: {
    alignSelf: 'flex-start',
  },
  addButtonSection: {
    marginBottom: 16,
  },
  addButton: {
    paddingVertical: 8,
  },
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  typeInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeInfoContent: {
    flex: 1,
  },
  typeInfoTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  typeInfoDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export default FieldDiaryAddPoint;
