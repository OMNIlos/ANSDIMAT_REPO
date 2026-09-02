/**
 * Шторка вложений точки наблюдения
 *
 * Всё содержимое вложений живёт здесь, а не в карточке списка: дневник — это
 * плоский список, который прокручивают целиком, и полоса миниатюр в каждой
 * карточке превратила бы его в ленту картинок. В списке остаётся счётчик.
 *
 * Шторка ничего не пишет в базу. Она сообщает наружу, что снято и что
 * удалено, — запись остаётся за экраном, который и так владеет списком точек.
 *
 * Механика та же, что у ConfirmDialog: Modal, нажатие мимо закрывает,
 * onRequestClose ловит аппаратную кнопку «назад».
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import I18n from '../Localization';
import AudioWave from './AudioWave';
import PhotoViewer from './PhotoViewer';
import ConfirmDialog from './ui/ConfirmDialog';
import usePhotoCapture from '../hooks/usePhotoCapture';
import useVoiceRecorder from '../hooks/useVoiceRecorder';
import { ATTACHMENT_KINDS } from '../db/attachments';
import { formatDuration } from '../lib/waveform';
import { spacing, radius, type, elevation, numericAt } from '../theme';

/** Миниатюр в ряду: на телефоне шире трёх они уже не читаются */
const COLUMNS = 3;

/**
 * @param {Object} props
 * @param {Object|null} props.point - точка, чьи вложения показаны
 * @param {Array} props.attachments - вложения этой точки
 * @param {boolean} props.visible - показана ли шторка
 * @param {Function} props.onClose - закрытие
 * @param {Function} props.onAdd - новое вложение: {kind, uri, durationMillis?, waveform?}
 * @param {Function} props.onDelete - удаление вложения
 */
