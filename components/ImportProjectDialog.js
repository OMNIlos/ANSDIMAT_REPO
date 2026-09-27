/**
 * Диалог импорта журнала из файла `.ansdimat`
 *
 * Показывает, что именно приехало, до того как это попадёт в базу: импорт —
 * осознанное действие, а не «принять неизвестно что». Отсюда сводка вместо
 * одного вопроса «импортировать?».
 *
 * Рисуется поверх навигатора, потому что файл может открыться на любом
 * экране, — см. `share/ImportContext`.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';

import I18n from '../Localization';
import { useImport } from '../share/ImportContext';
import { useUnits } from '../UnitsContext';
import { QUANTITIES } from '../calc/units';
import { IMPORT_ERRORS } from '../share/format';
import { spacing, radius, fontFamily, elevation, scrim } from '../theme';
import { AnimatedPressable, useDialogEntrance } from './ui/dialogMotion';
import DialogLayer from './ui/DialogLayer';

/** Сообщение под каждый отказ: пользователю нужна причина, а не «ошибка» */
const ERROR_KEYS = {
  [IMPORT_ERRORS.NOT_ANSDIMAT]: {
    key: 'importErrorNotAnsdimat',
    fallback: 'Это не файл проекта АНСДИМАТ.',
  },
  [IMPORT_ERRORS.TOO_NEW]: {
    key: 'importErrorTooNew',
    fallback: 'Файл создан более новой версией приложения. Обновите АНСДИМАТ.',
  },
  [IMPORT_ERRORS.CORRUPTED]: {
    key: 'importErrorCorrupted',
    fallback: 'Файл повреждён при передаче. Попросите отправить его ещё раз.',
  },
  [IMPORT_ERRORS.INVALID]: {
    key: 'importErrorInvalid',
    fallback: 'Файл повреждён или заполнен не полностью.',
  },
  [IMPORT_ERRORS.READ_FAILED]: {
    key: 'importErrorReadFailed',
    fallback: 'Не удалось прочитать файл.',
  },
};

/**
 * Форматирует дату выгрузки
 *
 * @param {string|null} iso - момент выгрузки
 * @returns {string|null} дата в формате ДД.ММ.ГГГГ
 */
function formatExportDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Строка сводки «подпись — значение»
 */
