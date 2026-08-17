/**
 * Шапка графика: масштаб и способ построения прямой
 *
 * Управление показывается всегда, а не только когда на полотне есть точки.
 * Раньше вся шапка пряталась при пустом ряде замеров, и график выглядел
 * полностью неуправляемым: ни кнопок масштаба, ни «Сброса», ни разворота на
 * весь экран, ни выбора способа прямой. Отличить это от неработающих жестов
 * снаружи невозможно.
 *
 * Кнопки масштаба стоят рядом с жестами намеренно: щипок двумя пальцами
 * неудобен в перчатках, а зимой в поле работают именно в них.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../../Localization';
import { FIT_MODES } from './fitModes';
import { spacing, type, fontFamily } from '../../theme';

/**
 * @param {Object} props
 * @param {string} props.caption - что отложено по осям
 * @param {string} props.fitMode - способ построения прямой, см. FIT_MODES
 * @param {Function} props.onFitModeChange - сменить способ
 * @param {Function} props.onZoomIn - приблизить
 * @param {Function} props.onZoomOut - отдалить
 * @param {Function} props.onReset - вернуть исходный масштаб
 * @param {Function} props.onResetLine - вернуть свободную прямую на место
 * @param {boolean} props.fullscreen - развёрнут ли график
 * @param {Function} [props.onToggleFullscreen] - развернуть или свернуть
 * @param {Object} props.colors - цвета темы
 */
export default function ChartToolbar({
  caption,
  fitMode,
  onFitModeChange,
  onZoomIn,
  onZoomOut,
  onReset,
  onResetLine,
  fullscreen,
  onToggleFullscreen,
  colors: c,
}) {
  const freedom = fitMode === FIT_MODES.FREEDOM;

  return (
    <>
      <View style={styles.header}>
        <Text style={[type.eyebrow, { color: c.textSecondary }]}>{caption}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={onZoomOut}
            style={[styles.zoomButton, { borderColor: c.border, backgroundColor: c.surface }]}
            accessibilityRole="button"
            accessibilityLabel={I18n.t('zoomOut', { defaultValue: 'Отдалить' })}
            hitSlop={6}
          >
            <MaterialIcons name="remove" size={16} color={c.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onZoomIn}
            style={[styles.zoomButton, { borderColor: c.border, backgroundColor: c.surface }]}
            accessibilityRole="button"
            accessibilityLabel={I18n.t('zoomIn', { defaultValue: 'Приблизить' })}
            hitSlop={6}
          >
            <MaterialIcons name="add" size={16} color={c.textSecondary} />
          </TouchableOpacity>

          {/* Свободную прямую можно развести по углам полотна, и тогда она
              идёт не там, где нужно. Кнопка ставит точки обратно на прямую
              по всем замерам */}
          {freedom && (
            <TouchableOpacity onPress={onResetLine} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.resetLink, { color: c.primaryAccent }]}>
                {I18n.t('resetLine', { defaultValue: 'Прямую заново' })}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onReset} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.resetLink, { color: c.primaryAccent }]}>
              {I18n.t('reset', { defaultValue: 'Сброс' })}
            </Text>
          </TouchableOpacity>

          {/* Разворот на весь экран. Внутри списка вертикальное перетаскивание
              достаётся прокрутке, и график под пальцем стоит на месте.
              Развёрнутый лежит вне прокрутки и получает жесты целиком */}
          {onToggleFullscreen && (
            <TouchableOpacity
              onPress={onToggleFullscreen}
              style={[styles.zoomButton, { borderColor: c.border, backgroundColor: c.surface }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: fullscreen }}
              accessibilityLabel={
                fullscreen
                  ? I18n.t('chartCollapse', { defaultValue: 'Свернуть график' })
                  : I18n.t('chartExpand', {
                      defaultValue: 'Развернуть график на весь экран',
                    })
              }
              hitSlop={6}
            >
              <MaterialIcons
                name={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
                size={16}
                color={c.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.fitRow, { backgroundColor: c.surfaceSunken }]}>
        {[
          {
            key: FIT_MODES.AUTO,
            label: I18n.t('fitAuto', { defaultValue: 'По всем точкам' }),
          },
          {
            key: FIT_MODES.FREEDOM,
            label: I18n.t('fitFreedom', { defaultValue: 'Свободная прямая' }),
          },
        ].map((option) => {
          const active = option.key === fitMode;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => onFitModeChange?.(option.key)}
              style={[styles.fitChip, active && { backgroundColor: c.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.fitChipText,
                  {
                    color: active ? c.primaryAccent : c.textSecondary,
                    fontWeight: active ? '700' : '600',
                  },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomButton: {
    width: 30,
    height: 26,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLink: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  fitRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  fitChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 9,
  },
  fitChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12.5,
  },
});