export default function PointSheet({ point, attachments, visible, onClose, onAdd, onDelete }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { capture, denied: photoDenied } = usePhotoCapture();
  const recorder = useVoiceRecorder();

  // Выбор источника снимка: раскрывается на месте кнопки «Фото»
  const [pickingSource, setPickingSource] = useState(false);
  // Открытый на весь экран снимок
  const [viewerIndex, setViewerIndex] = useState(null);
  // Вложение, для которого запрошено удаление
  const [pendingDelete, setPendingDelete] = useState(null);

  const photos = attachments.filter((item) => item.kind === ATTACHMENT_KINDS.PHOTO);
  const records = attachments.filter((item) => item.kind === ATTACHMENT_KINDS.AUDIO);

  /**
   * Снимает или выбирает фото и отдаёт его наружу
   *
   * @param {'camera'|'library'} source - откуда брать снимок
   */
  const addPhoto = async (source) => {
    setPickingSource(false);
    const uri = await capture(source);
    if (!uri) return;
    await onAdd({ kind: ATTACHMENT_KINDS.PHOTO, uri });
  };

  /**
   * Начинает или останавливает запись
   */
  const toggleRecording = async () => {
    if (!recorder.isRecording) {
      await recorder.start();
      return;
    }

    const recorded = await recorder.stop();
    if (!recorded) return;
    await onAdd({
      kind: ATTACHMENT_KINDS.AUDIO,
      uri: recorded.uri,
      durationMillis: recorded.durationMillis,
      waveform: recorded.waveform,
    });
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    setViewerIndex(null);
    if (target) await onDelete(target);
  };

  const denialNotice =
    (photoDenied === 'camera' && I18n.t('cameraDenied')) ||
    (photoDenied === 'library' && I18n.t('galleryDenied')) ||
    (recorder.denied && I18n.t('microphoneDenied')) ||
    '';

  if (!point) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              elevation.raised,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
              },
            ]}
            onPress={() => {}}
          >
            {/* Полоска захвата: без неё шторка читается как приехавшая карточка,
                и неочевидно, что её закрывают движением вниз */}
            <View style={[styles.grip, { backgroundColor: colors.border }]} />

            <Text style={[type.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {point.title}
            </Text>
            <Text style={[styles.coords, { color: colors.textSecondary }]}>
              {`${Number(point.lat).toFixed(4)}, ${Number(point.lon).toFixed(4)}`}
            </Text>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {photos.length > 0 && (
                <View style={styles.grid}>
                  {photos.map((photo, index) => (
                    <TouchableOpacity
                      key={photo.id}
                      style={[styles.thumb, { backgroundColor: colors.thumb }]}
                      onPress={() => setViewerIndex(index)}
                      accessibilityRole="button"
                      accessibilityLabel={I18n.t('attachments')}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.thumbImage} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {records.map((record) => (
                <VoiceRow
                  key={record.id}
                  record={record}
                  colors={colors}
                  onDelete={() => setPendingDelete(record)}
                />
              ))}
            </ScrollView>

            {!!denialNotice && (
              <Text style={[type.caption, styles.notice, { color: colors.error }]}>
                {denialNotice}
              </Text>
            )}

            {recorder.isRecording ? (
              <View style={[styles.recordingRow, { borderColor: colors.error }]}>
                <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
                <AudioWave
                  levels={recorder.levels.slice(-40)}
                  progress={1}
                  color={colors.error}
                  mutedColor={colors.border}
                  height={24}
                  style={styles.recordingWave}
                />
                <Text style={[styles.duration, { color: colors.text }]}>
                  {formatDuration(recorder.durationMillis)}
                </Text>
                <TouchableOpacity
                  onPress={toggleRecording}
                  style={[styles.stopButton, { backgroundColor: colors.error }]}
                  accessibilityRole="button"
                  accessibilityLabel={I18n.t('stopRecording')}
                >
                  <MaterialIcons name="stop" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : pickingSource ? (
              <View style={styles.actions}>
                <SheetButton
                  icon="photo-camera"
                  label={I18n.t('photoFromCamera')}
                  colors={colors}
                  onPress={() => addPhoto('camera')}
                />
                <SheetButton
                  icon="photo-library"
                  label={I18n.t('photoFromLibrary')}
                  colors={colors}
                  onPress={() => addPhoto('library')}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <SheetButton
                  icon="photo-camera"
                  label={I18n.t('addPhoto')}
                  colors={colors}
                  onPress={() => setPickingSource(true)}
                />
                <SheetButton
                  icon="mic-none"
                  label={I18n.t('addVoiceNote')}
                  colors={colors}
                  onPress={toggleRecording}
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Просмотр и диалог — соседи шторки, а не её дети: вложенная в Modal
          вторая Modal на iOS показывается поверх первой через раз, и
          подтверждение удаления оставалось невидимым */}
      <PhotoViewer
        photos={photos}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        onDelete={(photo) => setPendingDelete(photo)}
      />

      <ConfirmDialog
        visible={!!pendingDelete}
        title={I18n.t('deleteAttachment')}
        message={
          pendingDelete?.kind === ATTACHMENT_KINDS.PHOTO
            ? I18n.t('deletePhotoMessage')
            : I18n.t('deleteAttachmentMessage')
        }
        confirmLabel={I18n.t('delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/**
 * Строка голосовой заметки
 *
 * Волна занимает всю доступную ширину, длительность прижата к правому краю
 * моноширинным: у нескольких записей подряд цифры выстраиваются столбиком.
 *
 * @param {Object} props
 * @param {Object} props.record - вложение вида audio
 * @param {Object} props.colors - палитра темы
 * @param {Function} props.onDelete - запрос удаления
 */
function VoiceRow({ record, colors, onDelete }) {
  return (
    <View style={[styles.voiceRow, { backgroundColor: colors.surfaceSunken }]}>
      <MaterialIcons name="play-arrow" size={22} color={colors.primaryAccent} />
      <AudioWave
        levels={record.waveform}
        progress={1}
        color={colors.primaryAccent}
        mutedColor={colors.border}
        height={24}
        style={styles.voiceWave}
      />
      <Text style={[styles.duration, { color: colors.textSecondary }]}>
        {formatDuration(record.durationMillis)}
      </Text>
      <TouchableOpacity
        onPress={onDelete}
        style={styles.voiceDelete}
        accessibilityRole="button"
        accessibilityLabel={`${I18n.t('delete')} ${I18n.t('addVoiceNote').toLowerCase()}`}
      >
        <MaterialIcons name="delete-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Кнопка действия внизу шторки
 *
 * @param {Object} props
 * @param {string} props.icon - имя значка MaterialIcons
 * @param {string} props.label - подпись, она же метка доступности
 * @param {Object} props.colors - палитра темы
 * @param {Function} props.onPress - нажатие
 */
function SheetButton({ icon, label, colors, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.action, { borderColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={20} color={colors.primaryAccent} />
      <Text style={[styles.actionText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 7, 14, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '80%',
  },
  grip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  coords: {
    ...numericAt(12),
    marginTop: 2,
  },
  body: {
    marginTop: spacing.lg,
  },
  bodyContent: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    // Доля ширины уменьшена на промежутки между миниатюрами: ровно треть не
    // учитывает gap, и третья миниатюра переносится на новую строку
    flexBasis: `${100 / COLUMNS - 3}%`,
    flexGrow: 0,
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  voiceWave: {
    flex: 1,
  },
  voiceDelete: {
    padding: spacing.xs,
  },
  duration: {
    ...numericAt(12),
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingWave: {
    flex: 1,
  },
  stopButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  notice: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
