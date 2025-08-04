import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Chip, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

const FieldDiaryFilters = ({ points, onFiltersChange, theme }) => {
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');

  const pointTypes = [
    { key: 'observation', label: 'Наблюдение', icon: 'eye', color: '#4CAF50' },
    { key: 'sample', label: 'Проба', icon: 'flask', color: '#2196F3' },
    { key: 'measurement', label: 'Измерение', icon: 'ruler', color: '#FF9800' },
    { key: 'photo', label: 'Фото', icon: 'camera', color: '#9C27B0' },
    { key: 'note', label: 'Заметка', icon: 'note-text', color: '#607D8B' },
  ];

  const dateRanges = [
    { key: 'all', label: 'Все время', icon: 'calendar' },
    { key: 'today', label: 'Сегодня', icon: 'calendar-today' },
    { key: 'yesterday', label: 'Вчера', icon: 'calendar-week' },
    { key: 'week', label: 'За неделю', icon: 'calendar-week' },
    { key: 'month', label: 'За месяц', icon: 'calendar-month' },
  ];

  const timeRanges = [
    { key: 'all', label: 'Все время', icon: 'clock-outline' },
    { key: 'morning', label: 'Утро (6-12)', icon: 'weather-sunny' },
    { key: 'afternoon', label: 'День (12-18)', icon: 'weather-partly-cloudy' },
    { key: 'evening', label: 'Вечер (18-24)', icon: 'weather-night' },
    { key: 'night', label: 'Ночь (0-6)', icon: 'weather-night' },
  ];

  const toggleTypeFilter = (typeKey) => {
    setSelectedTypes(prev => 
      prev.includes(typeKey) 
        ? prev.filter(t => t !== typeKey)
        : [...prev, typeKey]
    );
  };

  const applyFilters = () => {
    const filters = {
      types: selectedTypes,
      dateRange: selectedDateRange,
      timeRange: selectedTimeRange,
    };
    onFiltersChange(filters);
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedDateRange('all');
    setSelectedTimeRange('all');
    onFiltersChange({
      types: [],
      dateRange: 'all',
      timeRange: 'all',
    });
  };

  const getFilteredCount = () => {
    let filteredPoints = points;

    // Фильтрация по типам
    if (selectedTypes.length > 0) {
      filteredPoints = filteredPoints.filter(point => selectedTypes.includes(point.type));
    }

    // Фильтрация по дате
    if (selectedDateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filteredPoints = filteredPoints.filter(point => {
        const pointDate = new Date(point.timestamp);
        
        switch (selectedDateRange) {
          case 'today':
            return pointDate >= today;
          case 'yesterday':
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            return pointDate >= yesterday && pointDate < today;
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return pointDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return pointDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Фильтрация по времени
    if (selectedTimeRange !== 'all') {
      filteredPoints = filteredPoints.filter(point => {
        const pointDate = new Date(point.timestamp);
        const hour = pointDate.getHours();
        
        switch (selectedTimeRange) {
          case 'morning':
            return hour >= 6 && hour < 12;
          case 'afternoon':
            return hour >= 12 && hour < 18;
          case 'evening':
            return hour >= 18 && hour < 24;
          case 'night':
            return hour >= 0 && hour < 6;
          default:
            return true;
        }
      });
    }

    return filteredPoints.length;
  };

  const filteredCount = getFilteredCount();

  return (
    <Card style={[styles.filtersCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <Title style={[styles.filtersTitle, { color: theme.colors.text }]}>
          Фильтры полевого дневника
        </Title>

        {/* Фильтр по типам */}
        <View style={styles.filterSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Типы точек
          </Text>
          <View style={styles.chipContainer}>
            {pointTypes.map(type => (
              <Chip
                key={type.key}
                selected={selectedTypes.includes(type.key)}
                onPress={() => toggleTypeFilter(type.key)}
                style={[
                  styles.chip,
                  selectedTypes.includes(type.key) && { backgroundColor: type.color }
                ]}
                textStyle={[
                  styles.chipText,
                  selectedTypes.includes(type.key) && { color: 'white' }
                ]}
                icon={({ size, color }) => (
                  <MaterialCommunityIcons 
                    name={type.icon} 
                    size={size} 
                    color={selectedTypes.includes(type.key) ? 'white' : type.color} 
                  />
                )}
              >
                {type.label}
              </Chip>
            ))}
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Фильтр по дате */}
        <View style={styles.filterSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Период времени
          </Text>
          <View style={styles.chipContainer}>
            {dateRanges.map(range => (
              <Chip
                key={range.key}
                selected={selectedDateRange === range.key}
                onPress={() => setSelectedDateRange(range.key)}
                style={[
                  styles.chip,
                  selectedDateRange === range.key && { backgroundColor: theme.colors.primary }
                ]}
                textStyle={[
                  styles.chipText,
                  selectedDateRange === range.key && { color: 'white' }
                ]}
                icon={({ size, color }) => (
                  <MaterialCommunityIcons 
                    name={range.icon} 
                    size={size} 
                    color={selectedDateRange === range.key ? 'white' : theme.colors.primary} 
                  />
                )}
              >
                {range.label}
              </Chip>
            ))}
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Фильтр по времени суток */}
        <View style={styles.filterSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Время суток
          </Text>
          <View style={styles.chipContainer}>
            {timeRanges.map(range => (
              <Chip
                key={range.key}
                selected={selectedTimeRange === range.key}
                onPress={() => setSelectedTimeRange(range.key)}
                style={[
                  styles.chip,
                  selectedTimeRange === range.key && { backgroundColor: theme.colors.secondary }
                ]}
                textStyle={[
                  styles.chipText,
                  selectedTimeRange === range.key && { color: 'white' }
                ]}
                icon={({ size, color }) => (
                  <MaterialCommunityIcons 
                    name={range.icon} 
                    size={size} 
                    color={selectedTimeRange === range.key ? 'white' : theme.colors.secondary} 
                  />
                )}
              >
                {range.label}
              </Chip>
            ))}
          </View>
        </View>

        {/* Статистика фильтров */}
        <View style={styles.filterStats}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.primary }]}>
              <MaterialCommunityIcons name="filter-variant" size={24} color="white" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {filteredCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Найдено точек
              </Text>
            </View>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
              <MaterialCommunityIcons name="map-marker-multiple" size={24} color="white" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {points.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Всего точек
              </Text>
            </View>
          </View>
        </View>

        {/* Кнопки действий */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={applyFilters}
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            icon="filter-check"
          >
            Применить фильтры
          </Button>
          
          <Button
            mode="outlined"
            onPress={clearFilters}
            style={styles.actionButton}
            icon="filter-remove"
          >
            Очистить
          </Button>
        </View>

        {/* Активные фильтры */}
        {(selectedTypes.length > 0 || selectedDateRange !== 'all' || selectedTimeRange !== 'all') && (
          <View style={styles.activeFilters}>
            <Text style={[styles.activeFiltersTitle, { color: theme.colors.text }]}>
              Активные фильтры:
            </Text>
            <View style={styles.activeFiltersList}>
              {selectedTypes.map(typeKey => {
                const type = pointTypes.find(t => t.key === typeKey);
                return (
                  <Chip
                    key={typeKey}
                    style={[styles.activeChip, { backgroundColor: type.color }]}
                    textStyle={{ color: 'white' }}
                    icon={({ size }) => (
                      <MaterialCommunityIcons name={type.icon} size={size} color="white" />
                    )}
                    onClose={() => toggleTypeFilter(typeKey)}
                  >
                    {type.label}
                  </Chip>
                );
              })}
              
              {selectedDateRange !== 'all' && (
                <Chip
                  style={[styles.activeChip, { backgroundColor: theme.colors.primary }]}
                  textStyle={{ color: 'white' }}
                  icon={({ size }) => (
                    <MaterialCommunityIcons 
                      name={dateRanges.find(r => r.key === selectedDateRange)?.icon} 
                      size={size} 
                      color="white" 
                    />
                  )}
                  onClose={() => setSelectedDateRange('all')}
                >
                  {dateRanges.find(r => r.key === selectedDateRange)?.label}
                </Chip>
              )}
              
              {selectedTimeRange !== 'all' && (
                <Chip
                  style={[styles.activeChip, { backgroundColor: theme.colors.secondary }]}
                  textStyle={{ color: 'white' }}
                  icon={({ size }) => (
                    <MaterialCommunityIcons 
                      name={timeRanges.find(r => r.key === selectedTimeRange)?.icon} 
                      size={size} 
                      color="white" 
                    />
                  )}
                  onClose={() => setSelectedTimeRange('all')}
                >
                  {timeRanges.find(r => r.key === selectedTimeRange)?.label}
                </Chip>
              )}
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  filtersCard: {
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 8,
  },
  chipText: {
    fontSize: 12,
  },
  divider: {
    marginVertical: 16,
  },
  filterStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    marginHorizontal: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
  },
  activeFilters: {
    marginTop: 8,
  },
  activeFiltersTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  activeFiltersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeChip: {
    marginBottom: 8,
  },
});

export default FieldDiaryFilters;


