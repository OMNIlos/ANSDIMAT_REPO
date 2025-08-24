import React, { useState, useContext, useEffect, useCallback, useMemo } from 'react';
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
  KeyboardAvoidingView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useTheme, Card, Surface, Button, Chip } from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import I18n from '../../Localization';
import { LanguageContext } from '../../LanguageContext';

// Импорт компонентов и утилит
import UnifiedMeasurementsModal from './components/UnifiedMeasurementsModal';
import SingleWellMeasurementsModal from './components/SingleWellMeasurementsModal';
import { 
  WIZARD_STEPS, 
  FLOW_RATE_UNITS,
  AQUIFER_TYPES,
  OFR_TYPES 
} from './utils/constants';
import {
  convertMeasurementsToDataRows,
  generateId,
  debounce,
  validateTimeSequence,
} from './utils/helpers';

const STEP_TITLES = {
  [WIZARD_STEPS.BASIC_PARAMETERS]: I18n.t('basicParameters'),
  [WIZARD_STEPS.PROCESSING_SETUP]: 'Данные понижений',
  [WIZARD_STEPS.OBSERVATION_JOURNAL]: 'Обзор проекта',
};

export default function NewWizard({ navigation, route }) {
  const { locale } = useContext(LanguageContext);
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.BASIC_PARAMETERS);
  const [activeProject, setActiveProject] = useState(null);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showUnifiedMeasurements, setShowUnifiedMeasurements] = useState(false);
  const [showSingleWellMeasurements, setShowSingleWellMeasurements] = useState(false);
  const [selectedWellForMeasurements, setSelectedWellForMeasurements] = useState(null);
  
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
  const [showDateTimeModal, setShowDateTimeModal] = useState(false);
  const [currentEditingDateTime, setCurrentEditingDateTime] = useState(null);
  const [showFlowRateUnits, setShowFlowRateUnits] = useState(false);
  
  // Оптимизированные обновления с debounce
  const debouncedSaveWizardData = useCallback(
    debounce(async (data) => {
      try {
        await AsyncStorage.setItem('wizard_temp_data', JSON.stringify(data));
      } catch (error) {
        console.error('Error saving wizard data:', error);
      }
    }, 1000),
    []
  );

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

  const updateData = useCallback((key, value) => {
    setWizardData(prev => {
      const newData = { ...prev, [key]: value };
      debouncedSaveWizardData(newData);
      return newData;
    });
  }, [debouncedSaveWizardData]);

  const validateStep = useCallback((step) => {
    const newErrors = {};
    
    switch (step) {
      case WIZARD_STEPS.BASIC_PARAMETERS:
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
      case WIZARD_STEPS.PROCESSING_SETUP:
        if (!wizardData.pumpingSelected && !wizardData.recoverySelected) {
          newErrors.processingTypes = 'Выберите хотя бы один тип обработки';
        }
        if (wizardData.pumpingSelected && !wizardData.pumpingStartDate) {
          newErrors.pumpingStartDate = 'Укажите дату начала откачки';
        }
        if (wizardData.recoverySelected && !wizardData.recoveryStartDate) {
          newErrors.recoveryStartDate = 'Укажите дату начала восстановления';
        }
        // Наблюдательные скважины теперь опциональны
        // Проверяем расстояния для существующих наблюдательных скважин
        wizardData.observationWells.filter(w => String(w.id) !== '1').forEach(well => {
          const distance = wizardData.distances[well.id];
          if (!distance || distance.trim() === '') {
            newErrors[`distance_${well.id}`] = 'Введите расстояние';
          } else if (isNaN(parseFloat(distance))) {
            newErrors[`distance_${well.id}`] = 'Введите числовое значение';
          }
        });
        break;
        
      case WIZARD_STEPS.OBSERVATION_JOURNAL:
        // Валидация порядков времени в измерениях
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
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [wizardData]);

  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      if (currentStep < WIZARD_STEPS.OBSERVATION_JOURNAL) {
        setCurrentStep(currentStep + 1);
      }
    }
  }, [currentStep, validateStep]);

  const prevStep = useCallback(() => {
    if (currentStep > WIZARD_STEPS.BASIC_PARAMETERS) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const addObservationWell = useCallback(() => {
    const newWell = {
      id: generateId(),
      name: `Скв. ${String.fromCharCode(65 + wizardData.observationWells.length)}`,
      active: true
    };
    
    setWizardData(prev => ({
      ...prev,
      observationWells: [...prev.observationWells, newWell],
      measurements: {
        ...prev.measurements,
        [newWell.id]: {
          pumping: [{ id: generateId(), time: '', timeUnit: 'мин', drawdown: '', date: new Date() }],
          recovery: [{ id: generateId(), time: '', timeUnit: 'мин', drawdown: '', date: new Date() }]
        }
      },
      distances: {
        ...prev.distances,
        [newWell.id]: ''
      }
    }));
  }, [wizardData.observationWells.length]);

  const addMeasurement = useCallback((wellId, type, insertAfterIndex = null) => {
    const newMeasurement = {
      id: generateId(),
      time: '',
      timeUnit: 'мин',
      drawdown: '',
      date: new Date()
    };
    
    setWizardData(prev => {
      const list = prev.measurements[wellId]?.[type] || [];
      let newList;
      if (insertAfterIndex !== null && insertAfterIndex >= 0) {
        newList = [...list.slice(0, insertAfterIndex + 1), newMeasurement, ...list.slice(insertAfterIndex + 1)];
      } else {
        newList = [...list, newMeasurement];
      }
      
      return {
        ...prev,
        measurements: {
          ...prev.measurements,
          [wellId]: {
            ...prev.measurements[wellId],
            [type]: newList
          }
        }
      };
    });
  }, []);

  const deleteMeasurement = useCallback((wellId, type, measurementIndex) => {
    setWizardData(prev => {
      const list = prev.measurements[wellId]?.[type] || [];
      const newList = list.filter((_, index) => index !== measurementIndex);
      
      return {
        ...prev,
        measurements: {
          ...prev.measurements,
          [wellId]: {
            ...prev.measurements[wellId],
            [type]: newList
          }
        }
      };
    });
  }, []);

  const updateMeasurement = useCallback((wellId, type, measurementIndex, field, value) => {
    setWizardData(prev => {
      const list = prev.measurements[wellId]?.[type] || [];
      const newList = list.map((measurement, index) =>
        index === measurementIndex ? { ...measurement, [field]: value } : measurement
      );
      
      return {
        ...prev,
        measurements: {
          ...prev.measurements,
          [wellId]: {
            ...prev.measurements[wellId],
            [type]: newList
          }
        }
      };
    });
  }, []);

  // Функция для открытия модального окна измерений одной скважины
  const openSingleWellMeasurements = useCallback((wellId, wellName) => {
    setSelectedWellForMeasurements({ id: wellId, name: wellName });
    setShowSingleWellMeasurements(true);
  }, []);

  const closeSingleWellMeasurements = useCallback(() => {
    setShowSingleWellMeasurements(false);
    setSelectedWellForMeasurements(null);
  }, []);




  // Шаг 1: Основные параметры
  const renderBasicParameters = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardContent}>
          <View style={{flexDirection: 'row', alignItems: 'start', gap: 4}}>
            <MaterialIcons name="settings" size={20} color={theme.colors.primary} /> 
            <Text style={[styles.cardTitle, { color: theme.colors.primary }]}> 
              Основные параметры
            </Text>
          </View>

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
          </View>
          
          {/* Тип водоносного горизонта */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {I18n.t("layerType")} *
            </Text>
            <View style={{ flexDirection: 'column', alignItems: 'flex-start',}}>
              <View style={[styles.radioGroup, { flexDirection: 'column', gap: 8}]}>
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
            </View>
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

  // Шаг 2: Выбор типов обработки
  const renderProcessingSetup = () => {
    const pumpingDurationHours = wizardData.pumpingSelected && wizardData.recoverySelected
      ? Math.max(0, (wizardData.recoveryStartDate - wizardData.pumpingStartDate) / 3600000).toFixed(2)
      : null;
    return (
      <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
        <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface }]}> 
          <View style={styles.cardContent}>
            <View style={{flexDirection: 'row', alignItems: 'start', gap: 4, justifyContent: 'start'}}>
              <MaterialIcons name="tune" size={20} color={theme.colors.primary} /> 
              <Text style={[styles.cardTitle, { color: theme.colors.primary }]}> 
                Тип обработки и даты
              </Text>
            </View>

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
                  if (Platform.OS === 'android') {
                    setCurrentEditingDateTime('pumping');
                    setShowDateTimeModal(true);
                  } else {
                    setDatePickerType('pumping');
                    setShowDatePicker(true);
                  }
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
                  if (Platform.OS === 'android') {
                    setCurrentEditingDateTime('recovery');
                    setShowDateTimeModal(true);
                  } else {
                    setDatePickerType('recovery');
                    setShowDatePicker(true);
                  }
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
            <View style={{flexDirection: 'row', alignItems: 'start', gap: 4}}>
              <MaterialCommunityIcons name="water-well" size={20} color={theme.colors.primary} /> 
              <Text style={[styles.cardTitle, { color: theme.colors.primary }]}> 
                Опытная скважина
              </Text>
          </View>
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
                <Button
                  mode="contained"
                  icon="water"
                  onPress={() => openSingleWellMeasurements('1', wizardData.wellName)}
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  {I18n.t('measurements')} ({
                    (wizardData.measurements['1']?.pumping?.length || 0) + 
                    (wizardData.measurements['1']?.recovery?.length || 0)
                  })
                </Button>
              </View>
            </Surface>
          </View>
        </Card>

        {/* Наблюдательные скважины */}
        <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface, marginBottom: '40%'}]}>
          <View style={styles.cardContent}>
            <View style={{...styles.sectionHeader, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'start'}}>
              <View style={{flexDirection: 'row', alignItems: 'start', gap: 4}}>
              <MaterialCommunityIcons name="map-marker-multiple" size={20} color={theme.colors.primary} /> 
              <Text style={[styles.cardTitle, { color: theme.colors.primary}]}>
                Наблюдательные{'\n'}скважины
              </Text>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'start', gap: 5, justifyContent: 'flex-start'}}>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                  onPress={addObservationWell}
                >
                  <MaterialIcons name="add" size={20} color={theme.colors.white} />
                </TouchableOpacity>
                
              </View>

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
                  
                </View>
                
                {/* Поле ввода расстояния */}
                <View style={styles.distanceInputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                    Расстояние до опытной скважины (км):
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        borderColor: errors[`distance_${well.id}`] ? theme.colors.error : theme.colors.border,
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                      }
                    ]}
                    value={wizardData.distances[well.id] || ''}
                    onChangeText={(value) => updateData('distances', {
                      ...wizardData.distances,
                      [well.id]: value
                    })}
                    placeholder="0.074"
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="numeric"
                  />
                  {errors[`distance_${well.id}`] && (
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>
                      {errors[`distance_${well.id}`]}
                    </Text>
                  )}
                </View>

                <View style={{...styles.wellButtons, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Button
                    mode="contained"
                    icon="water"
                    onPress={() => openSingleWellMeasurements(well.id, well.name)}
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    {I18n.t('measurements')} ({
                      (wizardData.measurements[well.id]?.pumping?.length || 0) + 
                      (wizardData.measurements[well.id]?.recovery?.length || 0)
                    })
                  </Button>
                  <TouchableOpacity
                    onPress={() => {
                      const newWells = wizardData.observationWells.filter(w => w.id !== well.id);
                      const { [well.id]: removed, ...restDistances } = wizardData.distances;
                      const { [well.id]: removedM, ...restMeas } = wizardData.measurements;
                      setWizardData(prev => ({ ...prev, observationWells: newWells, distances: restDistances, measurements: restMeas }));
                    }}
                  >
                    <MaterialIcons name="delete" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </Surface>
            ))}
            
            {wizardData.observationWells.filter(w => String(w.id) !== '1').length === 0 && (
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
  };

  // Шаг 3: Обзор и подтверждение данных
  const renderObservationJournal = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      {/* Обзор данных */}
      <Card style={[styles.parameterCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>
            <MaterialIcons name="preview" size={20} color={theme.colors.primary} /> 
            Обзор проекта
          </Text>
          
          {/* Общая информация */}
          <View style={styles.reviewSection}>
            <Text style={[styles.reviewSectionTitle, { color: theme.colors.onSurface }]}>
              Основные параметры
            </Text>
            <Text style={[styles.reviewItem, { color: theme.colors.onSurfaceVariant }]}>
              Проект: {wizardData.projectName || 'Новый проект'}
            </Text>
            <Text style={[styles.reviewItem, { color: theme.colors.onSurfaceVariant }]}>
              Опытная скважина: {wizardData.wellName || 'Не указана'}
            </Text>
            <Text style={[styles.reviewItem, { color: theme.colors.onSurfaceVariant }]}>
              Расход: {wizardData.flowRate} {wizardData.flowRateUnit}
            </Text>
            <Text style={[styles.reviewItem, { color: theme.colors.onSurfaceVariant }]}>
              Тип водоноса: {wizardData.layerType}
            </Text>
          </View>

          {/* Скважины */}
          <View style={styles.reviewSection}>
            <Text style={[styles.reviewSectionTitle, { color: theme.colors.onSurface }]}>
              Скважины и измерения
            </Text>
            
            {/* Опытная скважина */}
            <View style={styles.reviewWell}>
              <Text style={[styles.reviewWellName, { color: theme.colors.primary }]}>
                {wizardData.wellName} (опытная)
              </Text>
              <Text style={[styles.reviewItem, { color: theme.colors.onSurfaceVariant }]}>
                Измерений: {
                  (wizardData.measurements['1']?.pumping?.length || 0) + 
                  (wizardData.measurements['1']?.recovery?.length || 0)
                } (откачка: {wizardData.measurements['1']?.pumping?.length || 0}, 
                восстановление: {wizardData.measurements['1']?.recovery?.length || 0})
              </Text>
            </View>

            {/* Наблюдательные скважины */}
            {wizardData.observationWells.filter(w => String(w.id) !== '1').map((well) => (
              <View key={well.id} style={styles.reviewWell}>
                <Text style={[styles.reviewWellName, { color: theme.colors.secondary }]}>
                  {well.name} (наблюдательная)
                </Text>
                <Text style={[styles.reviewItem, { color: theme.colors.onSurfaceVariant }]}>
                  Измерений: {
                    (wizardData.measurements[well.id]?.pumping?.length || 0) + 
                    (wizardData.measurements[well.id]?.recovery?.length || 0)
                  } (откачка: {wizardData.measurements[well.id]?.pumping?.length || 0}, 
                  восстановление: {wizardData.measurements[well.id]?.recovery?.length || 0})
                </Text>
                <Text style={[styles.reviewItem, { color: theme.colors.onSurfaceVariant }]}>
                  Расстояние: {wizardData.distances[well.id] || 'Не указано'} км
                </Text>
              </View>
            ))}
          </View>


        </View>
      </Card>

      {/* Информационная панель */}
      <View style={[styles.infoCardContainer, { marginTop: 10, marginBottom: '40%'}]}>
        <Card.Content>
          <View style={styles.infoHeader}>
            <MaterialIcons name="info" size={24} color={theme.colors.primary} />
            <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>{I18n.t("information")}</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            Проверьте все введенные данные перед созданием проекта. 
            Вы сможете редактировать проект после создания.
            {'\n\n'}
            На следующем шаге укажите расстояния между скважинами.
          </Text>
        </Card.Content>
      </View>
    </ScrollView>
  );



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
      case WIZARD_STEPS.BASIC_PARAMETERS:
        return renderBasicParameters();
      case WIZARD_STEPS.PROCESSING_SETUP:
        return renderProcessingSetup();
      case WIZARD_STEPS.OBSERVATION_JOURNAL:
        return renderObservationJournal();
      default:
        return renderBasicParameters();
    }
  };

  const handleBack = useCallback(() => {
    // Если открыты модальные окна, НЕ обрабатываем навигацию назад
    if (showDateTimeModal || showFlowRateUnits || showUnifiedMeasurements || showSingleWellMeasurements) {
      return;
    }
    
    if (currentStep > WIZARD_STEPS.BASIC_PARAMETERS) {
      prevStep();
    } else {
      navigation.goBack();
    }
  }, [currentStep, prevStep, navigation, showDateTimeModal, showFlowRateUnits, showUnifiedMeasurements, showSingleWellMeasurements]);

  const handleNext = useCallback(async () => {
    if (currentStep < WIZARD_STEPS.OBSERVATION_JOURNAL) {
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
  }, [currentStep, nextStep, validateStep, route, wizardData, navigation]);

  const getBackButtonText = useCallback(() => {
    if (currentStep === WIZARD_STEPS.BASIC_PARAMETERS) {
      return I18n.t('back');
    }
    return I18n.t('previous');
  }, [currentStep]);

  const getNextButtonText = useCallback(() => {
    const isEditing = route?.params?.isEditing || false;
    if (currentStep === WIZARD_STEPS.OBSERVATION_JOURNAL) {
      return isEditing ? I18n.t('saveChanges') : I18n.t('createJournal');
    }
    return I18n.t('next');
  }, [currentStep, route]);

  // Кастомный компонент ввода даты/времени для Android
  const CustomDateTimeInput = ({ type, date, onDateChange }) => {
    const [dateText, setDateText] = useState('');
    const [timeText, setTimeText] = useState('');
    
    useEffect(() => {
      if (date) {
        setDateText(date.toLocaleDateString('ru-RU'));
        setTimeText(date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      }
    }, [date]);
    
    const handleDateTextChange = (text) => {
      setDateText(text);
      // НЕ вызываем onDateChange автоматически - пользователь должен сам подтвердить
    };
    
    const handleTimeTextChange = (text) => {
      setTimeText(text);
      // НЕ вызываем onDateChange автоматически - пользователь должен сам подтвердить
    };
    
    const handleConfirmDateTime = () => {
      // Валидация и сохранение только при нажатии кнопки подтверждения
      const datePattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
      const timePattern = /^(\d{1,2}):(\d{1,2})$/;
      
      const dateMatch = dateText.match(datePattern);
      const timeMatch = timeText.match(timePattern);
      
      if (dateMatch && timeMatch) {
        const [, day, month, year] = dateMatch;
        const [, hours, minutes] = timeMatch;
        
        const dayNum = parseInt(day);
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        const hoursNum = parseInt(hours);
        const minutesNum = parseInt(minutes);
        
        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && 
            yearNum >= 1900 && yearNum <= 2100 && hoursNum >= 0 && hoursNum <= 23 && 
            minutesNum >= 0 && minutesNum <= 59) {
          
          const newDate = new Date();
          newDate.setDate(dayNum);
          newDate.setMonth(monthNum - 1);
          newDate.setFullYear(yearNum);
          newDate.setHours(hoursNum);
          newDate.setMinutes(minutesNum);
          newDate.setSeconds(0);
          
          if (!isNaN(newDate.getTime())) {
            onDateChange(newDate);
            setShowDateTimeModal(false);
            setCurrentEditingDateTime(null);
          }
        }
      }
    };

    return (
      <Modal
        visible={showDateTimeModal && currentEditingDateTime === type}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => {
          setShowDateTimeModal(false);
          setCurrentEditingDateTime(null);
          // НЕ вызываем navigation - остаемся в визарде
        }}
      >
        <View style={[styles.modalContainer, { 
          backgroundColor: theme.colors.background,
          ...Platform.select({
            android: {
              paddingTop: 0,
              height: '100%',
              width: '100%',
            },
            ios: {}
          })
        }]}>
          {Platform.OS === 'android' && <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />}
          <View style={[styles.modalHeader, { 
            backgroundColor: theme.colors.primary,
            ...Platform.select({
              android: {
                paddingTop: StatusBar.currentHeight + 10,
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
              },
              ios: {
                paddingTop: 50,
              }
            })
          }]}>
            <TouchableOpacity onPress={() => {
              setShowDateTimeModal(false);
              setCurrentEditingDateTime(null);
              // НЕ вызываем navigation - остаемся в визарде
            }}>
              <MaterialIcons name="close" size={24} color={theme.colors.white} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
              Ввод даты и времени
            </Text>
            <TouchableOpacity onPress={handleConfirmDateTime}>
              <MaterialIcons name="check" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.dateTimeInputContainer, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
              Дата (дд.мм.гггг):
            </Text>
            <TextInput
              style={[styles.textInput, { 
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface 
              }]}
              value={dateText}
              onChangeText={handleDateTextChange}

              placeholder="01.01.2024"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              keyboardType="numeric"
              returnKeyType="next"
            />
            
            <Text style={[styles.inputLabel, { color: theme.colors.onSurface, marginTop: 20 }]}>
              Время (чч:мм):
            </Text>
            <TextInput
              style={[styles.textInput, { 
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface,
                color: theme.colors.onSurface 
              }]}
              value={timeText}
              onChangeText={handleTimeTextChange}

              placeholder="12:00"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              keyboardType="numeric"
              returnKeyType="done"
            />
            
            <View style={styles.helpTextContainer}>
              <Text style={[styles.helpText, { color: theme.colors.onSurfaceVariant }]}>
                Формат даты: ДД.ММ.ГГГГ (например: 15.03.2024)
              </Text>
              <Text style={[styles.helpText, { color: theme.colors.onSurfaceVariant }]}>
                Формат времени: ЧЧ:ММ (например: 14:30)
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.confirmButton, { 
                backgroundColor: theme.colors.primary,
                marginTop: 30 
              }]}
              onPress={handleConfirmDateTime}
            >
              <MaterialIcons name="check" size={20} color={theme.colors.white} />
              <Text style={[styles.confirmButtonText, { color: theme.colors.white }]}>
                Подтвердить
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Заполнитель для покрытия всей нижней области */}
          <View style={{ 
            flex: 1, 
            backgroundColor: theme.colors.background,
            minHeight: Platform.OS === 'android' ? 150 : 100
          }} />
        </View>
      </Modal>
    );
  };

  const getCurrentTitle = () => {
    return STEP_TITLES[currentStep];
  };

  // Модальное окно для выбора единиц расхода
  const renderFlowRateUnitsModal = () => (
    <Modal
      visible={showFlowRateUnits}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        setShowFlowRateUnits(false);
        // НЕ вызываем navigation - остаемся в визарде
      }}
      transparent={false}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={[styles.modalContainer, { 
        backgroundColor: theme.colors.background,
        ...Platform.select({
          android: {
            paddingTop: 0,
            height: '100%',
            width: '100%',
          },
          ios: {}
        })
      }]}>
        {Platform.OS === 'android' && <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />}
        <View style={[styles.modalHeader, { 
          backgroundColor: theme.colors.primary,
          ...Platform.select({
            android: {
              paddingTop: StatusBar.currentHeight + 10,
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
            },
            ios: {
              paddingTop: 50,
            }
          })
        }]}>
          <TouchableOpacity onPress={() => {
            setShowFlowRateUnits(false);
            // НЕ вызываем navigation - остаемся в визарде
          }}>
            <MaterialIcons name="close" size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
            {I18n.t('flowRateUnits')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.unitsContent}>
          {FLOW_RATE_UNITS.map((unit) => (
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
        
        {/* Заполнитель для покрытия всей нижней области */}
        <View style={{ 
          backgroundColor: theme.colors.background,
          minHeight: Platform.OS === 'android' ? 100 : 50
        }} />
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
      </Surface>

      {/* Content */}
      <View style={{height: '100%'}}>
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

      {/* Единое модальное окно измерений */}
      <UnifiedMeasurementsModal
        visible={showUnifiedMeasurements}
        onClose={() => setShowUnifiedMeasurements(false)}
        wizardData={wizardData}
        onUpdateMeasurement={updateMeasurement}
        onAddMeasurement={addMeasurement}
        onDeleteMeasurement={deleteMeasurement}
      />

      {/* Модальное окно измерений одной скважины */}
      {selectedWellForMeasurements && (
        <SingleWellMeasurementsModal
          visible={showSingleWellMeasurements}
          onClose={closeSingleWellMeasurements}
          wellId={selectedWellForMeasurements.id}
          wellName={selectedWellForMeasurements.name}
          wizardData={wizardData}
          onUpdateMeasurement={updateMeasurement}
          onAddMeasurement={addMeasurement}
          onDeleteMeasurement={deleteMeasurement}
        />
      )}

      {/* Кастомные компоненты ввода даты/времени для Android */}
      {Platform.OS === 'android' && (
        <>
          <CustomDateTimeInput
            type="pumping"
            date={wizardData.pumpingStartDate}
            onDateChange={(date) => updateData('pumpingStartDate', date)}
          />
          <CustomDateTimeInput
            type="recovery"
            date={wizardData.recoveryStartDate}
            onDateChange={(date) => updateData('recoveryStartDate', date)}
          />
        </>
      )}

      {/* DateTimePicker только для iOS */}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal 
          visible={showDatePicker} 
          animationType="slide" 
          presentationStyle="fullScreen" 
          transparent={false}
          statusBarTranslucent={false}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.modalHeader, { 
              backgroundColor: theme.colors.primary,
              paddingTop: 50
            }]}>
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
                  try {
                    if (selectedDate && selectedDate instanceof Date && !isNaN(selectedDate.getTime())) {
                      updateData(datePickerType === 'pumping' ? 'pumpingStartDate' : 'recoveryStartDate', selectedDate);
                    }
                  } catch (error) {
                    console.error('DateTimePicker iOS modal error:', error);
                  }
                }}
              />
            </View>
            
            {/* Заполнитель для покрытия всей нижней области */}
            <View style={{ 
              backgroundColor: theme.colors.background,
              flex: 1,
              minHeight: 100
            }} />
          </View>
        </Modal>
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
    marginHorizontal: 2,
    marginBottom: '30%',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
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
    flexDirection: 'column',
    gap: 20,
    width: '100%',
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
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  reviewSection: {
    marginBottom: 16,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  reviewItem: {
    fontSize: 14,
    marginBottom: 4,
    paddingLeft: 8,
  },
  reviewWell: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  reviewWellName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  distanceInputGroup: {
    marginTop: 12,
    marginBottom: 12,
  },
  dateTimeInputContainer: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  helpTextContainer: {
    marginTop: 30,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  helpText: {
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 