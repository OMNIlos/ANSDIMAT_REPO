import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Platform,
  StatusBar,
  FlatList,
  Pressable,
} from 'react-native';
import { useTheme, Card, Surface } from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import I18n from '../../Localization';
import { LanguageContext } from '../../LanguageContext';

const STEPS = {
  BASIC_PARAMETERS: 0,
  PROCESSING_SETUP: 1,
  OBSERVATION_JOURNAL: 2,
  DISTANCES: 3,
};

const STEP_TITLES = {
  [STEPS.BASIC_PARAMETERS]: I18n.t('basicParameters'),
  [STEPS.PROCESSING_SETUP]: I18n.t('processingTypeSelection') || 'Выбор типа обработки',
  [STEPS.OBSERVATION_JOURNAL]: I18n.t('observationJournalStep'),
  [STEPS.DISTANCES]: I18n.t('distancesBetweenWells'),
};

export default function NewWizard({ navigation, route }) {
  const { locale } = useContext(LanguageContext);
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(STEPS.BASIC_PARAMETERS);
  const [activeProject, setActiveProject] = useState(null);
  const [errors, setErrors] = useState({});
  
  const [wizardData, setWizardData] = useState({
    // Основные параметры
    projectName: '',
    ofrType: 'Откачка/Восстановление', // Pumping/Recovery | Express | Packer
    layerType: 'напорный',
    wellName: '', // главное имя опытной скважины
    flowRate: '',
    flowRateUnit: 'м³/сут',
    aquiferThickness: '', // зависит от типа водоноса
    saturatedThickness: '',
    mainFormationThickness: '',
    experimentalWellRadius: '',
    
    // Журнал наблюдений
    // Даты обработки
    pumpingSelected: true,
    recoverySelected: true,
    pumpingStartDate: new Date(),
    recoveryStartDate: new Date(Date.now() + 60 * 60 * 1000),
    observationWells: [
      { id: 1, name: 'Скв. 7Ц', active: true }
    ],
    
    // Данные измерений для каждой скважины
    measurements: {
      1: {
        pumping: [
          { id: 1, time: '', timeUnit: 'мин', drawdown: '', date: new Date() }
        ],
        recovery: [
          { id: 1, time: '', timeUnit: 'мин', drawdown: '', date: new Date() }
        ]
      }
    },
    
    // Расстояния
    distances: {
      1: '0.074'
    }
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState('pumping');
  const [showMeasurementsFor, setShowMeasurementsFor] = useState(null);
  const [measurementType, setMeasurementType] = useState('pumping'); // 'pumping' or 'recovery'
  const [showFlowRateUnits, setShowFlowRateUnits] = useState(false);

  const flowRateUnits = [
    'м³/сут',
    'м³/час',
    'м³/мин',
    'л/с',
    'л/мин',
    'л/час',
    'm³/h',
    'l/day',
  ];

  useEffect(() => {
    const projectId = route?.params?.projectId;
    const projectName = route?.params?.projectName;
    const ofrType = route?.params?.ofrType;
    const isEditing = route?.params?.isEditing || false;

    if (isEditing && projectId) {
      // Режим редактирования - загружаем существующий проект
      loadExistingProjectForEditing();
    } else {
      // Режим создания
      loadActiveProject();
      // Применяем переданные параметры
      if (projectName != null || ofrType != null) {
        setWizardData(prev => ({
          ...prev,
          projectName: projectName != null ? projectName : prev.projectName,
          ofrType: ofrType != null ? ofrType : prev.ofrType,
        }));
      }
      // Затем загружаем сохраненные данные, но не перезаписываем переданные параметры
      loadWizardData();
    }
  }, [route?.params]);

  async function loadActiveProject() {
    try {
      const id = await AsyncStorage.getItem('pumping_active_project_id');
      if (!id) return;
      
      const projectsRaw = await AsyncStorage.getItem('pumping_projects');
      if (!projectsRaw) return;
      
      const projects = JSON.parse(projectsRaw);
      const project = projects.find(p => p.id === id);
      setActiveProject(project || null);
    } catch (error) {
      console.error('Error loading active project:', error);
    }
  }

  async function loadExistingProjectForEditing() {
    try {
      if (!route?.params?.projectId) return;
      
      const projectsRaw = await AsyncStorage.getItem('pumping_projects');
      if (!projectsRaw) return;
      
      const projects = JSON.parse(projectsRaw);
      const project = projects.find(p => String(p.id) === String(route.params.projectId));
      
      if (!project) {
        console.error('Project not found for editing:', route.params.projectId);
        return;
      }
      
      // Загружаем данные проекта в wizardData
      const projectData = {
        projectName: project.name || '',
        ofrType: project.testType || 'Откачка/Восстановление',
        layerType: project.layerType || 'напорный',
        wellName: project.wellName || project.observationWells?.[0]?.name || 'Скв. 7Ц',
        flowRate: project.flowRate || '',
        flowRateUnit: project.flowRateUnit || 'м³/сут',
        aquiferThickness: project.aquiferThickness || '',
        saturatedThickness: project.saturatedThickness || '',
        mainFormationThickness: project.mainFormationThickness || '',
        experimentalWellRadius: project.experimentalWellRadius || '',
        pumpingSelected: project.pumpingSelected !== false,
        recoverySelected: project.recoverySelected !== false,
        pumpingStartDate: project.pumpingStartDate ? new Date(project.pumpingStartDate) : new Date(),
        recoveryStartDate: project.recoveryStartDate ? new Date(project.recoveryStartDate) : new Date(Date.now() + 60 * 60 * 1000),
        observationWells: project.observationWells || [{ id: 1, name: 'Скв. 7Ц', active: true }],
        measurements: (() => {
          const measurements = project.measurements || {
            1: {
              pumping: [{ id: 1, time: '', timeUnit: 'мин', drawdown: '', date: new Date() }],
              recovery: [{ id: 1, time: '', timeUnit: 'мин', drawdown: '', date: new Date() }]
            }
          };
          
          // Convert measurement dates
          Object.keys(measurements).forEach(wellId => {
            ['pumping', 'recovery'].forEach(type => {
              if (measurements[wellId][type]) {
                measurements[wellId][type].forEach(measurement => {
                  if (measurement.date) {
                    measurement.date = new Date(measurement.date);
                  }
                });
              }
            });
          });
          
          return measurements;
        })(),
        distances: project.distances || { 1: '0.074' }
      };
      
      setWizardData(projectData);
      
      // Сохраняем во временные данные для восстановления при переключении шагов
      await AsyncStorage.setItem('wizard_temp_data', JSON.stringify(projectData));
      
    } catch (error) {
      console.error('Error loading project for editing:', error);
    }
  }

  async function loadWizardData() {
    try {
      const isEditing = route?.params?.isEditing || false;
      
      // Если мы в режиме редактирования, не загружаем временные данные
      if (isEditing) return;
      
      const savedData = await AsyncStorage.getItem('wizard_temp_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Convert date strings back to Date objects
        if (parsed.pumpingStartDate) parsed.pumpingStartDate = new Date(parsed.pumpingStartDate);
        if (parsed.recoveryStartDate) parsed.recoveryStartDate = new Date(parsed.recoveryStartDate);
        
        // Convert measurement dates
        Object.keys(parsed.measurements || {}).forEach(wellId => {
          ['pumping', 'recovery'].forEach(type => {
            if (parsed.measurements[wellId][type]) {
              parsed.measurements[wellId][type].forEach(measurement => {
                if (measurement.date) measurement.date = new Date(measurement.date);
              });
            }
          });
        });
        
        // Не перезаписываем переданные параметры
        const projectName = route?.params?.projectName;
        const ofrType = route?.params?.ofrType;
        if (projectName != null) parsed.projectName = projectName;
        if (ofrType != null) parsed.ofrType = ofrType;
        
        setWizardData(parsed);
      }
    } catch (error) {
      console.error('Error loading wizard data:', error);
    }
  }

  async function saveWizardData() {
    try {
      await AsyncStorage.setItem('wizard_temp_data', JSON.stringify(wizardData));
    } catch (error) {
      console.error('Error saving wizard data:', error);
    }
  }

  const updateData = (key, value) => {
    const newData = { ...wizardData, [key]: value };
    setWizardData(newData);
    saveWizardData();
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case STEPS.BASIC_PARAMETERS:
        if (!wizardData.wellName.trim()) {
          newErrors.wellName = 'Введите название скважины';
        }
        if (!wizardData.flowRate.trim()) {
          newErrors.flowRate = 'Введите расход';
        } else if (isNaN(parseFloat(wizardData.flowRate))) {
          newErrors.flowRate = 'Введите числовое значение';
        }
        if (wizardData.layerType === 'напорный') {
          if (!wizardData.aquiferThickness.trim()) newErrors.aquiferThickness = 'Введите мощность водоносного горизонта';
          else if (isNaN(parseFloat(wizardData.aquiferThickness))) newErrors.aquiferThickness = 'Введите числовое значение';
        } else if (wizardData.layerType === 'безнапорный') {
          if (!wizardData.saturatedThickness.trim()) newErrors.saturatedThickness = 'Введите насыщенную мощность';
          else if (isNaN(parseFloat(wizardData.saturatedThickness))) newErrors.saturatedThickness = 'Введите числовое значение';
        } else if (wizardData.layerType === 'с перетеканием') {
          if (!wizardData.mainFormationThickness.trim()) newErrors.mainFormationThickness = 'Введите основную мощность';
          else if (isNaN(parseFloat(wizardData.mainFormationThickness))) newErrors.mainFormationThickness = 'Введите числовое значение';
        }
        if (!wizardData.experimentalWellRadius.trim()) {
          newErrors.experimentalWellRadius = 'Введите радиус опытной скважины';
        } else if (isNaN(parseFloat(wizardData.experimentalWellRadius))) {
          newErrors.experimentalWellRadius = 'Введите числовое значение';
        }
        if (!wizardData.layerType) {
          newErrors.layerType = 'Выберите тип водоносного горизонта';
        }
        break;
      case STEPS.PROCESSING_SETUP:
        if (!wizardData.pumpingSelected && !wizardData.recoverySelected) {
          newErrors.processingTypes = 'Выберите хотя бы один тип обработки';
        }
        if (wizardData.pumpingSelected && !wizardData.pumpingStartDate) {
          newErrors.pumpingStartDate = 'Укажите дату начала откачки';
        }
        if (wizardData.recoverySelected && !wizardData.recoveryStartDate) {
          newErrors.recoveryStartDate = 'Укажите дату начала восстановления';
        }
        break;
        
      case STEPS.OBSERVATION_JOURNAL:
        // Проверяем, что есть хотя бы одна наблюдательная скважина
        if (!wizardData.observationWells || wizardData.observationWells.length === 0) {
          newErrors.wells = 'Добавьте хотя бы одну наблюдательную скважину';
        }
        // Валидация порядков времени в текущих измерениях
        wizardData.observationWells.forEach(well => {
          ['pumping', 'recovery'].forEach(type => {
            const list = wizardData.measurements[well.id]?.[type] || [];
            for (let i = 1; i < list.length; i += 1) {
              const prev = parseFloat(list[i - 1].time || '');
              const curr = parseFloat(list[i].time || '');
              if (!isNaN(prev) && !isNaN(curr) && prev > curr) {
                newErrors[`measure_${well.id}_${type}_${i}`] = 'Время должно неубывать';
                break;
              }
            }
          });
        });
        break;
        
      case STEPS.DISTANCES:
        wizardData.observationWells.forEach(well => {
          const distance = wizardData.distances[well.id];
          if (!distance || distance.trim() === '') {
            newErrors[`distance_${well.id}`] = 'Введите расстояние';
          } else if (isNaN(parseFloat(distance))) {
            newErrors[`distance_${well.id}`] = 'Введите числовое значение';
          }
        });
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.DISTANCES) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > STEPS.BASIC_PARAMETERS) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addObservationWell = () => {
    const newWell = {
      id: Date.now().toString(),
      name: `Скв. ${String.fromCharCode(65 + wizardData.observationWells.length)}`,
      active: true
    };
    
    const updatedWells = [...wizardData.observationWells, newWell];
    const updatedMeasurements = {
      ...wizardData.measurements,
      [newWell.id]: {
        pumping: [{ id: 1, time: '', drawdown: '', date: new Date() }],
        recovery: [{ id: 1, time: '', drawdown: '', date: new Date() }]
      }
    };
    const updatedDistances = {
      ...wizardData.distances,
      [newWell.id]: ''
    };
    
    setWizardData(prev => ({
      ...prev,
      observationWells: updatedWells,
      measurements: updatedMeasurements,
      distances: updatedDistances
    }));
  };

  const addMeasurement = (wellId, type, insertAfterId = null) => {
    const newMeasurement = {
      id: Date.now().toString(),
      time: '',
      timeUnit: 'мин',
      drawdown: '',
      date: new Date()
    };
    
    setWizardData(prev => {
      const list = prev.measurements[wellId][type] || [];
      let newList;
      if (insertAfterId) {
        const idx = list.findIndex(m => String(m.id) === String(insertAfterId));
        if (idx >= 0) {
          newList = [...list.slice(0, idx + 1), newMeasurement, ...list.slice(idx + 1)];
        } else newList = [...list, newMeasurement];
      } else newList = [...list, newMeasurement];
      return ({
        ...prev,
        measurements: {
          ...prev.measurements,
          [wellId]: {
            ...prev.measurements[wellId],
            [type]: newList
          }
        }
      });
    });
  };

  const deleteMeasurement = (wellId, type, measurementId) => {
    setWizardData(prev => ({
      ...prev,
      measurements: {
        ...prev.measurements,
        [wellId]: {
          ...prev.measurements[wellId],
          [type]: prev.measurements[wellId][type].filter(m => m.id !== measurementId)
        }
      }
    }));
  };

  const updateMeasurement = (wellId, type, measurementId, field, value) => {
    setWizardData(prev => ({
      ...prev,
      measurements: {
        ...prev.measurements,
        [wellId]: {
          ...prev.measurements[wellId],
          [type]: prev.measurements[wellId][type].map(m =>
            m.id === measurementId ? { ...m, [field]: value } : m
          )
        }
      }
    }));
  };

  // Функция для переключения единиц времени при нажатии
  const toggleTimeUnit = (wellId, type, measurementId) => {
    const measurement = wizardData.measurements[wellId]?.[type]?.find(m => m.id === measurementId);
    if (!measurement) return;
    
    const currentUnit = measurement.timeUnit || 'мин';
    const units = ['сек', 'мин', 'час', 's', 'm', 'h'];
    const currentIndex = units.indexOf(currentUnit);
    const nextIndex = (currentIndex + 1) % units.length;
    const nextUnit = units[nextIndex];
    
    updateMeasurement(wellId, type, measurementId, 'timeUnit', nextUnit);
  };



  // Функция для преобразования measurements в формат dataRows
  const convertMeasurementsToDataRows = (measurements, observationWells) => {
    const dataRows = [];
    
    observationWells.forEach(well => {
      const wellMeasurements = measurements[well.id];
      if (wellMeasurements) {
        // Добавляем данные откачки
        if (wellMeasurements.pumping) {
          wellMeasurements.pumping.forEach(measurement => {
            if (measurement.time && measurement.drawdown) {
              const tVal = parseFloat(measurement.time);
              const unit = measurement.timeUnit || 'мин';
              let days = tVal;
              if (unit === 'сек' || unit === 's') days = tVal / 86400;
              else if (unit === 'мин' || unit === 'm') days = tVal / 1440;
              else if (unit === 'час' || unit === 'h') days = tVal / 24;
              dataRows.push({
                t: days,
                s: parseFloat(measurement.drawdown),
                wellId: well.id,
                wellName: well.name,
                type: 'pumping'
              });
            }
          });
        }
        
        // Добавляем данные восстановления
        if (wellMeasurements.recovery) {
          wellMeasurements.recovery.forEach(measurement => {
            if (measurement.time && measurement.drawdown) {
              const tVal = parseFloat(measurement.time);
              const unit = measurement.timeUnit || 'мин';
              let days = tVal;
              if (unit === 'сек' || unit === 's') days = tVal / 86400;
              else if (unit === 'мин' || unit === 'm') days = tVal / 1440;
              else if (unit === 'час' || unit === 'h') days = tVal / 24;
              dataRows.push({
                t: days,
                s: parseFloat(measurement.drawdown),
                wellId: well.id,
                wellName: well.name,
                type: 'recovery'
              });
            }
          });
        }
      }
    });
    
    // Сортируем по времени
    return dataRows.sort((a, b) => a.t - b.t);
  };

  // Шаг 1: Основные параметры
  const renderBasicParameters = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
            <MaterialIcons name="settings" size={20} color={theme.colors.primary} /> 
            {I18n.t("basicParameters")}
          </Text>

          {/* Имя проекта/журнала (только инфо) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Название проекта/журнала</Text>
            <Surface style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
              <Text style={{ color: theme.colors.text }}>
                {wizardData.projectName || '-'} 
              </Text>
            </Surface>
          </View>

          {/* Тип ОФР (только инфо) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Тип ОФР</Text>
            <Surface style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
              <Text style={{ color: theme.colors.text }}>{wizardData.ofrType}</Text>
            </Surface>
            <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant, marginTop: 6 }]}>Пока реализован только вариант "Откачка/Восстановление".</Text>
          </View>
          
          {/* Тип водоносного горизонта */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {I18n.t("layerType")} *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={[styles.radioGroup, { flexDirection: 'row', gap: 20, paddingHorizontal: 16 }]}>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    { borderColor: wizardData.layerType === 'напорный' ? theme.colors.primary : theme.colors.border }
                  ]}
                  onPress={() => updateData('layerType', 'напорный')}
                >
                  <MaterialIcons 
                    name={wizardData.layerType === 'напорный' ? 'radio-button-checked' : 'radio-button-unchecked'} 
                    size={20} 
                    color={wizardData.layerType === 'напорный' ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                  <Text style={[styles.radioText, { color: theme.colors.text }]}>{I18n.t("confined")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    { borderColor: wizardData.layerType === 'безнапорный' ? theme.colors.primary : theme.colors.border }
                  ]}
                  onPress={() => updateData('layerType', 'безнапорный')}
                >
                  <MaterialIcons 
                    name={wizardData.layerType === 'безнапорный' ? 'radio-button-checked' : 'radio-button-unchecked'} 
                    size={20} 
                    color={wizardData.layerType === 'безнапорный' ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                  <Text style={[styles.radioText, { color: theme.colors.text }]}>{I18n.t("unconfined")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    { borderColor: wizardData.layerType === 'с перетеканием' ? theme.colors.primary : theme.colors.border }
                  ]}
                  onPress={() => updateData('layerType', 'с перетеканием')}
                >
                  <MaterialIcons 
                    name={wizardData.layerType === 'с перетеканием' ? 'radio-button-checked' : 'radio-button-unchecked'} 
                    size={20} 
                    color={wizardData.layerType === 'с перетеканием' ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                  <Text style={[styles.radioText, { color: theme.colors.text }]}>{I18n.t("withInterflow")}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {errors.layerType && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.layerType}
              </Text>
            )}
          </View>

          {/* Название главной (опытной) скважины */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {I18n.t("wellName")} *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  borderColor: errors.wellName ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                }
              ]}
              value={wizardData.wellName}
              onChangeText={(value) => updateData('wellName', value)}
              placeholder={I18n.t("wellNamePlaceholder")}
              placeholderTextColor={theme.colors.textSecondary}
            />
            {errors.wellName && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.wellName}
              </Text>
            )}
          </View>

          {/* Расход */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {I18n.t("flowRate")} *
            </Text>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.numberInput,
                  {
                    borderColor: errors.flowRate ? theme.colors.error : theme.colors.border,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                  }
                ]}
                value={wizardData.flowRate}
                onChangeText={(value) => updateData('flowRate', value)}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[styles.unitSelector, { 
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface
                }]}
                onPress={() => setShowFlowRateUnits(true)}
              >
                <Text style={[styles.unitText, { color: theme.colors.text }]}>
                  {wizardData.flowRateUnit}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {errors.flowRate && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.flowRate}
              </Text>
            )}
          </View>

          {/* Зависимые поля по типу водоноса */}
          {wizardData.layerType === 'напорный' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}> 
                {I18n.t("aquiferThickness")} (м) *
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: errors.aquiferThickness ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background, color: theme.colors.text }]}
                value={wizardData.aquiferThickness}
                onChangeText={(value) => updateData('aquiferThickness', value)}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />
              {errors.aquiferThickness && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.aquiferThickness}</Text>
              )}
            </View>
          )}
          {wizardData.layerType === 'безнапорный' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}> 
                {I18n.t("saturatedThickness")} (м) *
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: errors.saturatedThickness ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background, color: theme.colors.text }]}
                value={wizardData.saturatedThickness}
                onChangeText={(value) => updateData('saturatedThickness', value)}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />
              {errors.saturatedThickness && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.saturatedThickness}</Text>
              )}
            </View>
          )}
          {wizardData.layerType === 'с перетеканием' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}> 
                {I18n.t("mainFormationThickness")} (м) *
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: errors.mainFormationThickness ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background, color: theme.colors.text }]}
                value={wizardData.mainFormationThickness}
                onChangeText={(value) => updateData('mainFormationThickness', value)}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />
              {errors.mainFormationThickness && (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.mainFormationThickness}</Text>
              )}
            </View>
          )}

          {/* Радиус опытной скважины */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{I18n.t("wellRadius")} (м) *</Text>
            <TextInput
              style={[styles.textInput, { borderColor: errors.experimentalWellRadius ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background, color: theme.colors.text }]}
              value={wizardData.experimentalWellRadius}
              onChangeText={(value) => updateData('experimentalWellRadius', value)}
              placeholder="0.000"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
            />
            {errors.experimentalWellRadius && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.experimentalWellRadius}</Text>
            )}
          </View>
        </View>
      </Card>

      <View style={[styles.infoCardContainer, { marginTop: 10, marginBottom: '40%'}]}>
        <Card.Content>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info" size={24} color={theme.colors.primary} />
            <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>{I18n.t("information")}</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            {(() => {
              const isEditing = route?.params?.isEditing || false;
              if (isEditing) {
                return `Редактирование проекта "${route?.params?.projectName || 'Неизвестный проект'}". Все изменения будут сохранены.`;
              } else if (activeProject) {
                return `${I18n.t("journalWillBeAddedToActiveProject")} "${activeProject.name}".`;
              } else {
                return `${I18n.t("noActiveProject")} ${I18n.t("newProjectWillBeCreated")}`;
              }
            })()}
            {'\n\n'}
            {I18n.t("firstStep")}
            {'\n\n'}
            {I18n.t("secondStep")}
          </Text>
        </Card.Content>
      </View>
    </ScrollView>
  );

  // Шаг 2: Выбор типов обработки, даты и главный ствол
  const renderProcessingSetup = () => {
    const pumpingDurationHours = wizardData.pumpingSelected && wizardData.recoverySelected
      ? Math.max(0, (wizardData.recoveryStartDate - wizardData.pumpingStartDate) / 3600000).toFixed(2)
      : null;
    return (
      <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
        <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface }]}> 
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.colors.primary }]}> 
              <MaterialIcons name="tune" size={20} color={theme.colors.primary} /> 
              Тип обработки и даты
            </Text>

            {/* Выбор типов */}
            <View style={styles.radioGroup}>
              {[{key:'pumpingSelected', label:'Откачка'}, {key:'recoverySelected', label:'Восстановление'}].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.radioOption, { borderColor: wizardData[opt.key] ? theme.colors.primary : theme.colors.border }]}
                  onPress={() => updateData(opt.key, !wizardData[opt.key])}
                >
                  <MaterialIcons name={wizardData[opt.key] ? 'check-box' : 'check-box-outline-blank'} size={20} color={wizardData[opt.key] ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[styles.radioText, { color: theme.colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.processingTypes && <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.processingTypes}</Text>}

            {/* Даты */}
            {wizardData.pumpingSelected && (
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, marginTop: 12 }]}
                onPress={() => {
                  setDatePickerType('pumping');
                  setShowDatePicker(true);
                }}
              >
                <MaterialIcons name="calendar-today" size={20} color={theme.colors.primary} />
                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                  Начало откачки: {wizardData.pumpingStartDate.toLocaleDateString('ru-RU')} {wizardData.pumpingStartDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            )}
            {wizardData.recoverySelected && (
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, marginTop: 12 }]}
                onPress={() => {
                  setDatePickerType('recovery');
                  setShowDatePicker(true);
                }}
              >
                <MaterialIcons name="calendar-today" size={20} color={theme.colors.primary} />
                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                  Начало восстановления: {wizardData.recoveryStartDate.toLocaleDateString('ru-RU')} {wizardData.recoveryStartDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            )}

            {wizardData.pumpingSelected && wizardData.recoverySelected && (
              <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>Длительность откачки: {pumpingDurationHours} ч</Text>
            )}
          </View>
        </Card>

        {/* Главная (опытная) скважина */}
        <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface }]}> 
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: theme.colors.primary }]}> 
              <MaterialCommunityIcons name="water-well" size={20} color={theme.colors.primary} /> 
              Опытная скважина (главная)
            </Text>
            <Surface style={[styles.wellCard, { backgroundColor: theme.colors.background }]}> 
              <View style={styles.wellHeader}>
                <MaterialCommunityIcons name="water-well" size={24} color={theme.colors.primary} />
                <TextInput
                  style={[styles.textInput, { flex: 1, marginLeft: 8, borderColor: theme.colors.border, backgroundColor: theme.colors.background, color: theme.colors.text }]}
                  value={wizardData.wellName}
                  onChangeText={(v) => updateData('wellName', v)}
                />
                {/* Без удаления для главной */}
              </View>
              <View style={styles.wellButtons}>
                {wizardData.pumpingSelected && (
                  <TouchableOpacity
                    style={[styles.wellButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => { setShowMeasurementsFor('1'); setMeasurementType('pumping'); }}
                  >
                    <MaterialIcons name="arrow-downward" size={18} color={theme.colors.white} />
                    <Text style={[styles.wellButtonText, { color: theme.colors.white }]}>Откачка ({wizardData.measurements['1']?.pumping?.length || 0})</Text>
                  </TouchableOpacity>
                )}
                {wizardData.recoverySelected && (
                  <TouchableOpacity
                    style={[styles.wellButton, { backgroundColor: theme.colors.secondary }]}
                    onPress={() => { setShowMeasurementsFor('1'); setMeasurementType('recovery'); }}
                  >
                    <MaterialIcons name="arrow-upward" size={18} color={theme.colors.white} />
                    <Text style={[styles.wellButtonText, { color: theme.colors.white }]}>Восстановление ({wizardData.measurements['1']?.recovery?.length || 0})</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Surface>
          </View>
        </Card>
      </ScrollView>
    );
  };

  // Шаг 3: Журнал наблюдений по доп. скважинам
  const renderObservationJournal = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      {/* Наблюдательные скважины */}
      <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardContent}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
              <MaterialCommunityIcons name="map-marker-multiple" size={20} color={theme.colors.primary} /> 
              Наблюдательные скважины
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
              onPress={addObservationWell}
            >
              <MaterialIcons name="add" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

           {wizardData.observationWells.filter(w => String(w.id) !== '1').map((well, index) => (
            <Surface 
              key={well.id} 
              style={[styles.wellCard, { backgroundColor: theme.colors.background }]}
            >
              <View style={styles.wellHeader}>
                <MaterialCommunityIcons name="water-well" size={24} color={theme.colors.primary} />
                <TextInput
                  style={[styles.textInput, { flex: 1, marginLeft: 8, borderColor: theme.colors.border, backgroundColor: theme.colors.background, color: theme.colors.text }]}
                  value={well.name}
                  onChangeText={(v) => {
                    const newWells = wizardData.observationWells.map(w => w.id === well.id ? { ...w, name: v } : w);
                    updateData('observationWells', newWells);
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    const newWells = wizardData.observationWells.filter(w => w.id !== well.id);
                    const { [well.id]: removed, ...restDistances } = wizardData.distances;
                    const { [well.id]: removedM, ...restMeas } = wizardData.measurements;
                    setWizardData(prev => ({ ...prev, observationWells: newWells, distances: restDistances, measurements: restMeas }));
                  }}
                >
                  <MaterialIcons name="delete" size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.wellButtons}>
                {wizardData.pumpingSelected && (
                  <TouchableOpacity
                    style={[styles.wellButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      setShowMeasurementsFor(well.id);
                      setMeasurementType('pumping');
                    }}
                  >
                    <MaterialIcons name="arrow-downward" size={18} color={theme.colors.white} />
                    <Text style={[styles.wellButtonText, { color: theme.colors.white }]}>Откачка ({wizardData.measurements[well.id]?.pumping?.length || 0})</Text>
                  </TouchableOpacity>
                )}
                {wizardData.recoverySelected && (
                  <TouchableOpacity
                    style={[styles.wellButton, { backgroundColor: theme.colors.secondary }]}
                    onPress={() => {
                      setShowMeasurementsFor(well.id);
                      setMeasurementType('recovery');
                    }}
                  >
                    <MaterialIcons name="arrow-upward" size={18} color={theme.colors.white} />
                    <Text style={[styles.wellButtonText, { color: theme.colors.white }]}>Восстановление ({wizardData.measurements[well.id]?.recovery?.length || 0})</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Surface>
          ))}
          
          {wizardData.observationWells.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="map-marker-plus" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Добавьте наблюдательные скважины
              </Text>
            </View>
          )}
        </View>
      </Card>
    </ScrollView>
  );

  // Модальное окно для редактирования измерений
  const renderMeasurementsModal = () => {
    if (!showMeasurementsFor) return null;
    
    const well = wizardData.observationWells.find(w => w.id === showMeasurementsFor);
    const measurements = wizardData.measurements[showMeasurementsFor]?.[measurementType] || [];
    
    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.primary }]}>
            <TouchableOpacity onPress={() => setShowMeasurementsFor(null)}>
              <MaterialIcons name="close" size={24} color={theme.colors.white} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
              {well?.name} - {measurementType === 'pumping' ? I18n.t('pumping') : I18n.t('recovery')}
            </Text>
            <TouchableOpacity onPress={() => addMeasurement(showMeasurementsFor, measurementType)}>
              <MaterialIcons name="add" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={measurements}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.measurementsList}
            renderItem={({ item, index }) => (
              <Surface style={[styles.measurementItem, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.measurementHeader}>
                  <Text style={[styles.measurementNumber, { color: theme.colors.text }]}>
                    Измерение {index + 1}
                  </Text>
                  {measurements.length > 1 && (
                    <TouchableOpacity 
                      onPress={() => deleteMeasurement(showMeasurementsFor, measurementType, item.id)}
                    >
                      <MaterialIcons name="delete" size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.measurementInputs}>
                  <View style={styles.measurementField}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Время</Text>
                    <TextInput
                      style={[styles.measurementInput, { 
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text 
                      }]}
                      value={item.time}
                      onChangeText={(value) => updateMeasurement(showMeasurementsFor, measurementType, item.id, 'time', value)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => toggleTimeUnit(showMeasurementsFor, measurementType, item.id)} style={{ marginTop: 6 }}>
                      <Text style={{ color: theme.colors.primary }}>{I18n.t("timeUnit")}: {item.timeUnit || 'мин'}</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.measurementField}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Понижение (м)</Text>
                    <TextInput
                      style={[styles.measurementInput, { 
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text 
                      }]}
                      value={item.drawdown}
                      onChangeText={(value) => updateMeasurement(showMeasurementsFor, measurementType, item.id, 'drawdown', value)}
                      placeholder="0.0"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Разделитель с кнопкой вставки */}
                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  <TouchableOpacity onPress={() => addMeasurement(showMeasurementsFor, measurementType, item.id)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: theme.colors.surface }}>
                    <Text style={{ color: theme.colors.primary }}>{I18n.t("insertMeasurement")}</Text>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}
          />
        </View>
      </Modal>
    );
  };

  // Шаг 4: Расстояния
  const renderDistances = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Card style={[styles.distanceCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{I18n.t("distancesBetweenWells")}</Text>
          
           {wizardData.observationWells.filter(w => String(w.id) !== '1').map((well) => (
            <View key={well.id} style={styles.distanceRow}>
              <View style={styles.distanceInfo}>
                <MaterialCommunityIcons name="water-well" size={20} color={theme.colors.primary} />
                <Text style={[styles.distanceLabel, { color: theme.colors.text }]}>
                  {I18n.t("distanceTo")} {well.name}, {I18n.t("km")}:
                </Text>
              </View>
              <View style={styles.distanceInputContainer}>
                <TextInput
                  style={[styles.distanceInput, { 
                    borderColor: errors[`distance_${well.id}`] ? theme.colors.error : theme.colors.border,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text 
                  }]}
                  value={wizardData.distances[well.id] || ''}
                  onChangeText={(value) => updateData('distances', {
                    ...wizardData.distances,
                    [well.id]: value
                  })}
                  placeholder="0.000"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="numeric"
                />
                {errors[`distance_${well.id}`] && (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors[`distance_${well.id}`]}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      <View style={[styles.infoCardContainer, { backgroundColor: 'transparent' }]}>
        <Card.Content>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info" size={24} color={theme.colors.primary} />
            <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>{I18n.t("information")}</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.colors.onPrimaryContainer }]}>
            Укажите расстояния от опытной скважины до каждой наблюдательной скважины в километрах.
            Точность расстояний влияет на качество интерпретации данных.
            {'\n\n'}
            {I18n.t("journalCreationInfo")}
          </Text>
        </Card.Content>
      </View>
    </ScrollView>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.BASIC_PARAMETERS:
        return renderBasicParameters();
      case STEPS.PROCESSING_SETUP:
        return renderProcessingSetup();
      case STEPS.OBSERVATION_JOURNAL:
        return renderObservationJournal();
      case STEPS.DISTANCES:
        return renderDistances();
      default:
        return renderBasicParameters();
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.BASIC_PARAMETERS) {
      prevStep();
    } else {
      navigation.goBack();
    }
  };

  const handleNext = async () => {
    if (currentStep < STEPS.DISTANCES) {
      nextStep();
    } else {
      // Завершение мастера - создание или обновление журнала
      if (validateStep(currentStep)) {
        try {
          const isEditing = route?.params?.isEditing || false;
          const existingProjectId = route?.params?.projectId;
          
          if (isEditing && existingProjectId) {
            // Обновляем существующий проект
            const projectsRaw = await AsyncStorage.getItem('pumping_projects');
            if (!projectsRaw) {
              Alert.alert('Ошибка', 'Не удалось найти проекты для обновления');
              return;
            }
            
            const projects = JSON.parse(projectsRaw);
            const projectIndex = projects.findIndex(p => String(p.id) === String(existingProjectId));
            
            if (projectIndex === -1) {
              Alert.alert('Ошибка', 'Проект не найден для обновления');
              return;
            }
            
            const dataRows = convertMeasurementsToDataRows(wizardData.measurements, wizardData.observationWells);
            const updatedProject = {
              ...projects[projectIndex],
              name: wizardData.projectName || `Журнал ${wizardData.wellName}`,
              lastAccessDate: new Date().toISOString(),
              testType: wizardData.ofrType || 'Откачка/Восстановление',
              layerType: wizardData.layerType,
              wellName: wizardData.wellName, // Добавляем сохранение названия скважины
              flowRate: wizardData.flowRate,
              flowRateUnit: wizardData.flowRateUnit,
              experimentalWellRadius: wizardData.experimentalWellRadius,
              aquiferThickness: wizardData.aquiferThickness,
              saturatedThickness: wizardData.saturatedThickness,
              mainFormationThickness: wizardData.mainFormationThickness,
              pumpingSelected: wizardData.pumpingSelected,
              recoverySelected: wizardData.recoverySelected,
              pumpingStartDate: wizardData.pumpingStartDate?.toISOString?.() || new Date().toISOString(),
              recoveryStartDate: wizardData.recoveryStartDate?.toISOString?.() || new Date().toISOString(),
              observationWells: wizardData.observationWells,
              measurements: wizardData.measurements,
              distances: wizardData.distances,
              dataRows,
              dataType: 's-t',
            };
            
            projects[projectIndex] = updatedProject;
            await AsyncStorage.setItem('pumping_projects', JSON.stringify(projects));
            
            Alert.alert(
              'Успех', 
              `Проект "${updatedProject.name}" обновлен успешно!`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          } else {
            // Создаем новый проект
            const projectId = Date.now().toString();
            const dataRows = convertMeasurementsToDataRows(wizardData.measurements, wizardData.observationWells);
            const projectData = {
              id: projectId,
              name: wizardData.projectName || `Журнал ${wizardData.wellName}`,
              createdAt: new Date().toISOString(),
              lastAccessDate: new Date().toISOString(),
              favorite: false,
              testType: wizardData.ofrType || 'Откачка/Восстановление',
              layerType: wizardData.layerType,
              wellName: wizardData.wellName, // Добавляем сохранение названия скважины
              flowRate: wizardData.flowRate,
              flowRateUnit: wizardData.flowRateUnit,
              experimentalWellRadius: wizardData.experimentalWellRadius,
              aquiferThickness: wizardData.aquiferThickness,
              saturatedThickness: wizardData.saturatedThickness,
              mainFormationThickness: wizardData.mainFormationThickness,
              pumpingSelected: wizardData.pumpingSelected,
              recoverySelected: wizardData.recoverySelected,
              pumpingStartDate: wizardData.pumpingStartDate?.toISOString?.() || new Date().toISOString(),
              recoveryStartDate: wizardData.recoveryStartDate?.toISOString?.() || new Date().toISOString(),
              observationWells: wizardData.observationWells,
              measurements: wizardData.measurements,
              distances: wizardData.distances,
              dataRows,
              dataType: 's-t',
              journals: [],
            };

            const existingProjects = await AsyncStorage.getItem('pumping_projects');
            const projects = existingProjects ? JSON.parse(existingProjects) : [];
            projects.unshift(projectData);
            await AsyncStorage.setItem('pumping_projects', JSON.stringify(projects));
            await AsyncStorage.setItem('pumping_active_project_id', String(projectId));
            
            Alert.alert(
              'Успех', 
              `Журнал "${projectData.name}" создан успешно!`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
          
          // Очистка временных данных
          await AsyncStorage.removeItem('wizard_temp_data');
        } catch (error) {
          console.error('Error saving journal:', error);
          Alert.alert('Ошибка', 'Не удалось сохранить журнал');
        }
      }
    }
  };

  const getBackButtonText = () => {
    if (currentStep === STEPS.BASIC_PARAMETERS) {
      return 'Назад';
    }
    return 'Предыдущий';
  };

  const getNextButtonText = () => {
    const isEditing = route?.params?.isEditing || false;
    if (currentStep === STEPS.DISTANCES) {
      return isEditing ? 'Сохранить изменения' : 'Создать журнал';
    }
    return 'Далее';
  };

  const getCurrentTitle = () => {
    return STEP_TITLES[currentStep];
  };

  const getCurrentSubtitle = () => {
    const isEditing = route?.params?.isEditing || false;
    if (isEditing) {
      return `Редактирование проекта: ${route?.params?.projectName || 'Неизвестный проект'}`;
    } else if (activeProject) {
      return `${I18n.t('project')}: ${activeProject.name}`;
    } else {
      return I18n.t('newProject');
    }
  };

  // Модальное окно для выбора единиц расхода
  const renderFlowRateUnitsModal = () => (
    <Modal
      visible={showFlowRateUnits}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFlowRateUnits(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: theme.colors.primary }]}>
          <TouchableOpacity onPress={() => setShowFlowRateUnits(false)}>
            <MaterialIcons name="close" size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
            {I18n.t('flowRateUnits')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.unitsContent}>
          {flowRateUnits.map((unit) => (
            <TouchableOpacity
              key={unit}
              style={[
                styles.unitOption,
                {
                  backgroundColor: wizardData.flowRateUnit === unit ? theme.colors.primary + '20' : theme.colors.surface,
                  borderColor: wizardData.flowRateUnit === unit ? theme.colors.primary : theme.colors.border,
                }
              ]}
              onPress={() => {
                updateData('flowRateUnit', unit);
                setShowFlowRateUnits(false);
              }}
            >
              <Text style={[
                styles.unitOptionText,
                { 
                  color: wizardData.flowRateUnit === unit ? theme.colors.primary : theme.colors.text,
                  fontWeight: wizardData.flowRateUnit === unit ? '600' : 'normal',
                }
              ]}>
                {unit}
              </Text>
              {wizardData.flowRateUnit === unit && (
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" /> 
           
      {/* Step indicator */}
      <Surface style={[styles.stepIndicator, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.stepProgress}>
          {[0, 1, 2].map((step) => (
            <View key={step} style={styles.stepDot}>
              <View style={[
                styles.stepCircle,
                { backgroundColor: step <= currentStep ? theme.colors.primary : theme.colors.border }
              ]}>
                {step < currentStep ? (
                  <MaterialIcons name="check" size={16} color={theme.colors.white} />
                ) : (
                  <Text style={[styles.stepNumber, { 
                    color: step === currentStep ? theme.colors.white : theme.colors.textSecondary 
                  }]}>
                    {step + 1}
                  </Text>
                )}
              </View>
              {step < 2 && (
                <View style={[
                  styles.stepLine,
                  { backgroundColor: step < currentStep ? theme.colors.primary : theme.colors.border }
                ]} />
              )}
            </View>
          ))}
        </View>
        <Text style={[styles.stepText, { color: theme.colors.text }]}>{getCurrentTitle()}</Text>
        <Text style={[styles.stepSubtext, { color: theme.colors.textSecondary }]}>{getCurrentSubtitle()}</Text>
      </Surface>

      {/* Content */}
      <View style={styles.content}>
        {renderStepContent()}
      </View>

      {/* Navigation buttons */}
      <View style={styles.navigationButtonsContainer}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: theme.colors.secondary }]} 
          onPress={handleBack}
        >
          <MaterialIcons name="chevron-left" size={20} color={theme.colors.white} />
          
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.nextButton, { backgroundColor: theme.colors.primary }]} 
          onPress={handleNext}
        >
          
          <MaterialIcons name="chevron-right" size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Measurements Modal */}
      {renderMeasurementsModal()}

      {/* Date Picker Modal */}
      {showDatePicker && (
        Platform.OS === 'android' ? (
          <DateTimePicker
            value={datePickerType === 'pumping' ? wizardData.pumpingStartDate : wizardData.recoveryStartDate}
            mode="datetime"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                updateData(datePickerType === 'pumping' ? 'pumpingStartDate' : 'recoveryStartDate', selectedDate);
              }
            }}
          />
        ) : (
          <Modal visible={showDatePicker} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
              <View style={[styles.modalHeader, { backgroundColor: theme.colors.primary }]}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <MaterialIcons name="close" size={24} color={theme.colors.white} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
                  {I18n.t("dateTimeSelection")}
                </Text>
                <View style={{ width: 24 }} />
              </View>
              
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={datePickerType === 'pumping' ? wizardData.pumpingStartDate : wizardData.recoveryStartDate}
                  mode="datetime"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      updateData(datePickerType === 'pumping' ? 'pumpingStartDate' : 'recoveryStartDate', selectedDate);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )
      )}

      {/* Flow Rate Units Modal */}
      {renderFlowRateUnitsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepIndicator: {
    padding: 20,
  },
  stepProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepDot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepLine: {
    width: 50,
    height: 2,
    marginHorizontal: 8,
  },
  stepText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  stepSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 16,
  },
  stepContainer: {
    flex: 1,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  numberInput: {
    flex: 1,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  radioText: {
    fontSize: 16,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#F9F9F9',
  },
  dropdownText: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  inputWithUnit: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
    minWidth: 80,
  },
  unitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  infoCard: {
    marginTop: 8,
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
  },
  infoCardContainer: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dateCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  dateRow: {
    gap: 16,
  },
  dateItem: {
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 14,
    marginLeft: 'auto',
  },
  wellsCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  wellsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addWellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  wellInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wellName: {
    fontSize: 16,
    fontWeight: '600',
  },
  wellActions: {
    flexDirection: 'row',
    gap: 8,
  },
  wellActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  wellActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  measurementsList: {
    padding: 16,
  },
  measurementItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  measurementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  measurementNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  measurementInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  measurementField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  measurementInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  distanceCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  distanceLabel: {
    fontSize: 16,
  },
  distanceInputContainer: {
    width: 100,
  },
  distanceInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginHorizontal: 16,
    marginBottom: '8%',
    paddingVertical: 12,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 8, 
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: '16%',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    gap: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    gap: 4,
  },
  datePickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14, 14, 14, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '90%',
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  wellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  wellButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  wellButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  wellButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
  },
  unitsContent: {
    padding: 16,
  },
  unitOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  unitOptionText: {
    fontSize: 16,
  },
  parameterCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
}); 