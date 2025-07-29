import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Line, Circle, G, Text as SvgText, Rect } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import { LanguageContext } from "../../LanguageContext";
import { 
  TextInput, 
  useTheme, 
  Card, 
  Surface, 
  Button, 
  Chip,
  IconButton,
  Divider,
  Modal,
  Portal
} from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from "@react-native-community/slider";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 32;
const CHART_HEIGHT = 280;
const CHART_PADDING = 60;

// Функции преобразования координат (оптимизированные)
const FUNCTIONS = {
  "s-t": {
    name: "s-t",
    xTransform: (t) => t,
    yTransform: (s) => s,
    xLabel: "t",
    yLabel: "s",
    xUnit: "мин",
    yUnit: "м",
    type: "s-t",
  },
  "s-√t": {
    name: "s-√t",
    xTransform: (t) => Math.sqrt(Math.max(0, t)),
    yTransform: (s) => s,
    xLabel: "√t",
    yLabel: "s",
    xUnit: "мин¹/²",
    yUnit: "м",
    type: "s-t",
  },
  "lg(s)-lg(t)": {
    name: "lg(s)-lg(t)",
    xTransform: (t) => t > 0 ? Math.log10(t) : null,
    yTransform: (s) => s > 0 ? Math.log10(s) : null,
    xLabel: "lg(t)",
    yLabel: "lg(s)",
    xUnit: "lg(мин)",
    yUnit: "lg(м)",
    type: "s-t",
  },
  "s-lg(t)": {
    name: "s-log(t)",
    xTransform: (t) => t > 0 ? Math.log10(t) : null,
    yTransform: (s) => s,
    xLabel: "lg(t)",
    yLabel: "s",
    xUnit: "lg(мин)",
    yUnit: "м",
    type: "s-t",
  },
};

// Состояние по умолчанию
const initialState = {
  selectedFunction: "s-t",
  selectedPoints: [],
  lineParams: { k: 0, b: 0 },
  zoom: { x: 1, y: 1 },
  pan: { x: 0, y: 0 },
  isDraggingLine: false,
  showControls: false,
  showExportModal: false,
};

// Функция селектора журнала (мемоизированная)
const JournalSelector = React.memo(({ 
  journals, 
  selectedJournalIdx, 
  onSelectJournal, 
  onDeleteJournal,
  theme 
}) => {
  const renderJournal = useCallback(({ item, index }) => (
    <Surface 
      key={index}
      style={[
        styles.journalCard,
        {
          backgroundColor: index === selectedJournalIdx ? theme.colors.primary : theme.colors.surface,
          borderColor: index === selectedJournalIdx ? theme.colors.primary : theme.colors.outline
        }
      ]}
      elevation={index === selectedJournalIdx ? 4 : 1}
    >
      <TouchableOpacity
        style={styles.journalButton}
        onPress={() => onSelectJournal(index)}
        activeOpacity={0.7}
      >
        <View style={styles.journalInfo}>
          <MaterialCommunityIcons 
            name="water-well" 
            size={20} 
            color={index === selectedJournalIdx ? theme.colors.onPrimary : theme.colors.primary} 
          />
          <View style={styles.journalText}>
            <Text style={[
              styles.journalTitle,
              { color: index === selectedJournalIdx ? theme.colors.onPrimary : theme.colors.onSurface }
            ]}>
              {item.name || `${item.testType} ${index + 1}`}
        </Text>
            <Text style={[
              styles.journalSubtitle,
              { color: index === selectedJournalIdx ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }
            ]}>
              {item.testType} • {item.layerType}
        </Text>
      </View>
        </View>
        
        <IconButton
          icon="delete"
          iconColor={index === selectedJournalIdx ? theme.colors.onPrimary : theme.colors.error}
          size={18}
          onPress={(e) => {
            e.stopPropagation();
            onDeleteJournal(index);
          }}
        />
      </TouchableOpacity>
    </Surface>
  ), [selectedJournalIdx, onSelectJournal, onDeleteJournal, theme]);

    return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <MaterialIcons name="library-books" size={24} color={theme.colors.primary} />
          <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
            Журналы откачек
          </Text>
      </View>
        
        <FlatList
          data={journals}
          keyExtractor={(_, idx) => idx.toString()}
          renderItem={renderJournal}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.journalsList}
        />
      </Card.Content>
    </Card>
  );
});

