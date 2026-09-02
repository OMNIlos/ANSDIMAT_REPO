/**
 * Запись голосовой заметки для точки наблюдения
 *
 * Тап начинает, второй тап останавливает. Удержание, как в мессенджерах,
 * здесь не годится: описание скважины диктуют минуту, и всё это время нужно
 * держать палец, а случайный отрыв в перчатках обрывает запись.
 *
 * Волна строится по реальному сигналу: рекордер отдаёт metering в дБFS, он
 * снимается раз в METER_INTERVAL_MS и переводится в 0..1 (см. lib/waveform.js).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { condense, levelFromMetering } from '../lib/waveform';

/** Как часто снимается уровень сигнала */
export const METER_INTERVAL_MS = 100;

/** Без isMeteringEnabled рекордер не отдаёт уровень, и волну рисовать нечем */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * @returns {Object} состояние и управление записью
 */
export default function useVoiceRecorder() {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, METER_INTERVAL_MS);

  const [levels, setLevels] = useState([]);
  const [denied, setDenied] = useState(false);

  // Уровни нужны в stop, но не должны попадать в его зависимости: иначе
  // колбэк пересоздавался бы десять раз в секунду
  const levelsRef = useRef([]);
  levelsRef.current = levels;

  // Уровень копится, пока идёт запись. durationMillis в зависимостях
  // обязателен: metering может совпасть с прошлым значением два тика подряд,
  // и без него эффект бы не сработал, а в волне появился бы провал
  useEffect(() => {
    if (!state.isRecording) return;
    setLevels((prev) => [...prev, levelFromMetering(state.metering)]);
  }, [state.isRecording, state.metering, state.durationMillis]);

  /**
   * Начинает запись
   *
   * @returns {Promise<boolean>} началась ли запись
   */
  const start = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return false;
    }
    setDenied(false);

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setLevels([]);
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }, [recorder]);

  /**
   * Останавливает запись и отдаёт готовую заметку
   *
   * @returns {Promise<{uri: string, durationMillis: number, waveform: number[]}|null>}
   */
  const stop = useCallback(async () => {
    const durationMillis = Math.round(state.durationMillis ?? 0);
    const captured = levelsRef.current;

    await recorder.stop();
    // Микрофон отпускается сразу: пока allowsRecording включён, iOS выводит
    // звук тихо и через разговорный динамик, и записанное не прослушать
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    setLevels([]);

    const uri = recorder.uri;
    if (!uri) return null;

    return { uri, durationMillis, waveform: condense(captured) };
  }, [recorder, state.durationMillis]);

  return {
    start,
    stop,
    isRecording: !!state.isRecording,
    durationMillis: state.durationMillis ?? 0,
    levels,
    denied,
  };
}
