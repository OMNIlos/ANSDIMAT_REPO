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
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import { LanguageContext } from "../../LanguageContext";
import { 
  useTheme, 
  Card, 
  Surface, 
  Button, 
  Chip,
  IconButton,
  Divider,
} from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";

// Import components and utils

import ChartModal from './components/ChartModal';
import { CHART_FUNCTIONS, WELL_COLORS, CHART_CONFIG } from './utils/constants';
import { debounce } from './utils/helpers';

const { width } = Dimensions.get("window");
// Update chart config dynamically
CHART_CONFIG.WIDTH = width - 32;

// Состояние по умолчанию
const initialState = {
  selectedFunction: "", // Будет установлено после загрузки данных
  selectedPoints: {}, // Object: { wellId: [pointIndices] }
  lineParams: {}, // Object: { wellId: { k, b } }
  showControls: false,
  showExportModal: false,
};

// Функция селектора журнала (мемоизированная)
const JournalSelector = React.memo(({ 
  journals, 
  selectedJournalIdx, 
  onSelectJournal, 
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
        
        {/* Удаление журналов теперь выполняется на главном экране */}
      </TouchableOpacity>
    </Surface>
  ), [selectedJournalIdx, onSelectJournal, theme]);

    return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface}]}>
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
          style={{ overflow: 'visible' }}
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
      {CHART_FUNCTIONS[item]?.name || item}
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
  const [isLoading, setIsLoading] = useState(true);
  const [visibleWells, setVisibleWells] = useState({});
  const [showChartModal, setShowChartModal] = useState(false);

  // Мемоизированные вычисления
  const journal = useMemo(
    () => journals[selectedJournalIdx],
    [journals, selectedJournalIdx]
  );

  const dataType = useMemo(() => journal?.dataType || "s-t", [journal]);
  
  const availableFunctions = useMemo(
    () => Object.keys(CHART_FUNCTIONS).filter(key => CHART_FUNCTIONS[key].type === dataType),
    [dataType]
  );

  const currentFunction = useMemo(
    () => {
      // Проверяем, что выбранная функция доступна для текущего типа данных
      if (availableFunctions.length === 0) return null;
      
      // Если выбранная функция не подходит для текущего типа данных, берем первую доступную
      if (availableFunctions.includes(state.selectedFunction)) {
        return CHART_FUNCTIONS[state.selectedFunction];
      }
      
      return CHART_FUNCTIONS[availableFunctions[0]];
    },
    [state.selectedFunction, availableFunctions]
  );

  // Обработка точек данных (оптимизированная)
  const pointsByWell = useMemo(() => {
    if (!journal?.dataRows || !currentFunction) return {};
    const grouped = {};
    journal.dataRows.forEach(row => {
      if (!row || row.t == null) return;
      const t = parseFloat(row.t);
      const s = parseFloat(row.s);
      if (!isFinite(t) || t <= 0 || !isFinite(s) || s <= 0) return;
      const x = currentFunction.xTransform(t);
      const y = currentFunction.yTransform(s);
      if (!isFinite(x) || !isFinite(y) || x == null || y == null) return;
      const wellId = row.wellId || 'main';
      if (!grouped[wellId]) grouped[wellId] = [];
      grouped[wellId].push({ t, s, x, y, wellId, wellName: row.wellName || (wellId === 'main' ? 'Опытная' : String(wellId)) });
    });
    // Ограничим до 500 на скважину
    Object.keys(grouped).forEach(k => { grouped[k] = grouped[k].slice(0, 500); });
    return grouped;
  }, [journal?.dataRows, currentFunction]);

  const allPoints = useMemo(() => {
    const result = [];
    Object.keys(pointsByWell).forEach((wellId) => {
      if (visibleWells[wellId] === false) return;
      result.push(...pointsByWell[wellId]);
    });
    return result;
  }, [pointsByWell, visibleWells]);

  // Цвета по скважинам
  const wellIds = useMemo(() => Object.keys(pointsByWell), [pointsByWell]);
  const colorByWellId = useMemo(() => {
    const map = {};
    wellIds.forEach((id, idx) => { map[id] = WELL_COLORS[idx % WELL_COLORS.length]; });
    return map;
  }, [wellIds]);

  // Загрузка активного проекта
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
      // Backward compatibility: если journals есть и не пуст, используем их; иначе формируем один журнал из полей проекта
      const projectAsJournal = {
        name: project.name,
        testType: project.testType || 'Откачка/Восстановление',
        layerType: project.layerType || 'напорный',
        dataRows: project.dataRows || [],
        dataType: project.dataType || 's-t',
        observationWells: project.observationWells || [],
      };
      const js = (Array.isArray(project.journals) && project.journals.length > 0) ? project.journals : [projectAsJournal];
      setJournals(js);
      setSelectedJournalIdx(0);
      // Инициализируем видимость скважин: все видимы по умолчанию
      const wells = {};
      (project.dataRows || []).forEach(r => { wells[r.wellId || 'main'] = true; });
      setVisibleWells(wells);
      setState(prev => ({ ...prev, selectedPoints: {}, lineParams: {} }));
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveProject(null);
      setJournals([]);
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadActiveProject();
  }, [loadActiveProject]);

  // Обновляем выбранную функцию когда становятся доступны функции
  useEffect(() => {
    if (availableFunctions.length > 0 && !state.selectedFunction) {
      // Устанавливаем s-lg(t) как тип графика по умолчанию
      const defaultFunction = availableFunctions.find(f => f === 's-lg(t)') || availableFunctions[0];
      setState(prev => ({
        ...prev,
        selectedFunction: defaultFunction
      }));
    }
  }, [availableFunctions, state.selectedFunction]);

  // Обработчики событий
  const handleSelectJournal = useCallback((index) => {
    setSelectedJournalIdx(index);
    setState(prev => ({ ...prev, selectedPoints: {}, lineParams: {} }));
  }, []);

  const handleSelectFunction = useCallback((func) => {
    setState(prev => ({ 
      ...prev, 
      selectedFunction: func, 
      selectedPoints: {}, 
      lineParams: {} 
    }));
  }, []);

  const handlePointPress = useCallback((idx) => {
    setState(prev => {
      const point = allPoints[idx];
      if (!point) return prev; // Защита от undefined
      
      const wellId = point?.wellId || 'main';
      
      // Создаем структуру для выбранных точек по скважинам, если её еще нет
      const selectedPointsByWell = { ...prev.selectedPoints };
      if (!selectedPointsByWell[wellId]) {
        selectedPointsByWell[wellId] = [];
      }
      
      // Получаем текущие выбранные точки для этой скважины
      const currentSelectedPoints = [...(selectedPointsByWell[wellId] || [])];
      
      // Проверяем, выбрана ли уже эта точка
      const isSelected = currentSelectedPoints.includes(idx);
      
      let newSelectedPoints;
      
      if (isSelected) {
        // Убираем точку из выбранных
        newSelectedPoints = currentSelectedPoints.filter(i => i !== idx);
      } else if (currentSelectedPoints.length < 2) {
        // Добавляем точку (не более 2-х точек на скважину)
        newSelectedPoints = [...currentSelectedPoints, idx];
      } else {
        // Заменяем первую точку на новую
        newSelectedPoints = [currentSelectedPoints[1], idx];
      }
      
      // Обновляем выбранные точки для этой скважины
      selectedPointsByWell[wellId] = newSelectedPoints;
      
      // Пересчитываем параметры линии для двух точек этой скважины
      const lineParamsByWell = { ...prev.lineParams };
      
      if (newSelectedPoints.length === 2) {
        const p1 = allPoints[newSelectedPoints[0]];
        const p2 = allPoints[newSelectedPoints[1]];
        
        if (p1 && p2) {
          const dx = p2.x - p1.x;
          if (Math.abs(dx) > 1e-10) {
            const k = (p2.y - p1.y) / dx;
            const b = p1.y - k * p1.x;
            
            // Используем цвет скважины для линии
            const color = colorByWellId[wellId] || WELL_COLORS[0];
            
            lineParamsByWell[wellId] = { k, b, color };
            

          }
        }
      } else {
        // Если выбрано меньше двух точек, удаляем параметры линии
        delete lineParamsByWell[wellId];
      }
      
      return {
        ...prev,
        selectedPoints: selectedPointsByWell,
        lineParams: lineParamsByWell
      };
    });
  }, [allPoints, colorByWellId]);

  const handleSaveChart = useCallback(async () => {
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
      // Ошибка сохранения графика
      Alert.alert(I18n.t("error"), I18n.t("chartSaveError"));
    }
  }, [chartRef]);

  // Проверяем наличие данных
  const hasData = allPoints.length > 0;

  // Проверка состояний
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          {I18n.t("loading")}...
        </Text>
      </View>
    );
  }

  if (!activeProject) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
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
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
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
    <>
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Заголовок проекта */}
      <Surface style={[styles.headerCard, { backgroundColor: theme.colors.primary }]} elevation={4}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="chart-line" size={32} color={theme.colors.onPrimary} />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
              {I18n.t("processingTitle")}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onPrimary }]}>
              {I18n.t("project")}: {activeProject.name}
            </Text>
          </View>
        </View>
      </Surface>

      {/* Селектор журналов убран: журнал = проект */}

      {/* Селектор функций */}
      <FunctionSelector
        functions={availableFunctions}
        selectedFunction={state.selectedFunction}
        onSelectFunction={handleSelectFunction}
        theme={theme}
      />

      {/* Легенда скважин */}
      {Object.keys(pointsByWell).length > 0 && (
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}> 
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialIcons name="legend-toggle" size={24} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
                {I18n.t("observationWells")}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.keys(pointsByWell).map((wellId, idx) => (
                <Chip
                  key={wellId}
                  selected={visibleWells[wellId] !== false}
                  onPress={() => {
                    // Обновляем видимость скважины
                    setVisibleWells(prev => {
                      const newVisibility = !(prev[wellId] !== false);
                      
                      // Если скважина стала невидимой, удаляем её линию тренда
                      if (newVisibility === false) {
                        setState(prevState => {
                          const newLineParams = { ...prevState.lineParams };
                          delete newLineParams[wellId];
                          return {
                            ...prevState,
                            lineParams: newLineParams
                          };
                        });
                      }
                      
                      return { ...prev, [wellId]: newVisibility };
                    });
                  }}
                  style={{ 
                    backgroundColor: visibleWells[wellId] !== false ? theme.colors.primaryContainer : theme.colors.surface,
                    borderColor: theme.colors.outline,
                    borderWidth: 1,
                  }}
                  textStyle={{ color: theme.colors.onSurface }}
                  icon={() => (
                    <View style={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: 6, 
                      backgroundColor: colorByWellId[wellId],
                      marginRight: 4,
                    }} />
                  )}
                >
                  {pointsByWell[wellId]?.[0]?.wellName || String(wellId)}
                </Chip>
              ))}
            </View>
          </Card.Content>
      </Card>
      )}

      {/* Кнопка открытия графика */}
      {hasData && currentFunction && (
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialIcons name="timeline" size={24} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
                {I18n.t("chart")} • {allPoints.length} точек
              </Text>
            </View>
            
            <View style={styles.chartButtonContainer}>
              <Button
                mode="contained"
                icon="fullscreen"
                onPress={() => setShowChartModal(true)}
                style={[styles.chartButton, { backgroundColor: theme.colors.primary }]}
                labelStyle={{ color: theme.colors.onPrimary }}
              >
                Открыть график для анализа
              </Button>
              
              <Text style={[styles.chartDescription, { color: theme.colors.onSurfaceVariant }]}>
                График {currentFunction?.name || 'данных'} с возможностью выбора точек для построения линии тренда
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Результаты анализа */}
      {Object.keys(state.lineParams).length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialIcons name="analytics" size={24} color={theme.colors.secondary} />
              <Text style={[styles.cardTitle, { color: theme.colors.secondary }]}>
                {I18n.t("results")}
              </Text>
            </View>
            
            <View style={styles.resultGrid}>
              {Object.entries(state.lineParams).map(([groupId, params]) => {
                if (!params.k && !params.b) return null;
                
                // Получаем информацию о выбранных точках
                const selectedIndices = state.selectedPoints[groupId] || [];
                const selectedPointsInfo = selectedIndices.map(idx => {
                  const point = allPoints[idx];
                  return `${point?.wellName || 'Скважина'} (${point?.x?.toFixed(2)}, ${point?.y?.toFixed(2)})`;
                }).join(' ↔ ');
                
                return (
                  <View key={groupId} style={[styles.resultItem, { 
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary
                  }]}>
                    <View style={styles.resultHeader}>
                      <View style={{ 
                        width: 16, 
                        height: 16, 
                        borderRadius: 8, 
                        backgroundColor: theme.colors.primary,
                        marginRight: 8,
                      }} />
                      <Text style={[styles.resultLabel, { color: theme.colors.onSecondaryContainer }]}>
                        Линия тренда
                      </Text>
                    </View>
                    <View style={styles.resultValues}>
                      <Text style={[styles.resultValue, { color: theme.colors.secondary }]}>
                        k = {params.k.toFixed(4)}
                      </Text>
                      <Text style={[styles.resultValue, { color: theme.colors.secondary }]}>
                        b = {params.b.toFixed(4)}
                      </Text>
                    </View>
                    <Text style={[styles.resultPoints, { color: theme.colors.onSurfaceVariant }]}>
                      {selectedPointsInfo}
                    </Text>
                  </View>
                );
              })}
            </View>
            
            <Divider style={{ marginVertical: 12 }} />
            
            <View style={styles.formulaContainer}>
              {Object.entries(state.lineParams).map(([groupId, params]) => {
                if (!params.k && !params.b) return null;
                return (
                  <View key={groupId} style={styles.formulaItem}>
                    <Text style={[styles.formula, { color: theme.colors.onSecondaryContainer }]}>
                      Уравнение линии тренда:
                    </Text>
                    <Text style={[styles.formula, { color: theme.colors.onSecondaryContainer, fontFamily: 'monospace' }]}>
                      {currentFunction?.yLabel} = {params.k.toFixed(4)} × {currentFunction?.xLabel} + {params.b.toFixed(4)}
                    </Text>
                  </View>
                );
              })}
            </View>
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

    {/* Модальное окно графика */}
    {currentFunction && (
      <ChartModal
        visible={showChartModal}
        onClose={() => setShowChartModal(false)}
        points={allPoints}
        selectedPoints={state.selectedPoints}
        onPointPress={handlePointPress}
        lineParams={state.lineParams}
        selectedFunction={currentFunction}
        colorByWellId={colorByWellId}
        pointsByWell={pointsByWell}
      />
    )}
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 0,
    paddingTop: 8,
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
    opacity: 0.9,
  },
  card: {
    marginHorizontal: 16,
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
    flexDirection: 'column',
    gap: 12,
  },
  resultItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultValues: {
    flexDirection: 'column',
    gap: 8,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultPoints: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  formulaContainer: {
    gap: 8,
  },
  formulaItem: {
    gap: 4,
  },
  formula: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
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
  chartButtonContainer: {
    marginTop: 16,
    alignItems: 'center',
    gap: 12,
  },
  chartButton: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  chartDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});