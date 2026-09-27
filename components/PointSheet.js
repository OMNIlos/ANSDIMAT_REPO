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

import React, { useEffect, useRef, useState } from 'react';
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
import SettingsLink from './ui/SettingsLink';
import usePhotoCapture from '../hooks/usePhotoCapture';
import useVoiceRecorder from '../hooks/useVoiceRecorder';
import useVoicePlayback from '../hooks/useVoicePlayback';
import { ATTACHMENT_KINDS } from '../db/attachments';
import { formatDuration } from '../lib/waveform';
import { spacing, radius, type, elevation, numericAt, fontFamily } from '../theme';

/** Миниатюр в ряду: на телефоне шире трёх они уже не читаются */
const COLUMNS = 3;

/**
 * @param {Object} props
 * @param {Object|null} props.point - точка, чьи вложения показаны
 * @param {Array} props.attachments - вложения этой точки
 * @param {boolean} props.visible - показана ли шторка
 * @param {Function} props.onClose - закрытие
 * @param {Function} props.onAdd - новое вложение: {kind, uri, durationMillis?, waveform?,
 *   pointId?} — pointId у голосовой заметки: точка, у которой её начали записывать
 * @param {Function} props.onDelete - удаление вложения
 */
export default function PointSheet({ point, attachments, visible, onClose, onAdd, onDelete }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { capture, denied: photoDenied } = usePhotoCapture();
  const recorder = useVoiceRecorder();
  const playback = useVoicePlayback();

  // Выбор источника снимка: раскрывается на месте кнопки «Фото»
  const [pickingSource, setPickingSource] = useState(false);
  // Открытый на весь экран снимок
  const [viewerIndex, setViewerIndex] = useState(null);
  // Вложение, для которого запрошено удаление
  const [pendingDelete, setPendingDelete] = useState(null);
  // Сбой записи: отказ микрофона, занятое устройство, отказ хранилища
  const [recordFailed, setRecordFailed] = useState(false);

  // Точка, у которой начали запись. Шторку могут закрыть или переключить на
  // другую точку раньше, чем запись остановят, — заметка всё равно должна
  // лечь туда, где её начали
  const recordingPointRef = useRef(null);

  /**
   * Останавливает запись и сохраняет заметку к точке, у которой её начали
   *
   * @returns {Promise<void>}
   */
  const finishRecording = async () => {
    // Запасной вариант — текущая точка: запись могла начаться до того, как
    // шторка запомнила свою (например, после горячей перезагрузки)
    const pointId = recordingPointRef.current ?? point?.id ?? null;
    recordingPointRef.current = null;
    const recorded = await recorder.stop();
    if (!recorded || !pointId) return;
    await onAdd({
      kind: ATTACHMENT_KINDS.AUDIO,
      uri: recorded.uri,
      durationMillis: recorded.durationMillis,
      waveform: recorded.waveform,
      pointId,
    });
  };

  /**
   * Запись, которую никто не остановил, — останавливается и сохраняется
   *
   * Закрытая шторка раньше глушила только проигрывание: микрофон продолжал
   * писать невидимо, и заметка выходила на пять минут вместо нескольких
   * секунд. Сохраняем, а не выбрасываем: лишнюю заметку удалить можно,
   * потерянную в поле не восстановить.
   */
  const finishRef = useRef(finishRecording);
  finishRef.current = finishRecording;
  const settleRecording = () => {
    if (!recorder.isRecording) return;
    finishRef.current().catch(() => setRecordFailed(true));
  };
  const settleRef = useRef(settleRecording);
  settleRef.current = settleRecording;

  // Скрытая шторка не должна ни доигрывать заметку в пустоту, ни писать
  // дальше: скрыть её может не только кнопка, но и экран, переключившийся на
  // другую точку
  const stopPlayback = playback.stop;
  useEffect(() => {
    if (visible) return;
    stopPlayback();
    settleRef.current();
  }, [visible, stopPlayback]);

  /** Закрывает шторку, заглушив проигрывание и остановив запись */
  const close = () => {
    playback.stop();
    settleRecording();
    onClose();
  };

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
   *
   * Сбой ловится и показывается строкой на шторке. Без этого отказ уходил
   * в несопровождаемое отклонение промиса: кнопка не срабатывала, и понять,
   * почему, было нельзя ни в поле, ни по логам.
   */
  const toggleRecording = async () => {
    try {
      if (!recorder.isRecording) {
        setRecordFailed(false);
        // Запись и проигрывание делят аудиосессию: заметка, игравшая под
        // запись, попала бы в неё же через микрофон
        playback.stop();
        recordingPointRef.current = point?.id ?? null;
        await recorder.start();
        return;
      }

      await finishRecording();
    } catch {
      setRecordFailed(true);
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    setViewerIndex(null);
    if (target && target.id === playback.activeId) playback.stop();
    if (target) await onDelete(target);
  };

  const denialNotice =
    (photoDenied === 'camera' && I18n.t('cameraDenied')) ||
    (photoDenied === 'library' && I18n.t('galleryDenied')) ||
    (recorder.denied && I18n.t('microphoneDenied')) ||
    (recordFailed && I18n.t('recordingFailed')) ||
    '';

  if (!point) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
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

              {records.map((record) => {
                const active = playback.activeId === record.id;
                return (
                  <VoiceRow
                    key={record.id}
                    record={record}
                    colors={colors}
                    active={active}
                    playing={active && playback.playing}
                    progress={active ? playback.progress : 1}
                    onToggle={() => playback.toggle(record)}
                    onDelete={() => setPendingDelete(record)}
                  />
                );
              })}
            </ScrollView>

            {!!denialNotice && (
              <Text style={[type.caption, styles.notice, { color: colors.error }]}>
                {denialNotice}
              </Text>
            )}
            {/* Отказ в доступе чинится только в системных настройках */}
            {(!!photoDenied || recorder.denied) && <SettingsLink color={colors.error} />}

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
 * У играющей заметки волна закрашивается по мере проигрывания — AudioWave
 * для этого и принимает долю пройденного.
 *
 * @param {Object} props
 * @param {Object} props.record - вложение вида audio
 * @param {Object} props.colors - палитра темы
 * @param {boolean} props.active - заметка стоит в плеере
 * @param {boolean} props.playing - и сейчас играет
 * @param {number} props.progress - доля проигранного, 0..1
 * @param {Function} props.onToggle - играть или поставить на паузу
 * @param {Function} props.onDelete - запрос удаления
 */
function VoiceRow({ record, colors, active, playing, progress, onToggle, onDelete }) {
  return (
    <View style={[styles.voiceRow, { backgroundColor: colors.surfaceSunken }]}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.voicePlay}
        accessibilityRole="button"
        accessibilityLabel={playing ? I18n.t('pauseRecording') : I18n.t('playRecording')}
        accessibilityState={{ selected: active }}
      >
        <MaterialIcons
          name={playing ? 'pause' : 'play-arrow'}
          size={22}
          color={colors.primaryAccent}
        />
      </TouchableOpacity>
      <AudioWave
        levels={record.waveform}
        progress={progress}
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
  // Затемнения нет вовсе. Шторка выезжает вместе с подложкой, поэтому любая
  // заливка появлялась бы разом на полной непрозрачности — резкий тёмный
  // прямоугольник поверх экрана. Слой читается тенью и границей самой шторки,
  // а прозрачная область всё так же ловит нажатие мимо и закрывает её
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    // Волосяной границы мало, когда за шторкой не затемнённый, а обычный
    // экран: край должен читаться сам по себе
    borderTopWidth: 1,
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
  voicePlay: {
    padding: spacing.xs,
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
    fontFamily: fontFamily.bold,
  },
  notice: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
