/**
 * Конфигурация тем приложения АНСДИМАТ
 * 
 * Этот файл определяет:
 * - Цветовую палитру приложения на основе дизайна ans.html
 * - Светлую и темную темы с использованием Material Design 3
 * - Кастомные цвета для специфичных элементов интерфейса
 * - Функцию для получения названий тем на разных языках
 * 
 * Цветовая схема основана на корпоративных цветах:
 * - Основной: бордовый (#72002F)
 * - Вторичный: синий (#031888)
 * 
 */

import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

/**
 * Основная цветовая палитра приложения
 * 
 * Цвета взяты из дизайна ans.html и адаптированы для React Native Paper
 * Каждый цвет имеет свое назначение в интерфейсе
 */
const colors = {
  reverseText: '#00000', // Цвет текста для светлых элементов на темном фоне
  primary: '#72002F', // Основной бордовый цвет - используется для кнопок, заголовков
  primaryLight: '#A56981', // Светлый бордовый - для hover состояний и акцентов
  secondary: '#031888', // Синий акцент - для ссылок и дополнительных элементов
  secondaryLight: '#021784', // Темно-синий - для активных состояний
  background: '#FFFFFF', // Белый фон - основной фон приложения
  surface: '#F5F5F5', // Светло-серый фон - для карточек и панелей
  accent: '#E0E0E0', // Серый акцент - для разделителей и неактивных элементов
  text: '#000000', // Черный текст - основной цвет текста
  textSecondary: '#727272', // Серый текст - для подписей и второстепенного текста
  border: '#919191', // Серая граница - для рамок и разделителей
  white: '#FFFFFF', // Белый цвет - для контрастных элементов
  shadow: 'rgba(0, 0, 0, 0.1)', // Тень - для эффектов глубины
  d4d4d4: '#d4d4d4', // Светло-серый - для неактивных элементов
  d3d3d3: '#3d3d3d', // Темно-серый - для темной темы
};

/**
 * Светлая тема приложения
 * 
 * Основана на Material Design 3 Light Theme с кастомными цветами
 * Используется для светлого режима интерфейса
 */
export const lightTheme = {
  ...MD3LightTheme, // Наследуем базовую светлую тему Material Design 3
  colors: {
    ...MD3LightTheme.colors, // Наследуем стандартные цвета MD3
    // Основные цвета приложения
    primary: colors.primary, // Основной бордовый цвет
    reverseText: '#FFFFFF', // Белый текст для темных элементов
    secondary: colors.secondary, // Синий акцент
    
    // Цвета фона и поверхностей
    background: colors.background, // Белый фон
    surface: colors.surface, // Светло-серый фон для карточек
    text: colors.text, // Черный текст
    onSurface: colors.text, // Цвет текста на поверхностях
    
    // Цвета для элементов интерфейса
    placeholder: colors.textSecondary, // Цвет placeholder в полях ввода
    outline: colors.border, // Цвет границ и контуров
    surfaceVariant: colors.accent, // Вариант поверхности для карточек
    
    // Кастомные цвета для специфичных элементов
    primaryLight: colors.primaryLight, // Светлый бордовый
    secondaryLight: colors.secondaryLight, // Темно-синий
    textSecondary: colors.textSecondary, // Серый текст
    border: colors.border, // Серая граница
    white: colors.white, // Белый цвет
    shadow: colors.shadow, // Тень
    d4d4d4: colors.d4d4d4, // Светло-серый
  },
};

/**
 * Темная тема приложения
 * 
 * Основана на Material Design 3 Dark Theme с кастомными цветами
 * Используется для темного режима интерфейса
 */
export const darkTheme = {
  ...MD3DarkTheme, // Наследуем базовую темную тему Material Design 3
  colors: {
    ...MD3DarkTheme.colors, // Наследуем стандартные цвета MD3
    // Основные цвета приложения (те же, что и в светлой теме)
    primary: colors.primary, // Основной бордовый цвет
    secondary: colors.secondary, // Синий акцент
    
    // Цвета фона и поверхностей для темной темы
    background: '#121212', // Темно-серый фон (стандарт Material Design)
    surface: '#1E1E1E', // Темно-серый фон для карточек
    text: '#FFFFFF', // Белый текст
    onSurface: '#FFFFFF', // Белый текст на поверхностях
    placeholder: '#A0A0A0', // Светло-серый placeholder
    outline: colors.border, // Серая граница
    surfaceVariant: '#2A2A2A', // Темно-серый вариант поверхности
    onSurfaceVariant: '#A0A0A0', // Светло-серый текст на вариантах поверхности
    
    // Кастомные цвета для темной темы
    primaryLight: colors.primaryLight, // Светлый бордовый
    secondaryLight: colors.secondaryLight, // Темно-синий
    textSecondary: '#A0A0A0', // Светло-серый текст
    border: colors.border, // Серая граница
    white: colors.white, // Белый цвет
    shadow: 'rgba(255, 255, 255, 0.1)', // Светлая тень для темной темы
    d4d4d4: colors.d3d3d3, // Темно-серый (адаптированный для темной темы)
  },
};

// Экспортируем светлую тему как тему по умолчанию
export default lightTheme;

/**
 * Возвращает название темы на указанном языке
 * 
 * Используется для отображения текущей темы в интерфейсе
 * Поддерживает русский и английский языки
 * 
 * @param {string} themeMode - Режим темы ('light', 'dark', 'system')
 * @param {string} locale - Язык интерфейса ('ru' или 'en')
 * @returns {string} Название темы на указанном языке
 */
export function getThemeSwitchLabel(themeMode, locale = 'ru') {
  if (locale === 'en') {
    // Английские названия тем
    switch (themeMode) {
      case 'light':
        return 'Light theme';
      case 'dark':
        return 'Dark theme';
      case 'system':
        return 'System theme';
      default:
        return 'System theme';
    }
  } else {
    // Русские названия тем
    switch (themeMode) {
      case 'light':
        return 'Светлая тема';
      case 'dark':
        return 'Темная тема';
      case 'system':
        return 'Системная тема';
      default:
        return 'Системная тема';
    }
  }
}
