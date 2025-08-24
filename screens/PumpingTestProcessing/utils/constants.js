/**
 * Константы для модуля обработки откачек
 */

// Шаги мастера создания проекта
export const WIZARD_STEPS = {
  BASIC_PARAMETERS: 0,
  PROCESSING_SETUP: 1,
  OBSERVATION_JOURNAL: 2,
  DISTANCES: 3,
};

// Типы водоносных горизонтов
export const AQUIFER_TYPES = {
  CONFINED: 'напорный',
  UNCONFINED: 'безнапорный',
  WITH_INTERFLOW: 'с перетеканием',
};

// Типы ОФР (опытно-фильтрационных работ)
export const OFR_TYPES = {
  PUMPING_RECOVERY: 'Откачка/Восстановление',
  EXPRESS: 'Экспресс',
  PACKER: 'Пакер',
};

// Единицы измерения расхода
export const FLOW_RATE_UNITS = [
  'м³/сут',
  'м³/час',
  'м³/мин',
  'л/сек',
  'л/мин',
  'л/час',
];

// Единицы времени
export const TIME_UNITS = {
  SECONDS: 'сек',
  MINUTES: 'мин',
  HOURS: 'час',
  ALL: ['сек', 'мин', 'час'],
};

// Функции для графиков
export const CHART_FUNCTIONS = {
  's-t': {
    name: 's-t',
    xLabel: 't',
    yLabel: 's',
    xTransform: x => x,
    yTransform: y => y,
    type: 's-t',
  },
  's-lg(t)': {
    name: 's-lg(t)',
    xLabel: 'lg(t)',
    yLabel: 's',
    xTransform: x => Math.log10(x),
    yTransform: y => y,
    type: 's-t',
  },
  's-sqrt(t)': {
    name: 's-√t',
    xLabel: '√t',
    yLabel: 's',
    xTransform: x => Math.sqrt(x),
    yTransform: y => y,
    type: 's-t',
  },
  'lg(s)-lg(t)': {
    name: 'lg(s)-lg(t)',
    xLabel: 'lg(t)',
    yLabel: 'lg(s)',
    xTransform: x => Math.log10(x),
    yTransform: y => Math.log10(y),
    type: 's-t',
  },
  's-1/t': {
    name: 's-1/t',
    xLabel: '1/t',
    yLabel: 's',
    xTransform: x => 1 / x,
    yTransform: y => y,
    type: 's-t',
  },
  's-t^n': {
    name: 's-tⁿ',
    xLabel: 'tⁿ',
    yLabel: 's',
    xTransform: (x, n = 2) => Math.pow(x, n),
    yTransform: y => y,
    type: 's-t',
  },
  // Добавлены популярные функции для гидрогеологических расчетов
  's/t-1/t': {
    name: 's/t-1/t',
    xLabel: '1/t',
    yLabel: 's/t',
    xTransform: x => 1 / x,
    yTransform: (y, t) => y / t,
    type: 's-t',
  },
};

// Цвета для скважин
export const WELL_COLORS = [
  '#1976D2', // Синий
  '#D32F2F', // Красный
  '#388E3C', // Зеленый
  '#F57C00', // Оранжевый
  '#7B1FA2', // Фиолетовый
  '#0097A7', // Бирюзовый
  '#C2185B', // Розовый
  '#5D4037', // Коричневый
];

// Конфигурация графика - оптимизированная для сенсорного взаимодействия
export const CHART_CONFIG = {
  WIDTH: 350,
  HEIGHT: 400,
  PADDING: 60,
  GRID_COLOR: '#E0E0E0',
  AXIS_COLOR: '#333333',
  POINT_RADIUS: 6, // Увеличен для лучшего тапа
  SELECTED_POINT_RADIUS: 9, // Увеличен для лучшей видимости
  TOUCH_RADIUS: 30, // Радиус области тапа по точке
  LINE_WIDTH: 2,
  SELECTED_LINE_WIDTH: 3,
  // Параметры жестов
  MIN_GESTURE_DISTANCE: 10, // Минимальное расстояние для начала жеста
  MAX_ZOOM_SCALE: 10.0, // Максимальное увеличение
  MIN_ZOOM_SCALE: 0.1, // Минимальное уменьшение
  PAN_DAMPING: 0.8, // Коэффициент сглаживания панорамирования
  ZOOM_DAMPING: 0.9, // Коэффициент сглаживания масштабирования
};

// Лимиты производительности
export const PERFORMANCE_LIMITS = {
  MAX_POINTS_PER_WELL: 500,
  MAX_WELLS: 20,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200, // Уменьшено для более отзывчивого интерфейса
  GESTURE_TIMEOUT: 200, // Таймаут для определения тапа vs перетаскивания
  VIEWPORT_UPDATE_THROTTLE: 16, // ~60 FPS для обновления viewport
};

// Значения по умолчанию
export const DEFAULT_VALUES = {
  FLOW_RATE_UNIT: 'м³/сут',
  TIME_UNIT: 'мин',
  DISTANCE_UNIT: 'км',
  EXPERIMENTAL_WELL_RADIUS: '0.1',
  AQUIFER_THICKNESS: '10',
  // Начальные границы viewport для графика
  INITIAL_VIEWPORT: {
    xMin: -2,
    xMax: 30,
    yMin: -1,
    yMax: 10,
  },
  // Минимальные размеры для графика
  MIN_CHART_WIDTH: 300,
  MIN_CHART_HEIGHT: 350,
  // Размеры для полноэкранного режима
  FULLSCREEN_CHART_MIN_HEIGHT: 400,
  FULLSCREEN_CHART_MAX_HEIGHT_RATIO: 0.7,
};

// Параметры безопасных зон для различных платформ
export const SAFE_AREAS = {
  IOS: {
    TOP: 50,
    BOTTOM: 34,
  },
  ANDROID: {
    TOP: 25,
    BOTTOM: 20,
  },
};

// Настройки сенсорного взаимодействия
export const TOUCH_CONFIG = {
  SINGLE_TAP_MAX_TIME: 200,
  DOUBLE_TAP_MAX_INTERVAL: 300,
  MIN_PAN_DISTANCE: 10,
  MIN_PINCH_DISTANCE: 20,
  MAX_SIMULTANEOUS_TOUCHES: 2,
  GESTURE_RECOGNITION_DELAY: 50,
};