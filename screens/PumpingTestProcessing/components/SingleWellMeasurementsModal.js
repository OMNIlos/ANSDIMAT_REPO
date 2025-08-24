/**
 * Компонент для ввода измерений одной конкретной скважины
 * Показывает только данные выбранной скважины
 */

import React, { useState, useCallback, useMemo, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  Alert,
  StatusBar,
} from 'react-native';
import {
  useTheme,
  Surface,
  Card,
  IconButton,
  Button,
  Divider,
  Chip,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import I18n from '../../../Localization';
import { LanguageContext } from '../../../LanguageContext';
import { TIME_UNITS } from '../utils/constants';
import { debounce, toggleTimeUnit } from '../utils/helpers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Простой компонент измерения
const MeasurementRow = React.memo(({ 
  measurement, 
  index,
  onUpdate, 
  onDelete, 
  onAdd,
  theme,
  wellName,
  isLast
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCustomDateInput, setShowCustomDateInput] = useState(false);
  
  const handleTimeChange = useCallback((value) => {
    onUpdate(index, 'time', value);
  }, [onUpdate, index]);
  
  const handleDrawdownChange = useCallback((value) => {
    onUpdate(index, 'drawdown', value);
  }, [onUpdate, index]);
  
  const handleTimeUnitToggle = useCallback(() => {
    const newUnit = toggleTimeUnit(measurement.timeUnit);
    onUpdate(index, 'timeUnit', newUnit);
  }, [onUpdate, index, measurement.timeUnit]);
  
  // Кастомный компонент ввода даты/времени для Android
  const CustomDateTimeModal = () => {
    const [dateText, setDateText] = useState('');
    const [timeText, setTimeText] = useState('');
    
    React.useEffect(() => {
      if (measurement.date) {
        setDateText(measurement.date.toLocaleDateString('ru-RU'));
        setTimeText(measurement.date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      }
    }, [measurement.date]);
    
    const handleDateTextChange = (text) => {
      setDateText(text);
      // НЕ вызываем onUpdate автоматически
    };
    
    const handleTimeTextChange = (text) => {
      setTimeText(text);
      // НЕ вызываем onUpdate автоматически
    };
    
    const handleConfirmDateTime = () => {
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
            onUpdate(index, 'date', newDate);
            setShowCustomDateInput(false);
          }
        }
      }
    };

    return (
      <Modal
        visible={showCustomDateInput}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
        statusBarTranslucent={Platform.OS === 'android'}
        onRequestClose={() => {
          setShowCustomDateInput(false);
          // НЕ вызываем navigation - остаемся в текущем модальном окне
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
              setShowCustomDateInput(false);
              // НЕ вызываем navigation - остаемся в модальном окне измерений
            }}>
              <MaterialIcons name="close" size={24} color={theme.colors.onPrimary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.onPrimary }]}>
              Ввод даты и времени
            </Text>
            <TouchableOpacity onPress={handleConfirmDateTime}>
              <MaterialIcons name="check" size={24} color={theme.colors.onPrimary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.customDateInputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
              Дата (дд.мм.гггг):
            </Text>
            <TextInput
              style={[styles.customDateInput, { 
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
              style={[styles.customDateInput, { 
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
            
            <TouchableOpacity
              style={[styles.confirmButton, { 
                backgroundColor: theme.colors.primary,
                marginTop: 30 
              }]}
              onPress={handleConfirmDateTime}
            >
              <MaterialIcons name="check" size={20} color={theme.colors.onPrimary} />
              <Text style={[styles.confirmButtonText, { color: theme.colors.onPrimary }]}>
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
  
  return (
    <View style={[styles.measurementRow, { borderColor: theme.colors.outline }]}>
      {/* Информация о скважине */}
      <View style={styles.measurementHeader}>
        <Text style={[styles.measurementIndex, { color: theme.colors.primary }]}>
          #{index + 1}
        </Text>
        <Text style={[styles.wellNameInRow, { color: theme.colors.onSurface }]}>
          {wellName}
        </Text>
        <View style={styles.measurementActions}>
          {isLast && (
            <IconButton
              icon="plus"
              size={16}
              iconColor={theme.colors.primary}
              onPress={() => onAdd(index)}
            />
          )}
          <IconButton
            icon="delete"
            size={16}
            iconColor={theme.colors.error}
            onPress={() => onDelete(index)}
          />
        </View>
      </View>
      
      {/* Поля ввода */}
      <View style={styles.inputRow}>
        {/* Время */}
        <View style={styles.timeContainer}>
          <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
            {I18n.t("time")}
          </Text>
          <View style={styles.timeInputGroup}>
            <TextInput
              style={[styles.timeInput, { 
                color: theme.colors.onSurface,
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.outline,
              }]}
              value={measurement.time}
              onChangeText={handleTimeChange}
              placeholder="0"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.unitButton, { 
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.outline,
              }]}
              onPress={handleTimeUnitToggle}
            >
              <Text style={[styles.unitText, { color: theme.colors.onPrimaryContainer }]}>
                {measurement.timeUnit}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Понижение */}
        <View style={styles.drawdownContainer}>
          <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
            {I18n.t("drawdown")} (м)
          </Text>
          <TextInput
            style={[styles.drawdownInput, { 
              color: theme.colors.onSurface,
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.outline,
            }]}
            value={measurement.drawdown}
            onChangeText={handleDrawdownChange}
            placeholder="0.00"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            keyboardType="numeric"
          />
        </View>
        
        {/* Дата/время */}
        <View style={styles.dateContainer}>
          <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
            {I18n.t("selectDateTime")}
          </Text>
          <TouchableOpacity
            style={[styles.dateButton, { 
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.outline,
            }]}
            onPress={() => {
              if (Platform.OS === 'android') {
                setShowCustomDateInput(true);
              } else {
                setShowDatePicker(true);
              }
            }}
          >
            <MaterialIcons name="access-time" size={16} color={theme.colors.primary} />
            <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
              {measurement.date ? new Date(measurement.date).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }) : I18n.t("selectDateTime")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Кастомная модальная для Android */}
      {Platform.OS === 'android' && <CustomDateTimeModal />}
      
      {/* DateTimePicker для iOS */}
      {Platform.OS === 'ios' && showDatePicker && (
        <DateTimePicker
          value={measurement.date || new Date()}
          mode="datetime"
          display="spinner"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              onUpdate(index, 'date', selectedDate);
            }
          }}
        />
      )}
    </View>
  );
});

