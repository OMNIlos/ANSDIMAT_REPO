/**
 * Дизайн-система АНСДИМАТ
 *
 * Направление — «полевой прибор»: приложение должно читаться как точный
 * измерительный инструмент, а не как потребительское приложение.
 *
 * Логика цвета:
 * - Бордовый (wine) — бренд и ввод данных (журнал, создание, шапки)
 * - Синий (abyss) — обработка и анализ. Цвет несёт смысл, а не украшает:
 *   если элемент синий, он ведёт к расчётам и графикам
 * - Фон — тёплая «бумага», а не стерильный белый; границы тёплые серые,
 *   поэтому карточки держатся контуром, а не тяжёлыми тенями
 */

import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { Platform } from 'react-native';

/**
 * Базовая палитра
 */
const palette = {
  // Бренд
  wine: '#72002F',        // Основной бордовый — кнопки, шапки, акценты
  wineDeep: '#4A001F',    // Нажатые состояния и градиентный край
  wineSoft: '#A8446A',    // Бордовый на тёмном фоне, вторичные акценты
  wineWash: '#FBF0F4',    // Едва заметная подложка выделенных состояний

  // Анализ
  abyss: '#031888',       // Синий — обработка, графики, расчёты
  abyssSoft: '#5B6CD9',   // Синий для тёмной темы

  // Нейтральные (тёплые, в тон бордового)
  ink: '#1A0710',         // Основной текст — почти чёрный с бордовым подтоном
  slate: '#6B6169',       // Второстепенный текст
  hairline: '#E8E4E6',    // Границы карточек и разделители
  paper: '#FBFAFA',       // Фон экрана — «бумага»
  surface: '#FFFFFF',     // Карточки поверх фона
  surfaceSunken: '#F4F1F2', // Утопленные блоки: инфо-карточки, поля

  // Тёмная тема (тёплый чёрный, а не холодный #121212)
  inkDark: '#121013',
  surfaceDark: '#1C191C',
  surfaceSunkenDark: '#252126',
  hairlineDark: '#332D31',
  textDark: '#F5F2F4',
  slateDark: '#A79FA4',

  // Служебные
  white: '#FFFFFF',
  gold: '#E0A83C',        // Избранное
  danger: '#B3261E',
};

/**
 * Гарнитуры
 *
 * Manrope — заголовки и интерфейс, JetBrains Mono — числа, координаты,
 * результаты и подписи осей. Имена соответствуют пакетам
 * @expo-google-fonts/*. На случай, если шрифты ещё не загрузились,
 * значения безопасно откатываются на системные (RN игнорирует
 * несуществующее семейство и берёт дефолтное).
 */
export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
};

/**
 * Шкала отступов (сетка 4pt)
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/**
 * Радиусы скругления (по дизайн-хендоффу)
 */
export const radius = {
  sm: 12,
  md: 16,    // Карточки
  card: 18,  // Карточки с крупным содержимым
  lg: 22,    // Герой-блоки и крупные карточки
  chip: 20,  // Чипы и сегменты
  pill: 26,  // Кнопки-пилюли
  round: 999,
};

/**
 * Цвета типов точек полевого дневника
 *
 * Тип точки узнаётся по цвету маркера на карте, поэтому оттенки заданы
 * отдельно от палитры интерфейса и одинаковы в обеих темах.
 */
export const pointTypeColors = {
  well: '#031888',         // Скважина
  spring: '#2E9B8F',       // Родник
  pit: '#72002F',          // Шурф
  observation: '#E0A83C',  // Точка наблюдения
};

/**
 * Типографическая шкала
 *
 * Шрифты системные (SF Pro на iOS, Roboto на Android) — характер задаётся
 * шкалой, весом и трекингом, а не гарнитурой.
 *
 * numeric — табличные цифры: в приложении про замеры колонки чисел
 * обязаны выравниваться по разрядам.
 */
export const type = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  // Надзаголовок секции: КАПСОМ, разрежённый
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  numeric: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      ios: { fontFamily: 'SF Mono' },
      android: { fontFamily: 'monospace' },
      default: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
    }),
  },
};

/** Отношение высоты строки к кеглю для крупных чисел */
const NUMERIC_LINE_RATIO = 1.3;

/**
 * Числовой стиль заданного кегля
 *
 * Токен `numeric` несёт высоту строки под свой кегль 15 px. Стиль вида
 * `{ ...type.numeric, fontSize: 30 }` наследовал lineHeight 20 — цифра
 * в 30 px не помещалась в строку и обрезалась снизу. На вебе это сходило
 * с рук, на Android обрезка видна сразу, и именно она вылезала на карточках
 * результата после сборки.
 *
 * Хелпер держит высоту строки пропорциональной кеглю, поэтому кегль здесь
 * задаётся только через него, а не переопределением поверх токена.
 *
 * @param {number} fontSize - кегль, px
 * @returns {{fontSize: number, lineHeight: number}} размеры для стиля
 */
export function numericAt(fontSize) {
  return {
    ...type.numeric,
    fontSize,
    lineHeight: Math.round(fontSize * NUMERIC_LINE_RATIO),
  };
}

/**
 * Тени — почти невидимые в светлой теме (границы делают работу),
 * заметнее в тёмной, где границ недостаточно
 */
