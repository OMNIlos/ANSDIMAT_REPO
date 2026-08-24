/**
 * Общая обвязка вкладок калькулятора
 *
 * Поля, карточки, переключатели и стили, которые нужны всем шести вкладкам.
 * Вынесено из экрана, чтобы вкладки не тащили друг друга: каждая читает
 * отсюда готовые части и занимается только своим расчётом.
 *
 * Форма собрана как шкала прибора: у каждого параметра своя ячейка одинаковой
 * высоты — сверху название и число, снизу обозначение с размерностью. Раньше
 * подпись, значение и единица стояли в одну строку, и длинное название
 * разъезжалось на три-четыре строки: высота ячейки скакала, а вся форма
 * дёргалась при каждой смене схемы. Две строки фиксированной высоты убирают
 * это полностью.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../../Localization';
import { QUANTITIES, MINUTES_PER_DAY } from '../../calc/units';
import { useUnits } from '../../UnitsContext';
import useReduceMotion from '../../hooks/useReduceMotion';
import { spacing, radius, type, elevation, numericAt, fontFamily } from '../../theme';

/**
 * Разбирает число, принимая запятую как разделитель
 *
 * @param {string} text - введённый текст
 * @returns {number} число или NaN
 */
export function parseNumber(text) {
  if (typeof text !== 'string') return Number(text);
  const normalized = text.replace(',', '.').trim();
  return normalized === '' ? NaN : Number(normalized);
}

/**
 * Форматирует результат расчёта
 *
 * Очень малые и очень большие значения показываем в экспоненциальной записи:
 * коэффициент фильтрации в м/сек — это порядка 10⁻⁵.
 *
 * @param {number} value - значение
 * @returns {string} отформатированное значение
 */
export function formatValue(value) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e6)) return value.toExponential(4);
  if (abs >= 1000) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(3);
  return value.toPrecision(4);
}

/**
 * Компактная запись числа для подписей на чертеже
 *
 * Обычный формат добавляет три знака после запятой всегда, и подпись схемы
 * получалась «k = 2.000 м/сут · Q = 100.000 м³/сут» — вдвое длиннее нужного и
 * налезала на подпись скважины. Здесь хвостовые нули убираются.
 *
 * @param {number} value - значение
 * @returns {string} короткая запись
 */
export function formatCompact(value) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e6)) return value.toExponential(2);
  const rounded = abs >= 100 ? value.toFixed(0) : abs >= 1 ? value.toFixed(2) : value.toPrecision(3);
  return String(Number(rounded));
}

/**
 * Форматирует значение в экспоненциальной записи с показателем
 *
 * Нужна таблицам, где рядом стоят числа разных порядков: там колонка из
 * `0.000123` и `12300` читается хуже, чем из `1.230e-4` и `1.230e+4`.
 *
 * @param {number} value - значение
 * @param {number} [digits] - знаков после запятой
 * @returns {string} отформатированное значение
 */
export function formatExponential(value, digits = 3) {
  if (!isFinite(value)) return '—';
  return value.toExponential(digits);
}

/**
 * Перевод между единицами пользователя и базовыми
 *
 * Поля стоят в выбранных пользователем размерностях, а формулы в `calc/`
 * написаны для базовых. Обёртки собраны здесь, чтобы во вкладках стоял один
 * вызов вместо parseNumber плюс пересчёт.
 *
 * @returns {Object} наборы `in*` для ввода, `out` для вывода и `u*` для подписей
 */
