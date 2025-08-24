/**
 * Вспомогательные функции для модуля PumpingTestProcessing
 * Содержит утилиты для работы с датами, текстом, измерениями и оптимизации производительности
 */

import { TIME_UNITS } from './constants';

/**
 * Форматирование даты в локализованный формат
 * @param {Date|string} date - Дата для форматирования
 * @returns {string} Отформатированная дата в формате "ДД.ММ.ГГГГ"
 * @example
 * formatDate(new Date()) // "15.12.2024"
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Обрезка текста с добавлением многоточия
 * @param {string} text - Исходный текст
 * @param {number} maxLength - Максимальная длина (по умолчанию 20)
 * @returns {string} Обрезанный текст с многоточием
 * @example
 * truncateText("Очень длинное название проекта", 15) // "Очень длинно..."
 */
export const truncateText = (text, maxLength = 20) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Преобразование значения времени в дни
 * Используется для унификации временных единиц при построении графиков
 * @param {number|string} value - Значение времени
 * @param {string} unit - Единица измерения ('сек', 'мин', 'час')
 * @returns {number} Время в днях
 * @example
 * convertTimeToDays(120, 'мин') // 0.0833 (2 часа = 0.0833 дня)
 */
export const convertTimeToDays = (value, unit) => {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 0;
  
  switch (unit) {
    case 'сек':
    case 's':
      return numValue / 86400; // 86400 секунд в дне
    case 'мин':
    case 'm':
      return numValue / 1440; // 1440 минут в дне
    case 'час':
    case 'h':
      return numValue / 24; // 24 часа в дне
    default:
      return numValue; // предполагаем дни
  }
};

/**
 * Циклическое переключение единиц времени
 * @param {string} currentUnit - Текущая единица измерения
 * @returns {string} Следующая единица измерения в цикле
 * @example
 * toggleTimeUnit('мин') // 'час'
 * toggleTimeUnit('час') // 'сек'
 * toggleTimeUnit('сек') // 'мин'
 */
export const toggleTimeUnit = (currentUnit) => {
  const units = ['сек', 'мин', 'час'];
  const currentIndex = units.indexOf(currentUnit);
  const nextIndex = (currentIndex + 1) % units.length;
  return units[nextIndex];
};

/**
 * Преобразование измерений из формата ввода в формат для графиков
 * Объединяет данные откачки и восстановления для всех скважин
 * @param {Object} measurements - Объект с измерениями по скважинам
 * @param {Array} observationWells - Массив наблюдательных скважин
 * @returns {Array} Массив точек данных для графика
 * @example
 * convertMeasurementsToDataRows(measurements, wells) 
 * // [{t: 0.0833, s: 1.5, wellId: '1', wellName: 'Скв. 1', type: 'pumping'}, ...]
 */
export const convertMeasurementsToDataRows = (measurements, observationWells) => {
  const dataRows = [];
  
  // Обрабатываем каждую скважину
  observationWells.forEach(well => {
    const wellMeasurements = measurements[well.id];
    if (!wellMeasurements) return;
    
    // Обрабатываем данные откачки
    if (wellMeasurements.pumping) {
      wellMeasurements.pumping.forEach(measurement => {
        if (measurement.time && measurement.drawdown) {
          dataRows.push({
            t: convertTimeToDays(measurement.time, measurement.timeUnit || 'мин'),
            s: parseFloat(measurement.drawdown),
            wellId: well.id,
            wellName: well.name,
            type: 'pumping',
            originalTime: measurement.time,
            originalUnit: measurement.timeUnit
          });
        }
      });
    }
    
    // Обрабатываем данные восстановления
    if (wellMeasurements.recovery) {
      wellMeasurements.recovery.forEach(measurement => {
        if (measurement.time && measurement.drawdown) {
          dataRows.push({
            t: convertTimeToDays(measurement.time, measurement.timeUnit || 'мин'),
            s: parseFloat(measurement.drawdown),
            wellId: well.id,
            wellName: well.name,
            type: 'recovery',
            originalTime: measurement.time,
            originalUnit: measurement.timeUnit
          });
        }
      });
    }
  });
  
  // Сортируем по времени для корректного отображения на графике
  return dataRows.sort((a, b) => a.t - b.t);
};

/**
 * Валидация временной последовательности измерений
 * Проверяет, что время измерений идет по возрастанию
 * @param {Array} measurements - Массив измерений
 * @returns {boolean} true если последовательность корректна
 */
export const validateTimeSequence = (measurements) => {
  for (let i = 1; i < measurements.length; i++) {
    const prev = parseFloat(measurements[i - 1].time || '');
    const curr = parseFloat(measurements[i].time || '');
    if (!isNaN(prev) && !isNaN(curr) && prev > curr) {
      return false;
    }
  }
  return true;
};

/**
 * Генерация уникального ID на основе временной метки
 * @returns {string} Уникальный идентификатор
 */
export const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

/**
 * Дебаунс функция для оптимизации производительности
 * Откладывает выполнение функции до прекращения вызовов
 * @param {Function} func - Функция для дебаунсинга
 * @param {number} delay - Задержка в миллисекундах
 * @returns {Function} Дебаунс функция
 * @example
 * const debouncedSave = debounce(saveData, 500);
 * debouncedSave(data); // Выполнится через 500мс после последнего вызова
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Глубокое клонирование объекта
 * Создает полную копию объекта включая вложенные структуры
 * @param {*} obj - Объект для клонирования
 * @returns {*} Клонированный объект
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
};

/**
 * Получение иконки для типа теста
 * @param {string} testType - Тип теста
 * @returns {string} Название иконки из MaterialCommunityIcons
 */
export const getTestTypeIcon = (testType) => {
  switch (testType) {
    case 'Откачка/Восстановление':
    case 'Pumping/Recovery':
      return 'water-pump';
    case 'Экспресс':
    case 'Express':
      return 'water-alert';
    case 'Пакер':
    case 'Packer':
      return 'water-check';
    default:
      return 'water';
  }
};

/**
 * Проверка, является ли скважина опытной (главной)
 * @param {string|number} wellId - ID скважины
 * @returns {boolean} true если это опытная скважина
 */
export const isExperimentalWell = (wellId) => {
  return String(wellId) === '1' || String(wellId) === 'main';
};

/**
 * Форматирование числа с ограничением десятичных знаков
 * @param {number} value - Число для форматирования
 * @param {number} decimals - Количество десятичных знаков
 * @returns {string} Отформатированное число
 */
export const formatNumber = (value, decimals = 2) => {
  if (typeof value !== 'number') return '0';
  return value.toFixed(decimals);
};

/**
 * Безопасное извлечение значения из вложенного объекта
 * @param {Object} obj - Объект
 * @param {string} path - Путь к значению через точку
 * @param {*} defaultValue - Значение по умолчанию
 * @returns {*} Значение или defaultValue
 * @example
 * getNestedValue({a: {b: {c: 1}}}, 'a.b.c', 0) // 1
 * getNestedValue({a: {}}, 'a.b.c', 0) // 0
 */
export const getNestedValue = (obj, path, defaultValue = null) => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }
  
  return result;
};