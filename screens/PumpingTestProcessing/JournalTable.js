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

import React, { useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../../Localization';
import { spacing, radius, type, numericAt } from '../../theme';

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

  const cell = useCallback(
    (index, field, value) => (
      <TextInput
        value={value}
        onChangeText={(text) => onChange(index, field, text)}
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
    ),
    [onChange, theme]
  );

  return (
    <View
      style={[
        styles.frame,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.head, { borderBottomColor: theme.colors.border }]}>
        <Text style={[type.eyebrow, styles.headCell, { color: theme.colors.faint }]}>
          {`t, ${timeUnit}`}
        </Text>
        <Text style={[type.eyebrow, styles.headCell, { color: theme.colors.faint }]}>
          {`${valueLabel}, ${valueUnit}`}
        </Text>
        <View style={styles.removeSlot} />
      </View>

      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[styles.row, { borderTopColor: theme.colors.border }]}
        >
          {cell(index, 'tText', row.tText)}
          {cell(index, 'sText', row.sText)}
          <Pressable
            onPress={() => onRemove(index)}
            style={styles.removeSlot}
            accessibilityLabel={I18n.t('delete', { defaultValue: 'Удалить' })}
          >
            <MaterialIcons name="close" size={16} color={theme.colors.faint} />
          </Pressable>
        </View>
      ))}

      <Pressable
        onPress={onAdd}
        style={[styles.add, { borderTopColor: theme.colors.border }]}
      >
        <MaterialIcons name="add" size={16} color={theme.colors.primary} />
        <Text style={[type.caption, { color: theme.colors.primary }]}>
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    flex: 1,
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
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