export function useCalcUnits() {
  const { unitLabel, toBase, fromBase } = useUnits();
  return {
    inFlow: (text) => toBase(parseNumber(text), QUANTITIES.FLOW),
    inLen: (text) => toBase(parseNumber(text), QUANTITIES.DISTANCE),
    inDraw: (text) => toBase(parseNumber(text), QUANTITIES.DRAWDOWN),
    inTrans: (text) => toBase(parseNumber(text), QUANTITIES.TRANSMISSIVITY),
    inCond: (text) => toBase(parseNumber(text), QUANTITIES.CONDUCTIVITY),
    inArea: (text) => toBase(parseNumber(text), QUANTITIES.AREA),
    inDiff: (text) => toBase(parseNumber(text), QUANTITIES.DIFFUSIVITY),
    // Прогнозные формулы считают время в сутках, базовая единица приложения —
    // минута: журналы ОФР ведутся в ней
    inDays: (text) => toBase(parseNumber(text), QUANTITIES.TIME) / MINUTES_PER_DAY,
    out: (value, quantity) => formatValue(fromBase(value, quantity)),
    fromBase,
    uFlow: unitLabel(QUANTITIES.FLOW),
    uLen: unitLabel(QUANTITIES.DISTANCE),
    uDraw: unitLabel(QUANTITIES.DRAWDOWN),
    uTrans: unitLabel(QUANTITIES.TRANSMISSIVITY),
    uCond: unitLabel(QUANTITIES.CONDUCTIVITY),
    uArea: unitLabel(QUANTITIES.AREA),
    uDiff: unitLabel(QUANTITIES.DIFFUSIVITY),
    uTime: unitLabel(QUANTITIES.TIME),
  };
}

/**
 * Раскладывает детей в плоский список, разворачивая фрагменты
 *
 * Вкладки собирают поля условно — `{schemeIsRiver ? <Field/> : null}`, часть
 * лежит во фрагментах. Чтобы карточка могла отличить первое поле от
 * последующих и не рисовать разделитель над первым, список нужно разложить.
 *
 * @param {React.ReactNode} nodes - содержимое
 * @returns {Array<React.ReactElement>} плоский список элементов
 */
function flatten(nodes) {
  const out = [];
  React.Children.toArray(nodes).forEach((node) => {
    if (React.isValidElement(node) && node.type === React.Fragment) {
      out.push(...flatten(node.props.children));
    } else {
      out.push(node);
    }
  });
  return out;
}

/**
 * Карточка с полями ввода
 *
 * Сама расставляет разделители между строками: линия рисуется сверху каждой
 * строки, кроме первой. Раньше линия висела снизу у всех, и у нижнего края
 * карточки оставалась висячая черта.
 *
 * @param {Object} props
 * @returns {React.ReactElement} карточка
 */
export function Card({ children, style }) {
  const theme = useTheme();
  const items = flatten(children);
  let position = 0;
  const separated = items.map((child, index) => {
    if (!React.isValidElement(child)) return child;
    if (child.type !== Field && child.type !== StatRow) return child;
    const divider = position > 0;
    position += 1;
    return React.cloneElement(child, { key: child.key ?? index, divider });
  });

  return (
    <View
      style={[
        styles.card,
        elevation.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        style,
      ]}
    >
      {separated}
    </View>
  );
}

/**
 * Ячейка параметра: название и значение сверху, обозначение снизу
 *
 * Высота ячейки одна и та же у всех параметров — за счёт этого форма не
 * дёргается, когда смена схемы подменяет набор полей.
 *
 * @param {Object} props
 * @param {string} props.label - название параметра
 * @param {string} [props.symbol] - обозначение в формуле (Q, r₀, h₀)
 * @param {string} [props.unit] - размерность
 * @param {string} [props.hint] - пересчёт или пояснение, справа внизу
 * @param {boolean} [props.error] - значение мешает расчёту
 * @param {boolean} [props.divider] - рисовать разделитель сверху
 * @returns {React.ReactElement} ячейка формы
 */
