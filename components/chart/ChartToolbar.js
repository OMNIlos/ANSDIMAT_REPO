/**
 * Управление графиком: масштаб и способ построения прямой
 *
 * Показывается всегда, а не только когда на полотне есть точки. Раньше вся
 * шапка пряталась при пустом ряде замеров, и график выглядел полностью
 * неуправляемым: ни кнопок масштаба, ни «Сброса», ни разворота, ни выбора
 * способа прямой. Отличить это от неработающих жестов снаружи невозможно.
 *
 * Две раскладки. Обычная — строкой над полотном, внутри прокручиваемого
 * экрана. Плавающая — поверх полотна в развёрнутом виде: там всё место отдано
 * координатной плоскости, и управление не должно отнимать у неё высоту.
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
 * @param {boolean} [props.floating] - плавающая раскладка поверх полотна
 * @param {number} [props.topInset] - отступ сверху под вырез экрана
 * @param {number} [props.bottomInset] - отступ снизу под системную полосу
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
  floating = false,
  topInset = 0,
  bottomInset = 0,
  colors: c,
}) {
  const freedom = fitMode === FIT_MODES.FREEDOM;

  /** Круглая кнопка плавающей раскладки или прямоугольная обычной */
  const iconButton = (icon, label, onPress, extraProps = {}) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        floating ? styles.floatButton : styles.zoomButton,
        {
          borderColor: c.border,
          backgroundColor: floating ? c.surface : c.surface,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={floating ? 10 : 6}
      {...extraProps}
    >
      <MaterialIcons name={icon} size={floating ? 22 : 16} color={c.text} />
    </TouchableOpacity>
  );

  const chips = (
    <View
      style={[
        styles.fitRow,
        floating ? styles.fitRowFloating : null,
        { backgroundColor: floating ? c.surface : c.surfaceSunken },
      ]}
    >
      {[
        { key: FIT_MODES.AUTO, label: I18n.t('fitAuto', { defaultValue: 'По всем точкам' }) },
        { key: FIT_MODES.FREEDOM, label: I18n.t('fitFreedom', { defaultValue: 'Свободная прямая' }) },
      ].map((option) => {
        const active = option.key === fitMode;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onFitModeChange?.(option.key)}
            style={[
              styles.fitChip,
              active && { backgroundColor: floating ? c.surfaceSunken : c.surface },
            ]}
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
  );

  const resetLinks = (
    <>
      {/* Свободную прямую можно развести по углам полотна, и тогда она идёт
          не там, где нужно. Кнопка ставит точки обратно на прямую по всем
          замерам */}
      {freedom && (
        <TouchableOpacity
          onPress={onResetLine}
          style={floating ? [styles.floatPill, { backgroundColor: c.surface }] : null}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.resetLink, { color: c.primaryAccent }]}>
            {I18n.t('resetLine', { defaultValue: 'Прямую заново' })}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onReset}
        style={floating ? [styles.floatPill, { backgroundColor: c.surface }] : null}
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={[styles.resetLink, { color: c.primaryAccent }]}>
          {I18n.t('reset', { defaultValue: 'Сброс' })}
        </Text>
      </TouchableOpacity>
    </>
  );

  const expandButton =
    onToggleFullscreen &&
    iconButton(
      fullscreen ? 'fullscreen-exit' : 'fullscreen',
      fullscreen
        ? I18n.t('chartCollapse', { defaultValue: 'Свернуть график' })
        : I18n.t('chartExpand', { defaultValue: 'Развернуть график на весь экран' }),
      onToggleFullscreen,
      { accessibilityState: { expanded: fullscreen } }
    );

  // Плавающая раскладка: полотно под всем экраном, управление висит поверх
  // него по углам. Середина остаётся пустой — там работают пальцем
  if (floating) {
    return (
      <>
        <View
          style={[styles.floatTop, { top: topInset + spacing.sm }]}
          pointerEvents="box-none"
        >
          <View style={[styles.floatCaption, { backgroundColor: c.surface }]}>
            <Text style={[type.eyebrow, { color: c.textSecondary }]}>{caption}</Text>
          </View>
          <View style={styles.floatGroup} pointerEvents="box-none">
            {expandButton}
          </View>
        </View>

        <View
          style={[styles.floatSide, { top: topInset + spacing.sm + 52 }]}
          pointerEvents="box-none"
        >
          {iconButton('add', I18n.t('zoomIn', { defaultValue: 'Приблизить' }), onZoomIn)}
          {iconButton('remove', I18n.t('zoomOut', { defaultValue: 'Отдалить' }), onZoomOut)}
          {resetLinks}
        </View>

        <View
          style={[styles.floatBottom, { bottom: bottomInset + spacing.md }]}
          pointerEvents="box-none"
        >
          {chips}
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.header}>
        <Text style={[type.eyebrow, { color: c.textSecondary }]}>{caption}</Text>
        <View style={styles.headerActions}>
          {iconButton('remove', I18n.t('zoomOut', { defaultValue: 'Отдалить' }), onZoomOut)}
          {iconButton('add', I18n.t('zoomIn', { defaultValue: 'Приблизить' }), onZoomIn)}
          {resetLinks}
          {expandButton}
        </View>
      </View>
      {chips}
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

  // Плавающая раскладка
  floatTop: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  floatCaption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    opacity: 0.92,
  },
  floatGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatSide: {
    position: 'absolute',
    right: spacing.md,
    alignItems: 'flex-end',
    gap: 10,
    zIndex: 2,
  },
  floatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.94,
  },
  floatPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    opacity: 0.94,
  },
  floatBottom: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 2,
  },
  fitRowFloating: {
    marginBottom: 0,
    opacity: 0.96,
  },
});
