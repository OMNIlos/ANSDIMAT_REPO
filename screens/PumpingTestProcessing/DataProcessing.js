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
  Pressable,
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
    xUnit: "",
    yUnit: "",
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
            color={index === selectedJournalIdx ? theme.colors.text : theme.colors.primary} 
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
            {I18n.t("pumpingTestJournals")}
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
            {I18n.t("chartType")}
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
  // Используем только реальные данные
  const displayPoints = points;

  const func = FUNCTIONS[selectedFunction] || FUNCTIONS["s-t"];
  
  // Функция для преобразования координат в пиксели (вынесена из SVG)
  const getXY = useCallback((x, y, bounds) => {
    if (!bounds) return { x: 0, y: 0 };
    
    const pixelX = ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (CHART_WIDTH - 2 * CHART_PADDING) + CHART_PADDING;
    const pixelY = CHART_HEIGHT - CHART_PADDING - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (CHART_HEIGHT - 2 * CHART_PADDING);
    return { x: pixelX, y: pixelY };
  }, []);

  // Вычисляем границы данных
  const bounds = useMemo(() => {
    if (chartBounds) {
      return {
        minX: chartBounds.zoomedMinX,
        maxX: chartBounds.zoomedMaxX,
        minY: chartBounds.zoomedMinY,
        maxY: chartBounds.zoomedMaxY,
      };
    } else if (displayPoints.length > 0) {
      const xValues = displayPoints.map(p => p.t || p.x);
      const yValues = displayPoints.map(p => p.s || p.y);
      
      const rawMinX = Math.min(...xValues);
      const rawMaxX = Math.max(...xValues);
      const rawMinY = Math.min(...yValues);
      const rawMaxY = Math.max(...yValues);
      
      const xRange = rawMaxX - rawMinX || 1;
      const yRange = rawMaxY - rawMinY || 1;
      const padding = 0.1;
      
      return {
        minX: rawMinX - xRange * padding,
        maxX: rawMaxX + xRange * padding,
        minY: rawMinY - yRange * padding,
        maxY: rawMaxY + yRange * padding,
      };
    }
    return null;
  }, [chartBounds, displayPoints]);

    return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <MaterialIcons name="show-chart" size={24} color={theme.colors.primary} />
                    <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
            {I18n.t("chart")} {func?.name}
        </Text>
      </View>

                <View ref={chartRef} collapsable={false} style={styles.chartContainer}>
          <Svg
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            style={{ backgroundColor: "#ffffff", borderRadius: 12 }}
          >
            {(() => {
              if (!bounds) {
                // Если нет данных, показываем пустой график
                return (
                  <G>
                    <SvgText
                      x={CHART_WIDTH / 2}
                      y={CHART_HEIGHT / 2}
                      fontSize="16"
                      fill="#999"
                      textAnchor="middle"
                    >
                      {I18n.t("noData")}
                    </SvgText>
                  </G>
                );
              }

              // Функция для преобразования координат в пиксели (внутри SVG)
              function getXY(x, y) {
                const pixelX = ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (CHART_WIDTH - 2 * CHART_PADDING) + CHART_PADDING;
                const pixelY = CHART_HEIGHT - CHART_PADDING - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (CHART_HEIGHT - 2 * CHART_PADDING);
                return { x: pixelX, y: pixelY };
              }

              // Генерация делений осей
              const tickCount = 5;
              const xTicks = [];
              const yTicks = [];

              for (let i = 0; i <= tickCount; i++) {
                const x = bounds.minX + (bounds.maxX - bounds.minX) * (i / tickCount);
                const y = bounds.minY + (bounds.maxY - bounds.minY) * (i / tickCount);
                xTicks.push(x);
                yTicks.push(y);
              }

              return (
                <G>
                  {/* Сетка */}
                  {xTicks.map((x, i) => {
                    const pixelX = getXY(x, bounds.minY).x;
                    return (
                      <Line
                        key={`x-grid-${i}`}
                        x1={pixelX}
                        y1={CHART_PADDING}
                        x2={pixelX}
                        y2={CHART_HEIGHT - CHART_PADDING}
                        stroke="#e0e0e0"
                        strokeWidth={1}
                      />
                    );
                  })}
                  {yTicks.map((y, i) => {
                    const pixelY = getXY(bounds.minX, y).y;
                    return (
                      <Line
                        key={`y-grid-${i}`}
                        x1={CHART_PADDING}
                        y1={pixelY}
                        x2={CHART_WIDTH - CHART_PADDING}
                        y2={pixelY}
                        stroke="#e0e0e0"
                        strokeWidth={1}
                      />
                    );
                  })}
              
                  {/* Оси */}
                  <Line
                    x1={CHART_PADDING}
                    y1={CHART_HEIGHT - CHART_PADDING}
                    x2={CHART_WIDTH - CHART_PADDING}
                    y2={CHART_HEIGHT - CHART_PADDING}
                    stroke="#888"
                    strokeWidth={2}
                  />
                  <Line
                    x1={CHART_PADDING}
                    y1={CHART_HEIGHT - CHART_PADDING}
                    x2={CHART_PADDING}
                    y2={CHART_PADDING}
                    stroke="#888"
                    strokeWidth={2}
                  />
              
                  {/* Подписи осей */}
                  <SvgText
                    x={CHART_WIDTH / 2}
                    y={CHART_HEIGHT - CHART_PADDING + 36}
                    fontSize="14"
                    fill="#333"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {func?.xLabel} 
                  </SvgText>
                  <SvgText
                    x={CHART_PADDING - 45}
                    y={CHART_HEIGHT / 2}
                    fontSize="14"
                    fill="#333"
                    textAnchor="middle"
                    fontWeight="bold"
                    transform={`rotate(-90, ${CHART_PADDING - 45}, ${CHART_HEIGHT / 2})`}
                  >
                    {func?.yLabel}
                  </SvgText>

                  {/* Деления осей */}
                  {xTicks.map((x, i) => {
                    const pixelX = getXY(x, bounds.minY).x;
                    return (
                      <G key={`x-tick-${i}`}>
                        <Line
                          x1={pixelX}
                          y1={CHART_HEIGHT - CHART_PADDING}
                          x2={pixelX}
                          y2={CHART_HEIGHT - CHART_PADDING + 5}
                          stroke="#333"
                          strokeWidth={1}
                        />
                        <SvgText
                          x={pixelX}
                          y={CHART_HEIGHT - CHART_PADDING + 18}
                          fontSize="11"
                          fill="#333"
                          textAnchor="middle"
                        >
                          {x.toFixed(x < 1 ? 2 : x < 10 ? 1 : 0)}
                        </SvgText>
                      </G>
                    );
                  })}
                  {yTicks.map((y, i) => {
                    const pixelY = getXY(bounds.minX, y).y;
                    return (
                      <G key={`y-tick-${i}`}>
                        <Line
                          x1={CHART_PADDING}
                          y1={pixelY}
                          x2={CHART_PADDING - 5}
                          y2={pixelY}
                          stroke="#333"
                          strokeWidth={1}
                        />
                        <SvgText
                          x={CHART_PADDING - 12}
                          y={pixelY + 4}
                          fontSize="11"
                          fill="#333"
                          textAnchor="end"
                        >
                          {y.toFixed(y < 1 ? 2 : y < 10 ? 1 : 0)}
                        </SvgText>
                      </G>
                    );
                  })}
              
                  {/* Точки */}
                  {displayPoints.map((point, idx) => {
                    const xValue = point.t || point.x;
                    const yValue = point.s || point.y;
                    const { x, y } = getXY(xValue, yValue);
                    const isSelected = selectedPoints.includes(idx);
                
                    return (
                      <G key={idx}>
                        {/* Видимая точка */}
                        <Circle
                          cx={x}
                          cy={y}
                          r={isSelected ? 7 : 5}
                          fill={isSelected ? "#FF4444" : "#1976D2"}
                          stroke={isSelected ? "#FF0000" : "#1565C0"}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                      </G>
                    );
                  })}

                  {/* Линия тренда - проходит через весь график */}
                  {selectedPoints.length === 2 && (() => {
                    const point1 = displayPoints[selectedPoints[0]];
                    const point2 = displayPoints[selectedPoints[1]];
                    
                    if (!point1 || !point2) return null;
              
                    const x1Value = point1.t || point1.x;
                    const y1Value = point1.s || point1.y;
                    const x2Value = point2.t || point2.x;
                    const y2Value = point2.s || point2.y;
              
                    // Проверяем, что точки разные
                    if (x1Value === x2Value && y1Value === y2Value) return null;
                    
                    // Вычисляем параметры прямой y = kx + b
                    const k = (y2Value - y1Value) / (x2Value - x1Value);
                    const b = y1Value - k * x1Value;
                    
                    // Находим точки пересечения с границами графика
                    const leftY = k * bounds.minX + b;
                    const rightY = k * bounds.maxX + b;
                    
                    // Проверяем, пересекает ли линия график
                    const topX = (bounds.maxY - b) / k;
                    const bottomX = (bounds.minY - b) / k;
                    
                    let startX, startY, endX, endY;
                    
                    // Определяем точки начала и конца линии
                    if (k === 0) {
                      // Горизонтальная линия
                      startX = bounds.minX;
                      startY = y1Value;
                      endX = bounds.maxX;
                      endY = y1Value;
                    } else if (!isFinite(k)) {
                      // Вертикальная линия
                      startX = x1Value;
                      startY = bounds.minY;
                      endX = x1Value;
                      endY = bounds.maxY;
                    } else {
                      // Обычная линия - находим пересечения с границами
                      const intersections = [];
                      
                      // Левая граница
                      if (leftY >= bounds.minY && leftY <= bounds.maxY) {
                        intersections.push({ x: bounds.minX, y: leftY });
                      }
                      
                      // Правая граница
                      if (rightY >= bounds.minY && rightY <= bounds.maxY) {
                        intersections.push({ x: bounds.maxX, y: rightY });
                      }
                      
                      // Верхняя граница
                      if (topX >= bounds.minX && topX <= bounds.maxX) {
                        intersections.push({ x: topX, y: bounds.maxY });
                      }
                      
                      // Нижняя граница
                      if (bottomX >= bounds.minX && bottomX <= bounds.maxX) {
                        intersections.push({ x: bottomX, y: bounds.minY });
                      }
                      
                      if (intersections.length >= 2) {
                        startX = intersections[0].x;
                        startY = intersections[0].y;
                        endX = intersections[1].x;
                        endY = intersections[1].y;
                      } else {
                        // Если не нашли пересечений, используем исходные точки
                        startX = x1Value;
                        startY = y1Value;
                        endX = x2Value;
                        endY = y2Value;
                      }
                    }
                    
                    const { x: x1, y: y1 } = getXY(startX, startY);
                    const { x: x2, y: y2 } = getXY(endX, endY);
              
                    return (
                      <Line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#FF6B35"
                        strokeWidth={3}
                        opacity={0.9}
                      />
                    );
                  })()}
                </G>
              );
            })()}
          </Svg>
          
          {/* TouchableOpacity элементы поверх SVG для нажатий */}
          {bounds && displayPoints.map((point, idx) => {
            const xValue = point.t || point.x;
            const yValue = point.s || point.y;
            const { x, y } = getXY(xValue, yValue, bounds);
            
            return (
              <TouchableOpacity
                key={`touchable-${idx}`}
                style={{
                  position: 'absolute',
                  left: x - 15,
                  top: y - 15,
                  width: 30,
                  height: 30,
                  backgroundColor: 'transparent',
                }}
                onPress={() => onPointPress && onPointPress(idx)}
                activeOpacity={0.7}
              />
            );
          })}
        </View>
      </Card.Content>
    </Card>
  );
});

