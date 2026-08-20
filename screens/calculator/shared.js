/**
 * Общая обвязка вкладок калькулятора
 *
 * Поля, карточки, переключатели и стили, которые нужны всем шести вкладкам.
 * Вынесено из экрана, чтобы вкладки не тащили друг друга: каждая читает
 * отсюда готовые части и занимается только своим расчётом.
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { QUANTITIES, MINUTES_PER_DAY } from '../../calc/units';
import { useUnits } from '../../UnitsContext';
import { spacing, radius, type, elevation, numericAt } from '../../theme';

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
 * Карточка с полями ввода
 *
 * @param {Object} props
 * @returns {React.ReactElement} карточка
 */
export function Card({ children, style }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        elevation.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Поле ввода с подписью и единицей измерения
 *
 * @param {Object} props
 * @returns {React.ReactElement} строка формы
 */
export function Field({ label, value, onChange, unit, error, hint }) {
  const theme = useTheme();
  return (
    <View>
      <View style={[styles.field, { borderBottomColor: theme.colors.border }]}>
        <Text style={[type.body, styles.fieldLabel, { color: theme.colors.text }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          style={[
            styles.fieldInput,
            { color: error ? theme.colors.error : theme.colors.secondary },
          ]}
        />
        {unit ? (
          <Text style={[styles.fieldUnit, { color: theme.colors.textSecondary }]}>{unit}</Text>
        ) : null}
      </View>
      {hint ? (
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * Синяя карточка результата с формулой
 *
 * @param {Object} props
 * @returns {React.ReactElement} карточка результата
 */
export function ResultCard({ label, value, unit, formula, extra }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.resultCard, elevation.dataButton, { backgroundColor: theme.colors.secondary }]}
    >
      <Text style={styles.resultCaption}>{I18n.t('result', { defaultValue: 'Результат' })}</Text>
      <View style={styles.resultValueRow}>
        <Text style={styles.resultLabel}>{label} =</Text>
        <Text style={styles.resultValue}>{value}</Text>
        <Text style={styles.resultUnit}>{unit}</Text>
      </View>
      {extra}
      {formula ? <Text style={styles.resultFormula}>{formula}</Text> : null}
    </View>
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
    <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }, style]}>
      {children}
    </Text>
  );
}

/**
 * Переключатель из нескольких взаимоисключающих вариантов
 *
 * Прокручивается по горизонтали: у схем пласта подписи длинные, и в две
 * строки они ломали бы высоту формы при каждой смене языка.
 *
 * @param {Object} props
 * @returns {React.ReactElement} лента вариантов
 */
export function OptionRow({ options, value, onChange }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.optionRow}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.optionChip,
              {
                backgroundColor: active ? theme.colors.primary : 'transparent',
                borderColor: active ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: active ? '#FFFFFF' : theme.colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/**
 * Список предупреждений и ошибок расчёта
 *
 * Ошибки красные и останавливают расчёт, предупреждения — приглушённые и
 * только сообщают, что результат стоит перепроверить.
 *
 * @param {Object} props
 * @returns {React.ReactElement|null} список сообщений
 */
export function Notices({ codes, prefix, tone = 'warning' }) {
  const theme = useTheme();
  if (!codes || codes.length === 0) return null;
  const color = tone === 'error' ? theme.colors.error : theme.colors.textSecondary;
  return (
    <View style={styles.notices}>
      {codes.map((code) => (
        <Text key={code} style={[type.caption, styles.notice, { color }]}>
          {I18n.t(`${prefix}${code}`, { defaultValue: code })}
        </Text>
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
export function StatRow({ label, value }) {
  const theme = useTheme();
  return (
    <View style={[styles.statRow, { borderBottomColor: theme.colors.border }]}>
      <Text style={[type.body, styles.statLabel, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
  bigInput: {
    ...numericAt(34),
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  unitRow: {
    marginTop: spacing.sm,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.sm,
  },
  unitChipText: {
    ...type.numeric,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  convertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  convertValue: {
    ...type.numeric,
    fontSize: 15,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    flex: 1,
  },
  fieldInput: {
    ...type.numeric,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 80,
  },
  fieldUnit: {
    ...type.numeric,
    fontSize: 12,
    marginLeft: spacing.sm,
    minWidth: 46,
  },
  hint: {
    ...type.numeric,
    fontSize: 11,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  groupLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.chip,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  optionRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  optionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
  },
  resultCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  resultValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  resultLabel: {
    ...numericAt(20),
    color: '#FFFFFF',
  },
  resultValue: {
    ...numericAt(30),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultUnit: {
    ...type.numeric,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  resultFormula: {
    ...type.numeric,
    fontSize: 12,
    // Формула набрана моноширинным со скобками и дробями: при высоте строки
    // от родительского токена нижние края скобок срезались
    lineHeight: 18,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.md,
  },
  warning: {
    marginTop: spacing.md,
  },
  notices: {
    marginTop: spacing.md,
    gap: 4,
  },
  notice: {
    lineHeight: 18,
  },
  auxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  auxText: {
    ...type.numeric,
    fontSize: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statLabel: {
    flex: 1,
  },
  statValue: {
    ...type.numeric,
    fontSize: 14,
    fontWeight: '600',
  },
});
