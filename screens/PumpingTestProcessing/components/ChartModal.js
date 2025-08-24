/**
 * Модальное окно для полноэкранного отображения графика
 * Решает проблему конфликта с ScrollView
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Dimensions,
  Alert,
  ScrollView,
  FlatList,
} from 'react-native';
import {
  useTheme,
  Surface,
  IconButton,
  Button,
  Divider,
  Chip,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import I18n from '../../../Localization';
import SimpleChart from './SimpleChart';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Безопасная область для графика
const SAFE_AREA_TOP = Platform.OS === 'ios' ? 50 : 25;
const SAFE_AREA_BOTTOM = Platform.OS === 'ios' ? 34 : 20;

// Компонент для выбора точек через кнопки
const PointSelector = React.memo(({ 
  points, 
  selectedPoints, 
  onPointPress, 
  colorByWellId, 
  theme 
}) => {
  // Группируем точки по скважинам для удобства выбора
  const groupedPoints = useMemo(() => {
    const grouped = {};
    
    points.forEach((point, index) => {
      const wellId = point.wellId || 'main';
      const wellName = point.wellName || 'Скважина';
      
      if (!grouped[wellId]) {
        grouped[wellId] = {
          name: wellName,
          color: colorByWellId[wellId] || '#000000',
          points: []
        };
      }
      
      grouped[wellId].points.push({
        index,
        x: point.x,
        y: point.y,
        t: point.t,
        s: point.s
      });
    });
    
    return grouped;
  }, [points, colorByWellId]);
  
  // Проверяем, выбрана ли точка для конкретной скважины
  const isPointSelected = (index, wellId) => {
    if (!selectedPoints) return false;
    
    // Проверяем выбрана ли точка для этой конкретной скважины
    if (typeof selectedPoints === 'object' && selectedPoints[wellId]) {
      if (Array.isArray(selectedPoints[wellId])) {
        return selectedPoints[wellId].includes(index);
      }
    }
    
    // Обратная совместимость со старым форматом
    if (Array.isArray(selectedPoints)) {
      return selectedPoints.includes(index);
    }
    
    // Проверяем все скважины
    if (typeof selectedPoints === 'object') {
      return Object.values(selectedPoints).some(
        arr => Array.isArray(arr) && arr.includes(index)
      );
    }
    
    return false;
  };
  
  // Получаем количество выбранных точек для скважины
  const getSelectedPointsCount = (wellId) => {
    if (!selectedPoints) return 0;
    
    if (typeof selectedPoints === 'object' && selectedPoints[wellId]) {
      if (Array.isArray(selectedPoints[wellId])) {
        return selectedPoints[wellId].length;
      }
    }
    
    return 0;
  };
  
  return (
    <Surface style={[styles.pointSelector, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <Text style={[styles.selectorTitle, { color: theme.colors.primary }]}>
        Выберите точки для построения линий тренда (до 2 точек на скважину)
      </Text>
      
      <ScrollView style={styles.wellsList}>
        {Object.entries(groupedPoints).map(([wellId, wellData]) => (
          <View key={wellId} style={styles.wellSection}>
            <View style={styles.wellHeader}>
              <View style={[styles.wellColor, { backgroundColor: wellData.color }]} />
              <Text style={[styles.wellName, { color: theme.colors.onSurface }]}>
                {wellData.name} ({getSelectedPointsCount(wellId)}/2 точек)
              </Text>
            </View>
            
            <View style={styles.pointsList}>
              {wellData.points.map((point) => (
                <Chip
                  key={`point-${point.index}`}
                  selected={isPointSelected(point.index, wellId)}
                  onPress={() => onPointPress(point.index)}
                  style={[
                    styles.pointChip,
                    isPointSelected(point.index, wellId) && { backgroundColor: wellData.color }
                  ]}
                  textStyle={{ 
                    color: isPointSelected(point.index, wellId) ? theme.colors.onPrimary : theme.colors.onSurface,
                    fontSize: 12
                  }}
                >
                  t={point.t.toFixed(2)}, s={point.s.toFixed(2)}
                </Chip>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Surface>
  );
});

export default function ChartModal({
  visible,
  onClose,
  points,
  selectedPoints,
  onPointPress,
  lineParams,
  selectedFunction,
  colorByWellId,
  pointsByWell,
}) {
  const theme = useTheme();
  const chartRef = useRef();
  // Показывать ли селектор точек
  const [showPointSelector, setShowPointSelector] = useState(false);
  
  // Улучшенный обработчик нажатия на точку
  const handlePointPress = useCallback((pointIndex) => {

    
    // Добавляем небольшую задержку для лучшего отклика
    setTimeout(() => {
      if (onPointPress) {
        onPointPress(pointIndex);
      }
    }, 50);
  }, [onPointPress]);

  const handleSaveChart = async () => {
    try {
      if (!chartRef || !chartRef.current) {
        Alert.alert(I18n.t("error"), "График не найден");
        return;
      }

      // Запрашиваем разрешения
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== "granted") {
        Alert.alert(I18n.t("error"), I18n.t("noGalleryAccess"));
        return;
      }
      
      // Делаем снимок с максимальным качеством
      const uri = await captureRef(chartRef, { 
        format: "png", 
        quality: 1,
        result: 'file' 
      });
      
      // Сохраняем в галерею
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      // Создаем или находим альбом и добавляем в него
      const album = await MediaLibrary.getAlbumAsync("Ansdimat");
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync("Ansdimat", asset, false);
      }
      
      Alert.alert(I18n.t("success"), I18n.t("chartSavedSuccess"));
    } catch (error) {
      Alert.alert(I18n.t("error"), I18n.t("chartSaveError"));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Заголовок */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.primary }]} elevation={4}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={theme.colors.onPrimary} />
            </TouchableOpacity>
                      <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
              {I18n.t("chart")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onPrimary }]}>
              {selectedFunction?.name || 'График'} • {points.length} точек
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={() => setShowPointSelector(!showPointSelector)} style={styles.headerButton}>
              <MaterialIcons name={showPointSelector ? "format_list_bulleted" : "touch_app"} size={24} color={theme.colors.onPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveChart} style={styles.headerButton}>
              <MaterialIcons name="camera-alt" size={24} color={theme.colors.onPrimary} />
            </TouchableOpacity>
          </View>
          </View>
        </Surface>

        {/* Селектор точек (если активен) */}
        {showPointSelector && (
          <PointSelector
            points={points}
            selectedPoints={selectedPoints}
            onPointPress={handlePointPress}
            colorByWellId={colorByWellId}
            theme={theme}
          />
        )}
        
        {/* График - расширенный на весь доступный экран */}
        <View style={[
          styles.chartContainer, 
          showPointSelector && { height: SCREEN_HEIGHT * 0.5 } // Уменьшаем высоту графика, если показан селектор
        ]}>
          <SimpleChart
            points={points}
            selectedPoints={selectedPoints}
            onPointPress={handlePointPress}
            lineParams={lineParams}
            selectedFunction={selectedFunction}
            colorByWellId={colorByWellId}
            chartRef={chartRef}
            isFullScreen={!showPointSelector} // Полноэкранный только если селектор скрыт
          />
        </View>
        
        {/* Результаты анализа 
        {Object.keys(lineParams).length > 0 && (
          <Surface style={[styles.resultsPanel, { backgroundColor: theme.colors.surfaceVariant }]} elevation={2}>
            <Text style={[styles.resultTitle, { color: theme.colors.onSurfaceVariant }]}>
              {I18n.t("results")}
            </Text>
            <View style={styles.resultGrid}>
              {Object.entries(lineParams).map(([groupId, params]) => {
                if (!params.k && !params.b) return null;
                return (
                  <View key={groupId} style={[styles.resultItem, { 
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary
                  }]}>
                    <View style={styles.resultHeader}>
                      <View style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: 6, 
                        backgroundColor: theme.colors.primary,
                        marginRight: 6,
                      }} />
                      <Text style={[styles.resultLabel, { color: theme.colors.onSurface }]}>
                        Линия тренда
                      </Text>
                    </View>
                    <View style={styles.resultValues}>
                      <Text style={[styles.resultValue, { color: theme.colors.primary }]}>
                        k = {params.k.toFixed(4)}
                      </Text>
                      <Text style={[styles.resultValue, { color: theme.colors.primary }]}>
                        b = {params.b.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Surface>
        )}*/}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    
  },
  header: {
    paddingTop: '10%',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8, // Уменьшаем вертикальный отступ
  },
  closeButton: {
    padding: 4,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.9,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
    marginLeft: 8,
  },
  chartContainer: {
    marginHorizontal: 0, // Убираем горизонтальные отступы
    marginTop: '1%', // Убираем вертикальные отступы
    marginBottom: 0,

  },
  resultsPanel: {
    marginHorizontal: 8,
    marginBottom: 2,
    borderRadius: 8,
    padding: 6,
    maxHeight: SCREEN_HEIGHT * 0.1, // Уменьшаем высоту
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultItem: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultValues: {
    flexDirection: 'column',
    gap: 8,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionPanel: {
    marginHorizontal: 8,
    marginBottom: 2,
    borderRadius: 8,
  },
  instructionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  instructionText: {
    fontSize: 14,
    flex: 1,
  },
  // Стили для селектора точек
  pointSelector: {
    margin: 8,
    borderRadius: 8,
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    padding: 12,
    textAlign: 'center',
  },
  wellsList: {
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  wellSection: {
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  wellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  wellColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  wellName: {
    fontSize: 14,
    fontWeight: '600',
  },
  pointsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 20,
  },
  pointChip: {
    marginBottom: 4,
  },
});