export function Field({ label, value, onChange, unit, symbol, error, hint, divider }) {
  const theme = useTheme();
  const input = useRef(null);
  const [focused, setFocused] = useState(false);
  const meta = [symbol, unit].filter(Boolean).join(' · ');
  const valueColor = error ? theme.colors.error : theme.colors.secondary;

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      style={[
        styles.slot,
        divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border } : null,
      ]}
      accessibilityLabel={label}
    >
      <View style={styles.slotTop}>
        <Text style={[styles.slotLabel, { color: theme.colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          // Поле калькулятора почти всегда переписывают целиком, а не правят
          // по знаку: выделение по фокусу избавляет от чистки старого числа
          selectTextOnFocus
          placeholder="—"
          placeholderTextColor={theme.colors.faint}
          selectionColor={theme.colors.primary}
          underlineColorAndroid="transparent"
          style={[styles.slotInput, { color: valueColor }]}
        />
      </View>
      <View style={styles.slotBottom}>
        {meta ? (
          <Text style={[styles.slotMeta, { color: error ? theme.colors.error : theme.colors.faint }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : (
          <View />
        )}
        {hint ? (
          <Text style={[styles.slotHint, { color: theme.colors.faint }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {focused ? (
        <View style={[styles.slotFocusBar, { backgroundColor: theme.colors.primary }]} />
      ) : null}
    </Pressable>
  );
}

/**
 * Главный результат вкладки
 *
 * Единственный громкий элемент экрана. При пересчёте по краю пробегает
 * подсветка: числа меняются на лету, и без отклика непонятно, учлась ли
 * только что введённая цифра.
 *
 * Надзаголовок называет саму величину — «понижение в опытной скважине», а не
 * безличное «результат»: слово одно и то же по длине, но говорит, что за
 * число стоит под ним.
 *
 * @param {Object} props
 * @param {string} props.title - название величины
 * @param {string} props.label - обозначение величины в формуле
 * @param {string} props.value - значение
 * @param {string} props.unit - размерность
 * @param {Array<{label: string, value: string, unit: string}>} [props.rows] - вторые величины
 * @returns {React.ReactElement} карточка результата
 */
export function ResultCard({ title, label, value, unit, rows = [] }) {
  const theme = useTheme();
  const flash = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (reduceMotion) return;
    flash.value = withSequence(
      withTiming(1, { duration: 130 }),
      withTiming(0, { duration: 460, easing: Easing.out(Easing.quad) })
    );
  }, [value, flash, reduceMotion]);

  const glow = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      flash.value,
      [0, 1],
      ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.85)']
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.resultCard,
        elevation.dataButton,
        { backgroundColor: theme.colors.secondary },
        glow,
      ]}
    >
      <Text style={styles.resultCaption} numberOfLines={1}>
        {title || I18n.t('result', { defaultValue: 'Результат' })}
        {label ? <Text style={styles.resultLabel}>{`  ${label}`}</Text> : null}
      </Text>
      <View style={styles.resultValueRow}>
        <Text style={styles.resultValue}>{value}</Text>
        <Text style={styles.resultUnit}>{unit}</Text>
      </View>
      {rows.length > 0 ? (
        <View style={styles.resultRows}>
          {rows.map((row) => (
            <View key={row.label} style={styles.resultRow}>
              <Text style={styles.resultRowLabel} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={styles.resultRowValue}>
                {row.value}
                {row.unit ? <Text style={styles.resultRowUnit}>{` ${row.unit}`}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Заголовок раздела внутри вкладки
 *
 * @param {Object} props
 * @returns {React.ReactElement} заголовок
 */
export function SectionLabel({ children, style }) {
  const theme = useTheme();
  return (
    <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.faint }, style]}>
      {children}
    </Text>
  );
}

/**
 * Один вариант выбора
 *
 * @param {Object} props
 * @returns {React.ReactElement} чип
 */
function Chip({ label, active, onPress, tone, style }) {
  const theme = useTheme();
  const press = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.04 }],
  }));

  const setPressed = (next) => {
    if (reduceMotion) return;
    press.value = next
      ? withTiming(1, { duration: 90 })
      : withSpring(0, { damping: 18, stiffness: 260, mass: 0.6 });
  };

  const accent = tone === 'data' ? theme.colors.secondary : theme.colors.primary;

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="radio"
        accessibilityState={{ selected: !!active }}
        style={[
          styles.chip,
          {
            backgroundColor: active ? accent : 'transparent',
            borderColor: active ? accent : theme.colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.chipText,
            { color: active ? '#FFFFFF' : theme.colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Переключатель из нескольких взаимоисключающих вариантов
 *
 * Варианты переносятся по строкам, а не прокручиваются вбок: у схем пласта
 * подписи длинные, и в прокручиваемой ленте половина вариантов оказывалась за
 * краем экрана — человек просто не знал, что они есть.
 *
 * @param {Object} props
 * @returns {React.ReactElement} группа вариантов
 */
export function OptionRow({ options, value, onChange, tone }) {
  return (
    <View style={styles.chipGroup}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          tone={tone}
          active={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

/**
 * Лента готовых значений: типовые грунты, примеры из веб-версии
 *
 * Это не выбор состояния, а подстановка чисел, поэтому чипы пунктирные и
 * никогда не выглядят выбранными. Лента прокручивается вбок и заканчивается
 * растворением у края — так видно, что варианты продолжаются.
 *
 * @param {Object} props
 * @returns {React.ReactElement} лента
 */
export function PresetRow({ options, onPick }) {
  const theme = useTheme();
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetRow}
      >
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            onPress={() => onPick(option.value)}
            style={styles.presetChip}
          />
        ))}
      </ScrollView>
      <LinearGradient
        pointerEvents="none"
        colors={[theme.colors.backgroundClear, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.presetFade}
      />
    </View>
  );
}

/**
 * Сворачиваемый раздел
 *
 * Формулы, таблицы и подробности расчёта нужны не каждый раз. Свёрнутые, они
 * не мешают увидеть результат, а разворачиваются одним нажатием.
 *
 * @param {Object} props
 * @param {string} props.title - подпись раздела
 * @param {boolean} [props.initiallyOpen] - развернуть сразу
 * @returns {React.ReactElement} раздел
 */
export function Collapsible({ title, note, initiallyOpen = false, children }) {
  const theme = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const reduceMotion = useReduceMotion();
  const turn = useSharedValue(initiallyOpen ? 1 : 0);

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 90}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    turn.value = reduceMotion
      ? next ? 1 : 0
      : withTiming(next ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  };

  return (
    <View style={styles.collapsible}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.collapsibleHead, { borderColor: theme.colors.border }]}
      >
        <Text style={[type.eyebrow, { color: theme.colors.faint, flex: 1 }]}>{title}</Text>
        {note ? <Text style={[styles.collapsibleNote, { color: theme.colors.faint }]}>{note}</Text> : null}
        <Animated.View style={chevron}>
          <MaterialIcons name="chevron-right" size={18} color={theme.colors.faint} />
        </Animated.View>
      </Pressable>
      {open ? <Reveal style={styles.collapsibleBody}>{children}</Reveal> : null}
    </View>
  );
}

/**
 * Проявление только что показанного блока
 *
 * Своим стилем, а не через `entering`: пользовательские entering-анимации
 * Reanimated на вебе не поддерживает и ругается в консоль, а встроенных с
 * нужным характером нет.
 *
 * @param {Object} props
 * @returns {React.ReactElement} проявляющийся блок
 */
function Reveal({ style, children }) {
  const shown = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    shown.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [shown, reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * -6 }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Запись формулы моноширинным на утопленной подложке
 *
 * @param {Object} props
 * @returns {React.ReactElement} блок формулы
 */
export function Formula({ children }) {
  const theme = useTheme();
  return (
    <View style={[styles.formula, { backgroundColor: theme.colors.surfaceSunken }]}>
      <Text style={[styles.formulaText, { color: theme.colors.textSecondary }]}>{children}</Text>
    </View>
  );
}

/**
 * Список предупреждений и ошибок расчёта
 *
 * Ошибки красные и останавливают расчёт, предупреждения — приглушённые и
 * только сообщают, что результат стоит перепроверить.
 *
 * @param {Object} props
 * @param {Array<string>} props.codes - коды сообщений
 * @param {string} [props.prefix] - приставка ключа перевода
 * @param {string} [props.suffix] - окончание ключа перевода
 * @returns {React.ReactElement|null} список сообщений
 */
export function Notices({ codes, prefix = '', suffix = '', tone = 'warning' }) {
  const theme = useTheme();
  if (!codes || codes.length === 0) return null;
  const error = tone === 'error';
  const color = error ? theme.colors.error : theme.colors.textSecondary;
  return (
    <View
      style={[
        styles.notices,
        {
          backgroundColor: error ? theme.colors.errorWash : theme.colors.surfaceSunken,
          borderColor: error ? theme.colors.error : theme.colors.border,
        },
      ]}
    >
      {codes.map((code) => (
        <View key={code} style={styles.noticeRow}>
          <MaterialIcons
            name={error ? 'error-outline' : 'info-outline'}
            size={15}
            color={color}
            style={styles.noticeIcon}
          />
          <Text style={[type.caption, styles.notice, { color }]}>
            {I18n.t(`${prefix}${code}${suffix}`, { defaultValue: code })}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Строка «величина — значение» под результатом
 *
 * @param {Object} props
 * @returns {React.ReactElement} строка
 */
export function StatRow({ label, value, divider }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statRow,
        divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border } : null,
      ]}
    >
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

/**
 * Пояснение под блоком: одна приглушённая строка
 *
 * @param {Object} props
 * @returns {React.ReactElement} подпись
 */
export function Note({ children }) {
  const theme = useTheme();
  return (
    <Text style={[type.caption, styles.note, { color: theme.colors.faint }]}>{children}</Text>
  );
}

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listCard: {
    paddingVertical: spacing.xs,
  },

  // --- Ячейка параметра -----------------------------------------------
  slot: {
    paddingVertical: spacing.md,
  },
  slotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  slotLabel: {
    flex: 1,
    // Без нулевого минимума веб не даёт подписи ужаться до многоточия:
    // min-width гибкого элемента по умолчанию равен ширине его содержимого
    minWidth: 0,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  slotInput: {
    ...numericAt(19),
    fontFamily: fontFamily.monoSemibold,
    fontWeight: '600',
    textAlign: 'right',
    // Ширина задана явно: на вебе <input> без неё занимает свою «естественную»
    // ширину в двадцать знаков — поле выпирало за карточку и выталкивало
    // размерность за край экрана
    width: 112,
    flexShrink: 0,
    paddingVertical: 0,
    borderWidth: 0,
    // Веб-поле рисует своё фокус-кольцо поверх ячейки. На нативе такого
    // свойства нет, и StyleSheet ругался бы на него в отладочной сборке
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  slotBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
    minHeight: 15,
  },
  slotMeta: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
  },
  slotHint: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
  },
  slotFocusBar: {
    position: 'absolute',
    left: -spacing.lg,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  // --- Пересчёт единиц --------------------------------------------------
  bigInput: {
    ...numericAt(36),
    fontFamily: fontFamily.monoSemibold,
    fontWeight: '600',
    minWidth: 0,
    paddingVertical: spacing.xs,
    borderWidth: 0,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  convertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  convertValue: {
    ...type.numeric,
    fontFamily: fontFamily.monoSemibold,
    fontSize: 15,
    fontWeight: '600',
  },

  // --- Заголовки и группы ----------------------------------------------
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  presetRow: {
    gap: spacing.sm,
    paddingRight: spacing.xxl,
    paddingVertical: 2,
  },
  presetChip: {
    opacity: 0.95,
  },
  presetFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: spacing.xxl,
  },

  // --- Результат --------------------------------------------------------
  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  resultCaption: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  resultValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  resultValue: {
    ...numericAt(34),
    fontFamily: fontFamily.monoSemibold,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultUnit: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  resultLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'none',
    color: 'rgba(255,255,255,0.9)',
  },
  resultRows: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.22)',
    gap: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resultRowLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  resultRowValue: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultRowUnit: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },

  // --- Сворачиваемые разделы -------------------------------------------
  collapsible: {
    marginTop: spacing.lg,
  },
  collapsibleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collapsibleNote: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
  collapsibleBody: {
    paddingTop: spacing.md,
  },

  formula: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  formulaText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 19,
  },

  // --- Сообщения --------------------------------------------------------
  notices: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  noticeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noticeIcon: {
    marginTop: 1,
  },
  notice: {
    flex: 1,
    lineHeight: 18,
  },
  note: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },

  // --- Строки статистики ------------------------------------------------
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  statLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 19,
  },
  statValue: {
    ...type.numeric,
    fontFamily: fontFamily.monoSemibold,
    fontSize: 14,
    fontWeight: '600',
  },
});
