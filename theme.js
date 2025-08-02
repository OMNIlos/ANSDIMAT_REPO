import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Цвета из ans.html дизайна
const colors = {
  primary: '#72002F', // Основной бордовый цвет
  primaryLight: '#A56981', // Светлый бордовый
  secondary: '#031888', // Синий акцент
  secondaryLight: '#021784', // Темно-синий
  background: '#FFFFFF', // Белый фон
  surface: '#F5F5F5', // Светло-серый фон
  accent: '#E0E0E0', // Серый акцент
  text: '#000000', // Черный текст
  textSecondary: '#727272', // Серый текст
  border: '#919191', // Серая граница
  white: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.1)',
  d4d4d4: '#d4d4d4',
  d3d3d3: '#3d3d3d',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    onSurface: colors.text,
    placeholder: colors.textSecondary,
    outline: colors.border,
    surfaceVariant: colors.accent,
    onSurfaceVariant: colors.textSecondary,
    // Кастомные цвета
    primaryLight: colors.primaryLight,
    secondaryLight: colors.secondaryLight,
    textSecondary: colors.textSecondary,
    border: colors.border,
    white: colors.white,
    shadow: colors.shadow,
    d4d4d4: colors.d4d4d4,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    background: '#121212',
    surface: '#1E1E1E',
    text: '#FFFFFF',
    onSurface: '#FFFFFF',
    placeholder: '#A0A0A0',
    outline: colors.border,
    surfaceVariant: '#2A2A2A',
    onSurfaceVariant: '#A0A0A0',
    // Кастомные цвета
    primaryLight: colors.primaryLight,
    secondaryLight: colors.secondaryLight,
    textSecondary: '#A0A0A0',
    border: colors.border,
    white: colors.white,
    shadow: 'rgba(255, 255, 255, 0.1)',
    d4d4d4: colors.d3d3d3,
  },
};

export default lightTheme;

export function getThemeSwitchLabel(themeMode, locale = 'ru') {
  if (locale === 'en') {
    return themeMode === 'light' ? 'Dark theme' : 'Light theme';
  } else {
    return themeMode === 'light' ? 'Темная тема' : 'Светлая тема';
  }
}