// Основной компонент
export default function DataProcessing({ route }) {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  const chartRef = useRef();
  
  // Получаем параметры из навигации
  const projectId = route?.params?.projectId;
  const projectName = route?.params?.projectName;
  
  // Состояние
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const [selectedJournalIdx, setSelectedJournalIdx] = useState(0);
  const [state, setState] = useState(initialState);
  const [zoom, setZoom] = useState({ x: 1, y: 1 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);

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
    
    // Базовые границы с отступами
    const baseMinX = minX - xRange * padding;
    const baseMaxX = maxX + xRange * padding;
    const baseMinY = minY - yRange * padding;
    const baseMaxY = maxY + yRange * padding;
    
    // Применяем пан
    const pannedMinX = baseMinX + pan.x;
    const pannedMaxX = baseMaxX + pan.x;
    const pannedMinY = baseMinY + pan.y;
    const pannedMaxY = baseMaxY + pan.y;
    
    // Применяем зум
    const xCenter = (pannedMinX + pannedMaxX) / 2;
    const yCenter = (pannedMinY + pannedMaxY) / 2;
    const xRangeZoomed = (pannedMaxX - pannedMinX) / zoom.x;
    const yRangeZoomed = (pannedMaxY - pannedMinY) / zoom.y;
    
    return {
      zoomedMinX: xCenter - xRangeZoomed / 2,
      zoomedMaxX: xCenter + xRangeZoomed / 2,
      zoomedMinY: yCenter - yRangeZoomed / 2,
      zoomedMaxY: yCenter + yRangeZoomed / 2,
    };
  }, [points, pan, zoom]);

  // Загрузка активного проекта
  useEffect(() => {
    loadActiveProject();
  }, [loadActiveProject]);

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
      const project = projects.find(p => String(p.id) === String(id));
      
      if (!project) {
        console.error("Project not found:", id);
        setActiveProject(null);
        setJournals([]);
        setIsLoading(false);
        return;
      }
      
      setActiveProject(project);
      setJournals(project.journals || []);
      setSelectedJournalIdx(0);
      setState(prev => ({ ...prev, selectedPoints: [] }));
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveProject(null);
      setJournals([]);
      setIsLoading(false);
    }
  }, [projectId]);

  // Обработчики событий
  const handleSelectJournal = useCallback((index) => {
    setSelectedJournalIdx(index);
    setState(prev => ({ ...prev, selectedPoints: [], lineParams: { k: 0, b: 0 } }));
  }, []);

  const handleDeleteJournal = useCallback((journalIndex) => {
    Alert.alert(
      I18n.t("deleteJournal"),
      I18n.t("deleteJournalConfirm", { name: journals[journalIndex]?.name || I18n.t("journal") }),
      [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const updatedJournals = journals.filter((_, idx) => idx !== journalIndex);
              const updatedProject = { ...activeProject, journals: updatedJournals };
              
              const projectsRaw = await AsyncStorage.getItem("pumping_projects");
              const projects = JSON.parse(projectsRaw);
              const projectIndex = projects.findIndex(p => String(p.id) === String(activeProject.id));
              
              projects[projectIndex] = updatedProject;
              await AsyncStorage.setItem("pumping_projects", JSON.stringify(projects));
              
              setActiveProject(updatedProject);
              setJournals(updatedJournals);
              
              if (selectedJournalIdx >= updatedJournals.length) {
                setSelectedJournalIdx(Math.max(0, updatedJournals.length - 1));
              }
              
              setState(prev => ({ ...prev, selectedPoints: [] }));
              Alert.alert(I18n.t("success"), I18n.t("journalDeleted"));
            } catch (error) {
              Alert.alert(I18n.t("error"), I18n.t("exportError"));
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
        Alert.alert(I18n.t("error"), I18n.t("noGalleryAccess"));
        return;
      }
      
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync("Ansdimat", asset, false);
      Alert.alert(I18n.t("success"), I18n.t("chartSavedSuccess"));
    } catch (error) {
      Alert.alert(I18n.t("error"), I18n.t("chartSaveError"));
    }
  }, []);

  // Обработчики масштабирования
  const handleZoomIn = useCallback(() => {
    setZoom(prev => ({ x: prev.x * 1.2, y: prev.y * 1.2 }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => ({ x: prev.x / 1.2, y: prev.y / 1.2 }));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom({ x: 1, y: 1 });
    setPan({ x: 0, y: 0 });
  }, []);

  // Проверяем наличие данных
  const hasData = points.length > 0 && chartBounds;

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
          {I18n.t("noActiveProject")}
            </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {I18n.t("selectProjectFirst")}
            </Text>
      </View>
    );
  }

  if (!journals || journals.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="book-plus" size={64} color={theme.colors.outline} />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          {I18n.t("noJournals")}
            </Text>
        <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {I18n.t("createJournalInWizard")}
        </Text>
          </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Заголовок проекта */}
      <Surface style={[styles.headerCard, { backgroundColor: theme.colors.d4d4d4 }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="chart-line" size={32} color={theme.colors.primary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>
              {I18n.t("processingTitle")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.primary }]}>
              {I18n.t("project")}: {activeProject.name}
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

      {/* Управление масштабом */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialIcons name="zoom-in" size={24} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
              {I18n.t("scale")}
            </Text>
          </View>
          
          <View style={styles.zoomControls}>
            <Button
              mode="outlined"
              icon="magnify-plus"
              onPress={handleZoomIn}
              style={styles.zoomButton}
            >
              {I18n.t("zoomIn")}
            </Button>
            <Button
              mode="outlined"
              icon="magnify-minus"
              onPress={handleZoomOut}
              style={styles.zoomButton}
            >
              {I18n.t("zoomOut")}
            </Button>
            <Button
              mode="outlined"
              icon="home"
              onPress={handleResetZoom}
              style={styles.zoomButton}
            >
              {I18n.t("reset")}
            </Button>
          </View>
        </Card.Content>
      </Card>

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
                {I18n.t("results")}
      </Text>
            </View>
            
            <View style={styles.resultGrid}>
              <View style={styles.resultItem}>
                <Text style={[styles.resultLabel, { color: theme.colors.onSecondaryContainer }]}>
                  {I18n.t("slope")}
                </Text>
                <Text style={[styles.resultValue, { color: theme.colors.secondary }]}>
                  {state.lineParams.k.toFixed(4)}
                </Text>
              </View>
              
              <View style={styles.resultItem}>
                <Text style={[styles.resultLabel, { color: theme.colors.onSecondaryContainer }]}>
                  {I18n.t("intercept")}
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
              {I18n.t("saveChartToGallery")}
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
              {I18n.t("instructions")}
            </Text>
          </View>
          
          <Text style={[styles.instructionText, { color: theme.colors.onSurfaceVariant }]}>
            {I18n.t("selectTwoPoints")}
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
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  zoomButton: {
    flex: 1,
    borderRadius: 8,
  },

});
