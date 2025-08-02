import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const FieldDiaryStats = ({ points, theme }) => {
  const pointTypes = [
    { key: 'observation', label: 'Наблюдение', icon: 'eye', color: '#4CAF50' },
    { key: 'sample', label: 'Проба', icon: 'flask', color: '#2196F3' },
    { key: 'measurement', label: 'Измерение', icon: 'ruler', color: '#FF9800' },
    { key: 'photo', label: 'Фото', icon: 'camera', color: '#9C27B0' },
    { key: 'note', label: 'Заметка', icon: 'note-text', color: '#607D8B' },
  ];

  const getStats = () => {
    const stats = {
      total: points.length,
      byType: {},
      recent: 0,
      today: 0,
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    points.forEach(point => {
      const pointDate = new Date(point.timestamp);
      
      // Подсчет по типам
      if (!stats.byType[point.type]) {
        stats.byType[point.type] = 0;
      }
      stats.byType[point.type]++;

      // Подсчет за последние 24 часа
      if (pointDate >= yesterday) {
        stats.recent++;
      }

      // Подсчет за сегодня
      if (pointDate >= today) {
        stats.today++;
      }
    });

    return stats;
  };

  const stats = getStats();

  const getMostActiveType = () => {
    let maxCount = 0;
    let mostActiveType = null;

    Object.entries(stats.byType).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveType = type;
      }
    });

    return mostActiveType ? pointTypes.find(t => t.key === mostActiveType) : null;
  };

  const mostActiveType = getMostActiveType();

  return (
    <Card style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <Title style={[styles.statsTitle, { color: theme.colors.text }]}>
          Статистика полевого дневника
        </Title>
        
        <View style={styles.statsGrid}>
          {/* Общее количество */}
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.primary }]}>
              <MaterialCommunityIcons name="map-marker-multiple" size={24} color="white" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {stats.total}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Всего точек
              </Text>
            </View>
          </View>

          {/* За сегодня */}
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
              <MaterialCommunityIcons name="calendar-today" size={24} color="white" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {stats.today}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                За сегодня
              </Text>
            </View>
          </View>

          {/* За последние 24 часа */}
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: '#2196F3' }]}>
              <MaterialCommunityIcons name="clock-outline" size={24} color="white" />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {stats.recent}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                За 24 часа
              </Text>
            </View>
          </View>

          {/* Самый активный тип */}
          <View style={styles.statItem}>
            <View style={[
              styles.statIcon, 
              { backgroundColor: mostActiveType ? mostActiveType.color : theme.colors.secondary }
            ]}>
              <MaterialCommunityIcons 
                name={mostActiveType ? mostActiveType.icon : 'help'} 
                size={24} 
                color="white" 
              />
            </View>
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {mostActiveType ? stats.byType[mostActiveType.key] : 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                {mostActiveType ? mostActiveType.label : 'Нет данных'}
              </Text>
            </View>
          </View>
        </View>

        {/* Детальная статистика по типам */}
        {stats.total > 0 && (
          <View style={styles.detailedStats}>
            <Text style={[styles.detailedTitle, { color: theme.colors.text }]}>
              По типам:
            </Text>
            <View style={styles.typeStats}>
              {pointTypes.map(type => {
                const count = stats.byType[type.key] || 0;
                const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                
                return (
                  <View key={type.key} style={styles.typeStatItem}>
                    <View style={[styles.typeIcon, { backgroundColor: type.color }]}>
                      <MaterialCommunityIcons name={type.icon} size={16} color="white" />
                    </View>
                    <Text style={[styles.typeLabel, { color: theme.colors.text }]}>
                      {type.label}
                    </Text>
                    <Text style={[styles.typeCount, { color: theme.colors.textSecondary }]}>
                      {count} ({percentage}%)
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {stats.total === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name="map-marker-off" 
              size={48} 
              color={theme.colors.textSecondary} 
            />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Нет добавленных точек
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
              Добавьте первую точку на карте
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  statsCard: {
    margin: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  detailedStats: {
    marginTop: 8,
  },
  detailedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeStats: {
    gap: 8,
  },
  typeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  typeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  typeLabel: {
    flex: 1,
    fontSize: 14,
  },
  typeCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default FieldDiaryStats; 