// Функция селектора функций (мемоизированная)
const FunctionSelector = React.memo(({ 
  functions, 
  selectedFunction, 
  onSelectFunction,
  theme 
}) => {
  const renderFunction = useCallback(({ item }) => (
    <Chip
      key={item}
      selected={selectedFunction === item}
      onPress={() => onSelectFunction(item)}
              style={[
        styles.functionChip,
        {
          backgroundColor: selectedFunction === item ? theme.colors.primary : theme.colors.surface,
          borderColor: selectedFunction === item ? theme.colors.primary : theme.colors.outline
        }
      ]}
      textStyle={{
        color: selectedFunction === item ? theme.colors.onPrimary : theme.colors.onSurface
      }}
    >
      {FUNCTIONS[item]?.name || item}
    </Chip>
  ), [selectedFunction, onSelectFunction, theme]);

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <MaterialIcons name="functions" size={24} color={theme.colors.primary} />
          <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
            Тип графика
              </Text>
      </View>

          <FlatList
          data={functions}
            keyExtractor={(item) => item}
          renderItem={renderFunction}
            horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.functionsList}
        />
      </Card.Content>
    </Card>
  );
});

// Компонент графика (мемоизированный)
const Chart = React.memo(({
  points,
  selectedPoints,
  onPointPress,
  lineParams,
  chartBounds,
  selectedFunction,
  theme,
  chartRef
}) => {
  // Используем реальные данные или тестовые для демонстрации
  let displayPoints = points.length > 0 ? points : [
    { x: 1, y: 0.1, t: 1, s: 0.1 },
    { x: 2, y: 0.2, t: 2, s: 0.2 },
    { x: 5, y: 0.4, t: 5, s: 0.4 },
    { x: 10, y: 0.6, t: 10, s: 0.6 },
    { x: 20, y: 0.8, t: 20, s: 0.8 },
    { x: 50, y: 1.2, t: 50, s: 1.2 },
    { x: 100, y: 1.6, t: 100, s: 1.6 }
  ];

  const func = FUNCTIONS[selectedFunction] || FUNCTIONS["s-t"];
  
  // Отладочная информация
  console.log('Chart render:', {
    pointsLength: points.length,
    displayPointsLength: displayPoints.length,
    hasChartBounds: !!chartBounds,
    selectedFunction,
    firstPoint: points[0],
    firstDisplayPoint: displayPoints[0]
  });

    return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <MaterialIcons name="show-chart" size={24} color={theme.colors.primary} />
                    <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
            График {func?.name}
        </Text>
      </View>

                <View ref={chartRef} collapsable={false} style={styles.chartContainer}>
          {/* Улучшенный график с правильными координатами */}
          <View style={styles.simpleChart}>
            {/* Фон графика */}
            <View style={styles.chartBackground} />
            
            {/* Сетка */}
            {Array.from({ length: 5 }, (_, i) => (
              <View
                key={`grid-v-${i}`}
                style={[
                  styles.gridLineVertical,
                  { left: 50 + ((i + 1) * (280 / 6)) }
                ]}
              />
            ))}
            {Array.from({ length: 4 }, (_, i) => (
              <View
                key={`grid-h-${i}`}
                style={[
                  styles.gridLineHorizontal,
                  { top: 40 + ((i + 1) * (220 / 5)) }
                ]}
              />
            ))}
            
            {/* Оси */}
            <View style={styles.xAxis} />
            <View style={styles.yAxis} />
            
            {/* Деления на осях с реальными данными */}
            {(() => {
              if (!chartBounds && displayPoints.length === 0) return null;
              
              // Используем границы данных или тестовые значения
              const minX = chartBounds ? chartBounds.zoomedMinX : 1;  // t от 1
              const maxX = chartBounds ? chartBounds.zoomedMaxX : 100; // t до 100
              const minY = chartBounds ? chartBounds.zoomedMinY : 0.1; // s от 0.1
              const maxY = chartBounds ? chartBounds.zoomedMaxY : 1.6; // s до 1.6
              
              // Создаем равномерные деления
              const xSteps = 6;
              const ySteps = 6;
              const xStep = (maxX - minX) / (xSteps - 1);
              const yStep = (maxY - minY) / (ySteps - 1);
              
              return (
                <>
                  {Array.from({ length: xSteps }, (_, i) => {
                    const value = minX + (i * xStep);
                    const pixelX = 50 + (i * 280 / (xSteps - 1));
                    return (
                      <View key={`x-tick-${i}`}>
                        <View
                          style={[
                            styles.xTick,
                            { left: pixelX - 1 }
                          ]}
                        />
                        <Text
                          style={[
                            styles.xTickLabel,
                            { left: pixelX - 15 }
                          ]}
                        >
                          {value.toFixed(value < 1 ? 2 : value < 10 ? 1 : 0)}
                        </Text>
                      </View>
                    );
                  })}
                  
                  {Array.from({ length: ySteps }, (_, i) => {
                    const value = minY + (i * yStep);
                    const pixelY = 260 - (i * 220 / (ySteps - 1));
                    return (
                      <View key={`y-tick-${i}`}>
                        <View
                          style={[
                            styles.yTick,
                            { top: pixelY - 1 }
                          ]}
                        />
                        <Text
                          style={[
                            styles.yTickLabel,
                            { top: pixelY - 8 }
                          ]}
                        >
                          {value.toFixed(value < 1 ? 2 : value < 10 ? 1 : 0)}
                        </Text>
                      </View>
                    );
                  })}
                </>
              );
            })()}
            
            {/* Точки данных с правильными координатами */}
            {displayPoints.map((point, idx) => {
              let pixelX, pixelY;
              
              if (!chartBounds && !point.x && !point.y) {
                // Тестовые данные - используем равномерное распределение
                const minX = 1, maxX = 100; // t от 1 до 100
                const minY = 0.1, maxY = 1.6; // s от 0.1 до 1.6
                
                // Используем реальные значения t и s для тестовых данных
                const normalizedX = (point.t - minX) / (maxX - minX);
                const normalizedY = (point.s - minY) / (maxY - minY);
                
                pixelX = 50 + (normalizedX * 280);
                pixelY = 260 - (normalizedY * 220);
              } else if (chartBounds) {
                // Реальные данные - используем chartBounds
                const { zoomedMinX, zoomedMaxX, zoomedMinY, zoomedMaxY } = chartBounds;
                
                // Нормализация координат к области графика (0-1)
                const normalizedX = (point.x - zoomedMinX) / (zoomedMaxX - zoomedMinX);
                const normalizedY = (point.y - zoomedMinY) / (zoomedMaxY - zoomedMinY);
                
                // Проверяем, что точка в пределах графика
                if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
                  return null;
                }
                
                pixelX = 50 + (normalizedX * 280); // область графика 280px
                pixelY = 260 - (normalizedY * 220); // область графика 220px, инвертируем Y
              } else {
                return null;
              }
              
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dataPoint,
                    {
                      left: pixelX - 6, // центрируем точку
                      top: pixelY - 6,
                      backgroundColor: selectedPoints.includes(idx) ? '#FF4444' : '#1976D2'
                    }
                  ]}
                  onPress={() => onPointPress && onPointPress(idx)}
                />
              );
            })}
            
            {/* Линия тренда через выбранные точки */}
            {selectedPoints.length === 2 && lineParams.k !== 0 && (() => {
              const point1 = displayPoints[selectedPoints[0]];
              const point2 = displayPoints[selectedPoints[1]];
              
              if (!point1 || !point2) return null;
              
              let x1Pixel, y1Pixel, x2Pixel, y2Pixel;
              
              if (!chartBounds && !point1.x && !point1.y) {
                // Тестовые данные - используем те же границы что и для осей
                const minX = 1, maxX = 100;    // t от 1 до 100
                const minY = 0.1, maxY = 1.6;  // s от 0.1 до 1.6
                
                const normalizedX1 = (point1.t - minX) / (maxX - minX);
                const normalizedY1 = (point1.s - minY) / (maxY - minY);
                const normalizedX2 = (point2.t - minX) / (maxX - minX);
                const normalizedY2 = (point2.s - minY) / (maxY - minY);
                
                x1Pixel = 50 + (normalizedX1 * 280);
                y1Pixel = 260 - (normalizedY1 * 220);
                x2Pixel = 50 + (normalizedX2 * 280);
                y2Pixel = 260 - (normalizedY2 * 220);
              } else if (chartBounds) {
                // Реальные данные - используем chartBounds
                const { zoomedMinX, zoomedMaxX, zoomedMinY, zoomedMaxY } = chartBounds;
                
                const x1Norm = (point1.x - zoomedMinX) / (zoomedMaxX - zoomedMinX);
                const y1Norm = (point1.y - zoomedMinY) / (zoomedMaxY - zoomedMinY);
                const x2Norm = (point2.x - zoomedMinX) / (zoomedMaxX - zoomedMinX);
                const y2Norm = (point2.y - zoomedMinY) / (zoomedMaxY - zoomedMinY);
                
                x1Pixel = 50 + (x1Norm * 280);
                y1Pixel = 260 - (y1Norm * 220);
                x2Pixel = 50 + (x2Norm * 280);
                y2Pixel = 260 - (y2Norm * 220);
              } else {
                return null;
              }
              
              // Рассчитываем длину и угол линии для точного соединения точек
              const length = Math.sqrt(Math.pow(x2Pixel - x1Pixel, 2) + Math.pow(y2Pixel - y1Pixel, 2));
              const angle = Math.atan2(y2Pixel - y1Pixel, x2Pixel - x1Pixel) * (180 / Math.PI);
              
              return (
                <View
                  style={[
                    styles.trendLine,
                    {
                      left: x1Pixel,
                      top: y1Pixel - 1.5, // центрируем по вертикали
                      width: length,
                      transform: [
                        { rotate: `${angle}deg` },
                        { translateY: 0 }
                      ],
                      transformOrigin: 'left center'
                    }
                  ]}
                />
              );
            })()}
            
            {/* Подписи */}
            <Text style={styles.xLabel}>
              {func?.xLabel} ({func?.xUnit})
            </Text>
            <Text style={styles.yLabel}>
              {func?.yLabel} ({func?.yUnit})
            </Text>
            
            {/* Информация о данных */}
            <Text style={styles.chartInfo}>
              {func?.name} | Точек: {displayPoints.length}
              {chartBounds ? 
                ` | X: ${chartBounds.zoomedMinX.toFixed(1)}-${chartBounds.zoomedMaxX.toFixed(1)} | Y: ${chartBounds.zoomedMinY.toFixed(1)}-${chartBounds.zoomedMaxY.toFixed(1)}` :
                ` | X: 1.0-100.0 | Y: 0.1-1.6`
              }
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