export const elevation = {
  // Карточки: 0 10px 24px -18px rgba(20,7,14,.3)
  card: {
    shadowColor: '#14070E',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  // Бордовые кнопки: 0 12px 24px -12px rgba(114,0,47,.5)
  brandButton: {
    shadowColor: '#72002F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  // Синие кнопки и карточки результата
  dataButton: {
    shadowColor: '#031888',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  // Плавающее меню: 0 12px 30px -8px rgba(74,0,31,.55)
  raised: {
    shadowColor: '#4A001F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    elevation: 10,
  },
};

/**
 * Светлая тема
 */
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,

    // Бренд
    primary: palette.wine,
    primaryAccent: palette.wine,
    primaryDeep: palette.wineDeep,
    primaryLight: palette.wineSoft,
    primaryWash: palette.wineWash,
    onPrimary: palette.white,

    // Анализ
    secondary: palette.abyss,
    secondaryLight: palette.abyssSoft,

    // Поверхности
    background: palette.paper,
    surface: palette.surface,
    surfaceSunken: palette.surfaceSunken,
    surfaceVariant: palette.surfaceSunken,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: palette.surface,
      level2: palette.surface,
      level3: palette.surface,
    },

    // Текст
    text: palette.ink,
    onSurface: palette.ink,
    textSecondary: palette.slate,
    onSurfaceVariant: palette.slate,
    placeholder: palette.slate,
    faint: '#8A8087',        // Приглушённый (иконки-шевроны, подписи)

    // Линии
    border: palette.hairline,
    outline: palette.hairline,
    outlineVariant: palette.hairline,

    // Бордовый как текст/граница на светлой поверхности
    wineText: palette.wine,
    wineBorder: '#E1D6DB',

    // Плашка-чип, фон превью видео, фон области графика
    chip: 'rgba(255,255,255,0.92)',
    thumb: '#EDE3E7',
    thumbStripe: 'rgba(114,0,47,0.08)',
    plotBg: '#FCFBFC',

    // Служебные
    white: palette.white,
    reverseText: palette.white,
    gold: palette.gold,
    success: '#2E9B8F',
    error: palette.danger,
    errorFill: palette.danger,
    shadow: 'rgba(42, 10, 24, 0.08)',
    d4d4d4: palette.surfaceSunken,
  },
};

/**
 * Тёмная тема
 */
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,

    // Бренд. primary остаётся глубоким бордовым и в тёмной теме: это фон
    // под белым текстом, он контрастен в обоих режимах и держит узнаваемость.
    // Осветлённый вариант живёт отдельно в primaryAccent — для случаев,
    // когда бордовый выступает текстом или иконкой на тёмной поверхности.
    primary: palette.wine,
    primaryAccent: palette.wineSoft,
    primaryDeep: palette.wineDeep,
    primaryLight: palette.wineSoft,
    primaryWash: 'rgba(168, 68, 106, 0.16)',
    onPrimary: palette.white,

    // Анализ
    secondary: palette.abyssSoft,
    secondaryLight: palette.abyssSoft,

    // Поверхности
    background: palette.inkDark,
    surface: palette.surfaceDark,
    surfaceSunken: palette.surfaceSunkenDark,
    surfaceVariant: palette.surfaceSunkenDark,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: 'transparent',
      level1: palette.surfaceDark,
      level2: palette.surfaceDark,
      level3: palette.surfaceDark,
    },

    // Текст
    text: palette.textDark,
    onSurface: palette.textDark,
    textSecondary: palette.slateDark,
    onSurfaceVariant: palette.slateDark,
    placeholder: palette.slateDark,
    faint: '#8A8087',

    // Линии
    border: palette.hairlineDark,
    outline: palette.hairlineDark,
    outlineVariant: palette.hairlineDark,

    // Бордовый на тёмной поверхности осветляем, иначе проваливается
    wineText: '#D98BAA',
    wineBorder: '#4A2733',

    // Плашка-чип, фон превью видео, фон области графика
    chip: 'rgba(28,25,28,0.92)',
    thumb: '#241A1F',
    thumbStripe: 'rgba(216,139,170,0.10)',
    plotBg: '#191518',

    // Служебные
    white: palette.white,
    reverseText: palette.ink,
    gold: palette.gold,
    success: '#3FB7A8',
    // error — для текста и иконок на тёмном фоне, errorFill — заливка кнопок:
    // светло-розовый годится как надпись, но не как фон под белым текстом
    error: '#F2B8B5',
    errorFill: '#C2352B',
    shadow: 'rgba(0, 0, 0, 0.5)',
    d4d4d4: palette.surfaceSunkenDark,
  },
};

/**
 * Градиент герой-карточки «Создать откачку»
 * linear-gradient(160deg, #8A0A3D 0%, #72002F 55%, #4A001F 100%)
 * Одинаков в обеих темах — это фирменный акцент.
 */
export const heroGradient = {
  colors: ['#8A0A3D', '#72002F', '#4A001F'],
  locations: [0, 0.55, 1],
  // 160deg в CSS ≈ вектор вправо-вниз
  start: { x: 0.1, y: 0 },
  end: { x: 0.9, y: 1 },
};

/**
 * Шапка экрана всегда фирменно-бордовая — и в светлой, и в тёмной теме.
 * Это якорь бренда: пользователь узнаёт приложение по бордовой полосе сверху.
 */
export const brandHeader = palette.wine;

export { palette };

// Экспортируем светлую тему как тему по умолчанию
export default lightTheme;

/**
 * Возвращает название темы на указанном языке
 *
 * @param {string} themeMode - Режим темы ('light', 'dark', 'system')
 * @param {string} locale - Язык интерфейса ('ru' или 'en')
 * @returns {string} Название темы на указанном языке
 */
export function getThemeSwitchLabel(themeMode, locale = 'ru') {
  if (locale === 'en') {
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