function Row({ label, value, colors }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function ImportProjectDialog() {
  const { colors } = useTheme();
  const { unitLabel, fromBase } = useUnits();
  const { pending, busy, confirm, openExisting, dismiss } = useImport();
  // Окно подрастает на место, как и подтверждения, см. ui/dialogMotion
  const cardMotion = useDialogEntrance(!!pending);

  if (!pending) return null;

  const isBlocking = pending.status === 'loading' || busy;

  /**
   * Кнопка диалога
   */
  const Button = ({ label, onPress, tone = 'quiet', block = false }) => {
    const background =
      tone === 'primary' ? colors.primary : tone === 'danger' ? colors.errorFill : colors.surfaceSunken;
    const textColor = tone === 'quiet' ? colors.textSecondary : '#FFFFFF';

    return (
      <TouchableOpacity
        style={[
          styles.button,
          // В ряду кнопки делят ширину поровну, в колонке занимают её целиком.
          // Без этого различия flex: 1 в колонке распределял бы между ними
          // высоту, и все три схлопывались бы в полоски
          block ? styles.buttonBlock : styles.buttonInline,
          { backgroundColor: background, opacity: busy ? 0.6 : 1 },
        ]}
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderBody = () => {
    if (pending.status === 'loading') {
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {I18n.t('importReading', { defaultValue: 'Читаем файл…' })}
          </Text>
        </View>
      );
    }

    if (pending.status === 'error') {
      const description = ERROR_KEYS[pending.error] ?? ERROR_KEYS[IMPORT_ERRORS.INVALID];
      return (
        <>
          <Text style={[styles.title, { color: colors.text }]}>
            {I18n.t('importFailed', { defaultValue: 'Не удалось открыть файл' })}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {I18n.t(description.key, { defaultValue: description.fallback })}
          </Text>
          <View style={styles.actions}>
            <Button
              label={I18n.t('close', { defaultValue: 'Закрыть' })}
              onPress={dismiss}
              tone="primary"
            />
          </View>
        </>
      );
    }

    const { payload, summary, meta, existing } = pending;
    const exportedAt = formatExportDate(meta?.exportedAt);

    return (
      <>
        <Text style={[styles.title, { color: colors.text }]}>
          {existing
            ? I18n.t('importExistsTitle', { defaultValue: 'Такой журнал уже есть' })
            : I18n.t('importTitle', { defaultValue: 'Импорт журнала' })}
        </Text>

        <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={2}>
          {payload.name}
        </Text>

        <View style={[styles.summary, { backgroundColor: colors.surfaceSunken }]}>
          <Row
            colors={colors}
            label={I18n.t('ofrType', { defaultValue: 'Тип ОФР' })}
            value={I18n.t(`ofr_${payload.ofrType}`, { defaultValue: payload.ofrType })}
          />
          <Row
            colors={colors}
            label={`Q, ${unitLabel(QUANTITIES.FLOW)}`}
            value={String(Number(fromBase(payload.Q, QUANTITIES.FLOW).toPrecision(6)))}
          />
          {summary.wells > 0 && (
            <Row
              colors={colors}
              label={I18n.t('wells', { defaultValue: 'Скважины' })}
              value={String(summary.wells)}
            />
          )}
          <Row
            colors={colors}
            label={I18n.t('importPumpingRows', { defaultValue: 'Замеры откачки' })}
            value={String(summary.pumping)}
          />
          {summary.recovery > 0 && (
            <Row
              colors={colors}
              label={I18n.t('importRecoveryRows', { defaultValue: 'Замеры восстановления' })}
              value={String(summary.recovery)}
            />
          )}
          {!!exportedAt && (
            <Row
              colors={colors}
              label={I18n.t('importExportedAt', { defaultValue: 'Выгружен' })}
              value={exportedAt}
            />
          )}
        </View>

        {existing ? (
          <>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {I18n.t('importExistsHint', {
                name: existing.name,
                defaultValue: `Журнал «${existing.name}» уже заведён из этого файла. Заменить его или добавить копию?`,
              })}
            </Text>
            <View style={styles.stack}>
              <Button
                block
                label={I18n.t('importReplace', { defaultValue: 'Заменить существующий' })}
                onPress={() => confirm('replace')}
                tone="danger"
              />
              <Button
                block
                label={I18n.t('importCopy', { defaultValue: 'Создать копию' })}
                onPress={() => confirm('copy')}
                tone="primary"
              />
              <Button
                block
                label={I18n.t('importOpenExisting', { defaultValue: 'Открыть имеющийся' })}
                onPress={openExisting}
              />
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            <Button label={I18n.t('cancel', { defaultValue: 'Отмена' })} onPress={dismiss} />
            <Button
              label={I18n.t('importAction', { defaultValue: 'Импортировать' })}
              onPress={() => confirm('copy')}
              tone="primary"
            />
          </View>
        )}
      </>
    );
  };

  return (
    // Слой на весь экран поверх приложения, как у ConfirmDialog; на Android —
    // без окна Modal, которое открывалось пустым, см. DialogLayer
    <DialogLayer visible onRequestClose={isBlocking ? undefined : dismiss}>
      {/* Пока идёт чтение или запись, нажатие мимо окна ничего не делает:
          прервать импорт на середине нечем, и закрытие оставило бы журнал
          записанным наполовину */}
      <Pressable style={styles.backdrop} onPress={isBlocking ? undefined : dismiss}>
        <AnimatedPressable
          style={[
            styles.card,
            elevation.raised,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardMotion,
          ]}
          onPress={() => {}}
        >
          {renderBody()}
        </AnimatedPressable>
      </Pressable>
    </DialogLayer>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  loading: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  projectName: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  summary: {
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    flexShrink: 1,
  },
  rowValue: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    textAlign: 'right',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  stack: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  buttonInline: {
    flex: 1,
  },
  buttonBlock: {
    alignSelf: 'stretch',
  },
  buttonText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
  },
});
