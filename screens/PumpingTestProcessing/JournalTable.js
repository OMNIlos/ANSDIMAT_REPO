/**
 * Таблица журнала «время — понижение»
 *
 * Компактная таблица на две колонки: строка добавляется кнопкой, удаляется
 * крестиком в своей же строке. Пустая строка внизу не заводится сама —
 * в поле журнал заполняют сверху вниз, и «пустая строка про запас» на
 * телефоне только сбивает: непонятно, замер это или место под замер.
 *
 * Числа лежат в базовых единицах, а в полях стоят в размерностях
 * пользователя: перевод, как и везде, на границе ввода и вывода.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../../Localization';
import { spacing, radius, type, numericAt, fontFamily } from '../../theme';

/**
 * @param {Object} props
 * @param {Array<{key: string, tText: string, sText: string}>} props.rows - строки
 * @param {Function} props.onChange - (индекс, поле, текст) → void
 * @param {Function} props.onAdd - добавить строку
 * @param {Function} props.onRemove - (индекс) → void
 * @param {string} props.timeUnit - подпись размерности времени
 * @param {string} props.valueUnit - подпись размерности понижения
 * @param {string} [props.valueLabel] - заголовок второй колонки
 * @returns {React.ReactElement} таблица
 */
export default function JournalTable({
  rows,
  onChange,
  onAdd,
  onRemove,
  timeUnit,
  valueUnit,
  valueLabel = 's',
}) {
  const theme = useTheme();

  // Поля строк по ключу. «Далее» на клавиатуре ведёт t → s → t следующей
  // строки, а на заполненной последней заводит новую и ставит в неё курсор —
  // как в журнале откачки. Раньше на каждый замер уходило четыре касания
  const inputs = useRef(new Map());
  const focusNewRow = useRef(false);
  const bindInput = (key, field) => (element) => {
    const entry = inputs.current.get(key) ?? {};
    if (element) entry[field] = element;
    else delete entry[field];
    if (entry.tText || entry.sText) inputs.current.set(key, entry);
    else inputs.current.delete(key);
  };
  const focusInput = (key, field) => inputs.current.get(key)?.[field]?.focus();

  const lastKey = rows.length > 0 ? rows[rows.length - 1].key : null;
  useEffect(() => {
    if (!focusNewRow.current || !lastKey) return;
    focusNewRow.current = false;
    focusInput(lastKey, 'tText');
  }, [lastKey]);

  /** «Далее» в поле понижения: следующая строка или новая */
  const submitValue = (index) => {
    const row = rows[index];
    const next = rows[index + 1];
    if (next) {
      focusInput(next.key, 'tText');
      return;
    }
    // Пустых строк не плодим: недописанную сначала дописывают
    if (!row.tText.trim()) {
      focusInput(row.key, 'tText');
      return;
    }
    if (!row.sText.trim()) return;
    focusNewRow.current = true;
    onAdd();
  };

  const cell = (index, field, value, key) => (
      <TextInput
        ref={bindInput(key, field)}
        value={value}
        onChangeText={(text) => onChange(index, field, text)}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() =>
          field === 'tText' ? focusInput(key, 'sText') : submitValue(index)
        }
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder="—"
        placeholderTextColor={theme.colors.faint}
        selectionColor={theme.colors.primary}
        underlineColorAndroid="transparent"
        style={[
          styles.cell,
          numericAt(13),
          { color: theme.colors.text, borderColor: theme.colors.border },
        ]}
      />
  );

  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.head, { borderBottomColor: theme.colors.border }]}>
        <Text style={[type.label, styles.headCell, { color: theme.colors.textSecondary }]}>
          {`t, ${timeUnit}`}
        </Text>
        <Text style={[type.label, styles.headCell, { color: theme.colors.textSecondary }]}>
          {`${valueLabel}, ${valueUnit}`}
        </Text>
        <View style={styles.removeSlot} />
      </View>

      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[styles.row, { borderTopColor: theme.colors.border }]}
        >
          {cell(index, 'tText', row.tText, row.key)}
          {cell(index, 'sText', row.sText, row.key)}
          <Pressable
            onPress={() => onRemove(index)}
            style={styles.removeSlot}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel={I18n.t('delete', { defaultValue: 'Удалить' })}
          >
            <MaterialIcons name="close" size={16} color={theme.colors.faint} />
          </Pressable>
        </View>
      ))}

      {/* Добавленная строка сразу получает курсор */}
      <Pressable
        onPress={() => {
          focusNewRow.current = true;
          onAdd();
        }}
        style={[styles.add, { borderTopColor: theme.colors.border }]}
      >
        <MaterialIcons name="add" size={18} color={theme.colors.primaryAccent} />
        <Text style={[styles.addText, { color: theme.colors.primaryAccent }]}>
          {I18n.t('addMeasurement', { defaultValue: 'Добавить замер' })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headCell: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Нулевой минимум обязателен: на вебе <input> без него держит свою
  // «естественную» ширину, вторая колонка уезжала вправо от своей шапки
  cell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  removeSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Как у журнала откачки: одна и та же кнопка выглядит одинаково везде
  addText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
});