// Основной компонент
export default function DataProcessing() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  const chartRef = useRef();
  
  // Состояние
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const [selectedJournalIdx, setSelectedJournalIdx] = useState(0);
  const [state, setState] = useState(initialState);

  // Мемоизированные вычисления
  const journal = useMemo(
    () => journals[selectedJournalIdx],
    [journals, selectedJournalIdx]
  );

  const dataType = useMemo(() => journal?.dataType || "s-t", [journal]);
  
  const availableFunctions = useMemo(
    () => Object.keys(FUNCTIONS).filter(key => FUNCTIONS[key].type === dataType),
    [dataType]
  );

  const currentFunction = useMemo(
    () => FUNCTIONS[state.selectedFunction] || FUNCTIONS[availableFunctions[0]],
    [state.selectedFunction, availableFunctions]
  );

  // Обработка точек данных (оптимизированная)
  const points = useMemo(() => {
    if (!journal?.dataRows || !currentFunction) return [];

    const processedPoints = journal.dataRows
      .filter(row => row.t && row.s && !isNaN(row.t) && !isNaN(row.s))
      .map(row => {
        const t = parseFloat(row.t);
        const s = parseFloat(row.s);
        
        if (t <= 0 || s <= 0) return null;
        
        const x = currentFunction.xTransform(t);
        const y = currentFunction.yTransform(s);
        
        if (!isFinite(x) || !isFinite(y) || x === null || y === null) return null;
        
        return { t, s, x, y };
      })
      .filter(Boolean);

    // Ограничиваем количество точек для производительности
    return processedPoints.slice(0, 500);
  }, [journal?.dataRows, currentFunction]);

  // Границы графика (мемоизированные)
  const chartBounds = useMemo(() => {
    if (points.length === 0) return null;

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    const padding = 0.1;
    
    return {
      zoomedMinX: minX - xRange * padding + state.pan.x,
      zoomedMaxX: maxX + xRange * padding + state.pan.x,
      zoomedMinY: minY - yRange * padding + state.pan.y,
      zoomedMaxY: maxY + yRange * padding + state.pan.y,
    };
  }, [points, state.pan, state.zoom]);

  // Загрузка активного проекта
  useFocusEffect(
    useCallback(() => {
      loadActiveProject();
    }, [])
  );

  const loadActiveProject = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem("pumping_active_project_id");
      if (!id) {
        setActiveProject(null);
        setJournals([]);
        return;
      }
      
      const projectsRaw = await AsyncStorage.getItem("pumping_projects");
      if (!projectsRaw) return;
      
      const projects = JSON.parse(projectsRaw);
      const project = projects.find(p => p.id.toString() === id.toString());
      
      setActiveProject(project || null);
      setJournals(project?.journals || []);
      setSelectedJournalIdx(0);
      setState(prev => ({ ...prev, selectedPoints: [] }));
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveProject(null);
      setJournals([]);
    }
  }, []);

  // Обработчики событий
  const handleSelectJournal = useCallback((index) => {
    setSelectedJournalIdx(index);
    setState(prev => ({ ...prev, selectedPoints: [], lineParams: { k: 0, b: 0 } }));
  }, []);

  const handleDeleteJournal = useCallback((journalIndex) => {
    Alert.alert(
      "Удалить журнал",
      `Удалить журнал "${journals[journalIndex]?.name || 'журнал'}"?`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              const updatedJournals = journals.filter((_, idx) => idx !== journalIndex);
              const updatedProject = { ...activeProject, journals: updatedJournals };
              
              const projectsRaw = await AsyncStorage.getItem("pumping_projects");
              const projects = JSON.parse(projectsRaw);
              const projectIndex = projects.findIndex(p => p.id.toString() === activeProject.id.toString());
              
              projects[projectIndex] = updatedProject;
              await AsyncStorage.setItem("pumping_projects", JSON.stringify(projects));
              
              setActiveProject(updatedProject);
              setJournals(updatedJournals);
              
              if (selectedJournalIdx >= updatedJournals.length) {
                setSelectedJournalIdx(Math.max(0, updatedJournals.length - 1));
              }
              
              setState(prev => ({ ...prev, selectedPoints: [] }));
              Alert.alert("Успех", "Журнал удален");
            } catch (error) {
              Alert.alert("Ошибка", "Не удалось удалить журнал");
            }
          },
        },
      ]
    );
  }, [journals, activeProject, selectedJournalIdx]);

  const handleSelectFunction = useCallback((func) => {
    setState(prev => ({ 
      ...prev, 
      selectedFunction: func, 
      selectedPoints: [], 
      lineParams: { k: 0, b: 0 } 
    }));
  }, []);

  const handlePointPress = useCallback((idx) => {
    setState(prev => {
      const isSelected = prev.selectedPoints.includes(idx);
      let newSelectedPoints;
      
      if (isSelected) {
        newSelectedPoints = prev.selectedPoints.filter(i => i !== idx);
      } else if (prev.selectedPoints.length < 2) {
        newSelectedPoints = [...prev.selectedPoints, idx];
      } else {
        newSelectedPoints = [idx];
      }
      
      // Пересчитываем параметры линии для двух точек
      let newLineParams = { k: 0, b: 0 };
      if (newSelectedPoints.length === 2) {
        const p1 = points[newSelectedPoints[0]];
        const p2 = points[newSelectedPoints[1]];
        if (p1 && p2) {
          const dx = p2.x - p1.x;
          if (Math.abs(dx) > 1e-10) {
            const k = (p2.y - p1.y) / dx;
            const b = p1.y - k * p1.x;
            newLineParams = { k, b };
          }
        }
      }
      
      return {
        ...prev,
        selectedPoints: newSelectedPoints,
        lineParams: newLineParams,
        isDraggingLine: newSelectedPoints.length === 2
      };
    });
  }, [points]);

  const handleSaveChart = useCallback(async () => {
    try {
      const uri = await captureRef(chartRef, { format: "png", quality: 1 });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== "granted") {
        Alert.alert("Ошибка", "Нет доступа к галерее");
        return;
      }
      
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync("Ansdimat", asset, false);
      Alert.alert("Успех", "График сохранён в галерею!");
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось сохранить график");
    }
  }, []);

  // Проверяем наличие данных
  const hasData = points.length > 0 && chartBounds;

  // Проверка состояний
  if (!activeProject) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="folder-open" size={64} color={theme.colors.outline} />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          Нет активного проекта
            </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Выберите проект в разделе "Управление проектами"
            </Text>
      </View>
    );
  }

  if (!journals || journals.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="book-plus" size={64} color={theme.colors.outline} />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          Нет журналов откачек
            </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Создайте журнал с помощью мастера
        </Text>
          </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Заголовок проекта */}
      <Surface style={[styles.headerCard, { backgroundColor: theme.colors.primaryContainer }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="chart-line" size={32} color={theme.colors.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>
              Обработка данных
          </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onPrimaryContainer }]}>
              Проект: {activeProject.name}
          </Text>
        </View>
      </View>
      </Surface>

      {/* Селектор журналов */}
      <JournalSelector
        journals={journals}
        selectedJournalIdx={selectedJournalIdx}
        onSelectJournal={handleSelectJournal}
        onDeleteJournal={handleDeleteJournal}
        theme={theme}
      />

      {/* Селектор функций */}
      <FunctionSelector
        functions={availableFunctions}
        selectedFunction={state.selectedFunction}
        onSelectFunction={handleSelectFunction}
        theme={theme}
      />

      {/* График */}
      <Chart
        points={points}
        selectedPoints={state.selectedPoints}
        onPointPress={handlePointPress}
        lineParams={state.lineParams}
        chartBounds={chartBounds}
        selectedFunction={state.selectedFunction}
        theme={theme}
        chartRef={chartRef}
      />

      {/* Результаты анализа */}
      {state.selectedPoints.length === 2 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialIcons name="analytics" size={24} color={theme.colors.secondary} />
              <Text style={[styles.cardTitle, { color: theme.colors.secondary }]}>
                Результаты анализа
      </Text>
            </View>
            
            <View style={styles.resultGrid}>
              <View style={styles.resultItem}>
                <Text style={[styles.resultLabel, { color: theme.colors.onSecondaryContainer }]}>
                  Наклон (k)
                </Text>
                <Text style={[styles.resultValue, { color: theme.colors.secondary }]}>
                  {state.lineParams.k.toFixed(4)}
                </Text>
              </View>
              
              <View style={styles.resultItem}>
                <Text style={[styles.resultLabel, { color: theme.colors.onSecondaryContainer }]}>
                  Пересечение (b)
                </Text>
                <Text style={[styles.resultValue, { color: theme.colors.secondary }]}>
                  {state.lineParams.b.toFixed(4)}
                </Text>
              </View>
            </View>
            
            <Divider style={{ marginVertical: 12 }} />
            
            <Text style={[styles.formula, { color: theme.colors.onSecondaryContainer }]}>
              {currentFunction?.yLabel} = {state.lineParams.k.toFixed(4)} × {currentFunction?.xLabel} + {state.lineParams.b.toFixed(4)}
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Кнопки действий */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <View style={styles.actionButtons}>
            <Button
              mode="contained"
              icon="camera"
              onPress={handleSaveChart}
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.onPrimary }}
            >
              Сохранить график
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Инструкция */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialIcons name="info" size={24} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.cardTitle, { color: theme.colors.onSurfaceVariant }]}>
              Инструкция
            </Text>
          </View>
          
          <Text style={[styles.instructionText, { color: theme.colors.onSurfaceVariant }]}>
            1. Выберите журнал откачки{'\n'}
            2. Выберите тип графика{'\n'}
            3. Нажмите на две точки для построения линии тренда{'\n'}
            4. Анализируйте результаты в разделе "Результаты анализа"
          </Text>
        </Card.Content>
      </Card>

      {/* Отступ снизу */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  journalsList: {
    paddingHorizontal: 4,
  },
  journalCard: {
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
  },
  journalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  journalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  journalText: {
    marginLeft: 12,
    flex: 1,
  },
  journalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  journalSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  functionsList: {
    paddingHorizontal: 4,
  },
  functionChip: {
    marginRight: 8,
    borderWidth: 1,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
    height: 300,
  },
  simpleChart: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    position: 'relative',
    padding: 16,
  },
  chartBackground: {
    position: 'absolute',
    top: 40,
    left: 50,
    right: 20,
    bottom: 40,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  xAxis: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 20,
    height: 2,
    backgroundColor: '#333',
  },
  yAxis: {
    position: 'absolute',
    top: 40,
    left: 50,
    width: 2,
    bottom: 40,
    backgroundColor: '#333',
  },
  dataPoint: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  pointLabel: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  xLabel: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  yLabel: {
    position: 'absolute',
    top: 10,
    left: 5,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    transform: [{ rotate: '-90deg' }],
  },
  chartInfo: {
    position: 'absolute',
    top: 10,
    right: 10,
    fontSize: 8,
    color: '#666',
    fontWeight: '500',
    maxWidth: 120,
    textAlign: 'right',
    lineHeight: 10,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 40,
    bottom: 40,
    width: 1,
    backgroundColor: '#e0e0e0',
    opacity: 0.6,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 50,
    right: 20,
    height: 1,
    backgroundColor: '#e0e0e0',
    opacity: 0.6,
  },
  xTick: {
    position: 'absolute',
    bottom: 38,
    width: 2,
    height: 8,
    backgroundColor: '#333',
  },
  yTick: {
    position: 'absolute',
    left: 48,
    width: 8,
    height: 2,
    backgroundColor: '#333',
  },
  xTickLabel: {
    position: 'absolute',
    bottom: 20,
    width: 20,
    textAlign: 'center',
    fontSize: 10,
    color: '#666',
  },
  yTickLabel: {
    position: 'absolute',
    left: 20,
    width: 25,
    textAlign: 'right',
    fontSize: 10,
    color: '#666',
  },
  trendLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#FF6B35',
    opacity: 0.9,
    borderRadius: 1.5,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  resultItem: {
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  formula: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 24,
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 22,
  },

});