export default function SingleWellMeasurementsModal({
  visible,
  onClose,
  wellId,
  wellName,
  wizardData,
  onUpdateMeasurement,
  onAddMeasurement,
  onDeleteMeasurement,
}) {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  // Выбираем тип измерений в зависимости от настроек проекта
  const [selectedType, setSelectedType] = useState(() => {
    // Если восстановление включено и откачка выключена, выбираем восстановление
    if (wizardData.recoverySelected && !wizardData.pumpingSelected) {
      return 'recovery';
    }
    // По умолчанию выбираем откачку
    return 'pumping';
  });
  
  // Получаем измерения для текущей скважины и типа
  const measurements = useMemo(() => {
    return wizardData.measurements[wellId]?.[selectedType] || [];
  }, [wizardData.measurements, wellId, selectedType]);
  
  // Подсчет измерений для данной скважины
  const wellCounts = useMemo(() => {
    const wellMeasurements = wizardData.measurements[wellId] || {};
    return {
      pumping: wellMeasurements.pumping?.length || 0,
      recovery: wellMeasurements.recovery?.length || 0
    };
  }, [wizardData.measurements, wellId]);
  
  // Обработчики для текущей скважины
  const handleUpdate = useCallback((index, field, value) => {
    onUpdateMeasurement(wellId, selectedType, index, field, value);
  }, [onUpdateMeasurement, wellId, selectedType]);
  
  const handleAdd = useCallback((index) => {
    onAddMeasurement(wellId, selectedType, index);
  }, [onAddMeasurement, wellId, selectedType]);
  
  const handleDelete = useCallback((index) => {
    onDeleteMeasurement(wellId, selectedType, index);
  }, [onDeleteMeasurement, wellId, selectedType]);
  
  const isExperimentalWell = wellId === '1';
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <KeyboardAvoidingView 
        style={[styles.container, { 
          backgroundColor: theme.colors.background,
          ...Platform.select({
            android: {
              paddingTop: 0,
              height: '100%',
              width: '100%',
            },
            ios: {}
          })
        }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {Platform.OS === 'android' && <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />}
        {/* Заголовок */}
        <Surface style={[styles.header, { 
          backgroundColor: theme.colors.primary,
          ...Platform.select({
            android: {
              paddingTop: StatusBar.currentHeight,
              elevation: 4,
            },
            ios: {
              paddingTop: 50,
            }
          })
        }]} elevation={4}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={theme.colors.onPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.colors.onPrimary }]}>
                {I18n.t("measurements")}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.onPrimary }]}>
                {isExperimentalWell ? I18n.t("experimentalWell") : I18n.t("observationWells")}: {wellName}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Chip style={{ backgroundColor: theme.colors.primaryContainer }}>
                <Text style={{ color: theme.colors.onPrimaryContainer }}>
                  {wellCounts.pumping + wellCounts.recovery}
                </Text>
              </Chip>
            </View>
          </View>
        </Surface>
        
        {/* Выбор типа измерений */}
        <Surface style={[styles.typeSelector, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.typeSelectorContent}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                selectedType === 'pumping' && { backgroundColor: theme.colors.primary },
                { borderColor: theme.colors.outline },
                !wizardData.pumpingSelected && { opacity: 0.5 }
              ]}
              onPress={() => wizardData.pumpingSelected ? setSelectedType('pumping') : null}
              disabled={!wizardData.pumpingSelected}
            >
              <MaterialCommunityIcons 
                name="water-pump" 
                size={20} 
                color={selectedType === 'pumping' && wizardData.pumpingSelected ? theme.colors.onPrimary : theme.colors.onSurface} 
              />
              <Text style={[
                styles.typeButtonText,
                { color: selectedType === 'pumping' && wizardData.pumpingSelected ? theme.colors.onPrimary : theme.colors.onSurface }
              ]}>
                {I18n.t("pumping")} ({wellCounts.pumping})
                {!wizardData.pumpingSelected && " (отключено)"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.typeButton,
                selectedType === 'recovery' && { backgroundColor: theme.colors.primary },
                { borderColor: theme.colors.outline },
                !wizardData.recoverySelected && { opacity: 0.5 }
              ]}
              onPress={() => wizardData.recoverySelected ? setSelectedType('recovery') : null}
              disabled={!wizardData.recoverySelected}
            >
              <MaterialCommunityIcons 
                name="water-off" 
                size={20} 
                color={selectedType === 'recovery' && wizardData.recoverySelected ? theme.colors.onPrimary : theme.colors.onSurface} 
              />
              <Text style={[
                styles.typeButtonText,
                { color: selectedType === 'recovery' && wizardData.recoverySelected ? theme.colors.onPrimary : theme.colors.onSurface }
              ]}>
                {I18n.t("recovery")} ({wellCounts.recovery})
                {!wizardData.recoverySelected && " (отключено)"}
              </Text>
            </TouchableOpacity>
          </View>
        </Surface>
        
        {/* Контент с измерениями */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={[styles.wellSection, { 
            backgroundColor: isExperimentalWell ? theme.colors.primaryContainer : theme.colors.surface,
            borderColor: isExperimentalWell ? theme.colors.primary : theme.colors.outline
          }]}>
            <Card.Content>
              <View style={styles.wellHeader}>
                <Text style={[styles.wellTitle, { 
                  color: isExperimentalWell ? theme.colors.onPrimaryContainer : theme.colors.onSurface 
                }]}>
                  {isExperimentalWell ? 'Опытная скважина' : 'Наблюдательная скважина'}: {wellName}
                </Text>
                <Chip style={{ backgroundColor: theme.colors.secondaryContainer }}>
                  <Text style={{ color: theme.colors.onSecondaryContainer }}>
                    {measurements.length} {I18n.t("measurements")}
                  </Text>
                </Chip>
              </View>
              
              <Divider style={{ marginVertical: 12 }} />
              
              {measurements.length === 0 ? (
                <View style={styles.emptySection}>
                  <MaterialCommunityIcons name="water-off" size={32} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    {I18n.t("noData")}
                  </Text>
                  <Button
                    mode="contained-tonal"
                    icon="plus"
                    onPress={() => handleAdd(0)}
                    style={styles.firstAddButton}
                  >
                    {I18n.t("addMeasurement")}
                  </Button>
                </View>
              ) : (
                measurements.map((measurement, index) => (
                  <React.Fragment key={`${wellId}-${selectedType}-${index}`}>
                    {/* Добавляем кнопку вставки до текущего измерения (кроме первого) */}
                    {index > 0 && (
                      <TouchableOpacity
                        style={[styles.insertButton, {backgroundColor: theme.colors.primaryContainer}]}
                        onPress={() => handleAdd(index - 1)}
                      >
                        <MaterialIcons name="add" size={18} color={theme.colors.primary} />
                        <Text style={{fontSize: 12, color: theme.colors.primary}}>Вставить до</Text>
                      </TouchableOpacity>
                    )}
                    
                    <MeasurementRow
                      measurement={measurement}
                      index={index}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onAdd={handleAdd}
                      theme={theme}
                      wellName={`${wellName} - ${I18n.t("measurement")} ${index + 1}`}
                      isLast={index === measurements.length - 1}
                    />
                  </React.Fragment>
                ))
              )}
            </Card.Content>
          </Card>
          
          {/* Информационная панель */}
          <Surface style={[styles.infoPanel, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
            <MaterialIcons name="info" size={20} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
              Введите измерения для выбранного типа обработки. Время должно быть в хронологическом порядке.
            </Text>
          </Surface>
          
          {/* Отступ снизу */}
          <View style={{ height: Platform.OS === 'android' ? 120 : 80 }} />
        </ScrollView>
        
        {/* Заполнитель для покрытия всей нижней области */}
        <View style={{ 
          backgroundColor: theme.colors.background,
          minHeight: Platform.OS === 'android' ? 50 : 20
        }} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
    paddingBottom: 0,
  },
  insertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 8,
    gap: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  headerRight: {
    marginLeft: 16,
  },
  typeSelector: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typeSelectorContent: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  wellSection: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 2,
  },
  wellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wellTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  firstAddButton: {
    borderRadius: 8,
  },
  measurementRow: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  measurementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  measurementIndex: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  wellNameInRow: {
    fontSize: 12,
    flex: 1,
  },
  measurementActions: {
    flexDirection: 'row',
  },
  inputRow: {
    flexDirection: SCREEN_WIDTH < 400 ? 'column' : 'row',
    gap: SCREEN_WIDTH < 400 ? 12 : 8,
  },
  timeContainer: {
    flex: SCREEN_WIDTH < 400 ? 1 : 2,
    minWidth: SCREEN_WIDTH < 400 ? '100%' : 'auto',
  },
  drawdownContainer: {
    flex: SCREEN_WIDTH < 400 ? 1 : 2,
    minWidth: SCREEN_WIDTH < 400 ? '100%' : 'auto',
  },
  dateContainer: {
    flex: SCREEN_WIDTH < 400 ? 1 : 3,
    minWidth: SCREEN_WIDTH < 400 ? '100%' : 'auto',
  },
  inputLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  timeInputGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: SCREEN_WIDTH < 400 ? 12 : 8,
    paddingVertical: SCREEN_WIDTH < 400 ? 10 : 6,
    fontSize: SCREEN_WIDTH < 400 ? 16 : 14,
    textAlign: 'center',
    minHeight: SCREEN_WIDTH < 400 ? 44 : 'auto',
  },
  unitButton: {
    paddingHorizontal: SCREEN_WIDTH < 400 ? 12 : 8,
    paddingVertical: SCREEN_WIDTH < 400 ? 10 : 6,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: SCREEN_WIDTH < 400 ? 50 : 40,
    minHeight: SCREEN_WIDTH < 400 ? 44 : 'auto',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
  },
  drawdownInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: SCREEN_WIDTH < 400 ? 12 : 8,
    paddingVertical: SCREEN_WIDTH < 400 ? 10 : 6,
    fontSize: SCREEN_WIDTH < 400 ? 16 : 14,
    textAlign: 'center',
    minHeight: SCREEN_WIDTH < 400 ? 44 : 'auto',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH < 400 ? 12 : 8,
    paddingVertical: SCREEN_WIDTH < 400 ? 10 : 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    minHeight: SCREEN_WIDTH < 400 ? 44 : 'auto',
  },
  dateText: {
    fontSize: 11,
    flex: 1,
  },
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  customDateInputContainer: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minHeight: '100%',
  },
  customDateInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
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
