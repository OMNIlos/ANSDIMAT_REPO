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
import Segmented from '../ui/Segmented';
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
 * @param {Object} props.colors - цвета темы
 */
/**
 * Запас касания вокруг кнопок масштаба и ссылки «Сброс»
 *
 * Кнопки были 30×26 dp, а ссылка «Сброс» — строка в 18 dp высотой: по ним
 * промахивались и попадали в полотно, сдвигая график. Вместе с запасом зона
 * нажатия — около 48 dp, как у системных кнопок Android. По бокам запас
 * меньше: между кнопками 8 dp, и зоны соседей не должны налезать друг на друга
 */
const ZOOM_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };
const LINK_HIT_SLOP = { top: 15, bottom: 15, left: 8, right: 8 };

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
  colors: c,
}) {
  const freedom = fitMode === FIT_MODES.FREEDOM;

  /** Круглая кнопка плавающей раскладки или прямоугольная обычной */
  const iconButton = (icon, label, onPress, extraProps = {}) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        floating ? styles.floatButton : styles.zoomButton,
        { borderColor: c.border, backgroundColor: c.surface },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={floating ? 10 : ZOOM_HIT_SLOP}
      {...extraProps}
    >
      <MaterialIcons name={icon} size={floating ? 21 : 18} color={c.text} />
    </TouchableOpacity>
  );

  const chips = (
    <Segmented
      size="sm"
      style={styles.fitRow}
      options={[
        { key: FIT_MODES.AUTO, label: I18n.t('fitAuto', { defaultValue: 'По всем точкам' }) },
        { key: FIT_MODES.FREEDOM, label: I18n.t('fitFreedom', { defaultValue: 'Свободная прямая' }) },
      ]}
      value={fitMode}
      onChange={(next) => onFitModeChange?.(next)}
    />
  );

  const resetLinks = (
    <>
      {/* Свободную прямую можно развести по углам полотна, и тогда она идёт
          не там, где нужно. Кнопка ставит точки обратно на прямую по всем
          замерам */}
      {freedom && (
        <TouchableOpacity onPress={onResetLine} accessibilityRole="button" hitSlop={LINK_HIT_SLOP}>
          <Text style={[styles.resetLink, { color: c.primaryAccent }]}>
            {I18n.t('resetLine', { defaultValue: 'Прямую заново' })}
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onReset} accessibilityRole="button" hitSlop={LINK_HIT_SLOP}>
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

  // Плавающая раскладка: полотно под всем экраном, управление — одной строкой
  // сверху. Столбик у правого края закрывал правую треть плоскости, а выбор
  // способа прямой в развёрнутом виде не показывается вовсе: там работают с
  // уже выбранной прямой, а не переключают режимы
  if (floating) {
    return (
      <View
        style={[styles.floatTop, { top: topInset + spacing.sm }]}
        pointerEvents="box-none"
      >
        <View style={[styles.floatCaption, { backgroundColor: c.surface }]}>
          <Text style={[type.label, { color: c.textSecondary }]} numberOfLines={1}>{caption}</Text>
        </View>

        <View style={styles.floatGroup} pointerEvents="box-none">
          {iconButton('remove', I18n.t('zoomOut', { defaultValue: 'Отдалить' }), onZoomOut)}
          {iconButton('add', I18n.t('zoomIn', { defaultValue: 'Приблизить' }), onZoomIn)}
          {/* Подписи заменены значками: строкой они не помещаются на телефоне,
              а голоса экранного диктора это не касается — метки на месте */}
          {freedom &&
            iconButton(
              'timeline',
              I18n.t('resetLine', { defaultValue: 'Прямую заново' }),
              onResetLine
            )}
          {iconButton('refresh', I18n.t('reset', { defaultValue: 'Сброс' }), onReset)}
          {expandButton}
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.header}>
        <Text style={[type.label, { color: c.textSecondary }]} numberOfLines={1}>{caption}</Text>
        <View style={styles.headerActions}>
          {iconButton('remove', I18n.t('zoomOut', { defaultValue: 'Отдалить' }), onZoomOut)}
          {iconButton('add', I18n.t('zoomIn', { defaultValue: 'Приблизить' }), onZoomIn)}
          {resetLinks}
          {expandButton}
        </View>
      </View>
      {/* Способ прямой показывается только там, где прямую ведут. Диагностика
          режима не передаёт вовсе — там смотрят на форму кривой, а не
          подбирают наклон, — и панель у неё остаётся одними кнопками
          масштаба. Пустое полотно чипы не прячет: режим на нём выбран */}
      {fitMode !== undefined && chips}
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
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLink: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 2,
  },
  fitRow: {
    marginBottom: spacing.sm,
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
  floatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  floatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.94,
  },

});
