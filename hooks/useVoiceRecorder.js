/**
 * Запись голосовой заметки для точки наблюдения
 *
 * Тап начинает, второй тап останавливает. Удержание, как в мессенджерах,
 * здесь не годится: описание скважины диктуют минуту, и всё это время нужно
 * держать палец, а случайный отрыв в перчатках обрывает запись.
 *
 * Волна строится по реальному сигналу: рекордер отдаёт metering в дБFS, он
 * снимается раз в METER_INTERVAL_MS и переводится в 0..1 (см. lib/waveform.js).
 *
 * Рекордер опрашивается здесь же, а не через `useAudioRecorderState`. Тот
 * держит таймер всё время жизни шторки и зовёт `getStatus` в том числе во
 * время остановки. На Android `getStatus` — синхронный вызов на JS-потоке: он
 * читает `MediaRecorder.maxAmplitude`, а `stop` в это же время на фоновом
 * потоке освобождает рекордер. Тик, попавший в это окно, бросал исключение
 * в таймере, и релизная сборка закрывалась — не каждый раз, а когда тик
 * совпадал с остановкой. Здесь опрос идёт только во время записи и снимается
 * до вызова `stop`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { condense, levelFromMetering } from '../lib/waveform';

/** Как часто снимается уровень сигнала */
export const METER_INTERVAL_MS = 100;

/**
 * Короче этого запись не останавливается
 *
 * `MediaRecorder.stop()` сразу после `start()` бросает «stop failed» и
 * оставляет пустой файл. Нажатие «стоп» раньше границы ждёт её.
 */
export const MIN_RECORDING_MS = 600;

/** Без isMeteringEnabled рекордер не отдаёт уровень, и волну рисовать нечем */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/** Режим звука без микрофона: проигрывание громко и через основной динамик */
const PLAYBACK_MODE = { allowsRecording: false, playsInSilentMode: true };

/**
 * Пауза на заданное время
 *
 * @param {number} ms - длительность
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @returns {Object} состояние и управление записью
 */
export default function useVoiceRecorder() {
  const recorder = useAudioRecorder(OPTIONS);

  const [isRecording, setIsRecording] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [levels, setLevels] = useState([]);
  const [denied, setDenied] = useState(false);

  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const levelsRef = useRef([]);
  const durationRef = useRef(0);
  // Защита от двойного нажатия: пока идёт start или stop, второе ничего не делает
  const busyRef = useRef(false);
  const recordingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // Экран закрыли посреди записи — таймер не должен пережить шторку
  useEffect(() => stopPolling, [stopPolling]);

  /** Один тик опроса: уровень в волну, длительность на экран */
  const poll = useCallback(() => {
    let status;
    try {
      status = recorder.getStatus();
    } catch {
      // Сорвавшийся тик пропускается: следующий через METER_INTERVAL_MS
      return;
    }
    const elapsed = Date.now() - startedAtRef.current;
    const duration = status?.durationMillis > 0 ? status.durationMillis : elapsed;

    durationRef.current = duration;
    levelsRef.current = [...levelsRef.current, levelFromMetering(status?.metering)];
    setDurationMillis(duration);
    setLevels(levelsRef.current);
  }, [recorder]);

  /**
   * Начинает запись
   *
   * @returns {Promise<boolean>} началась ли запись
   */
  const start = useCallback(async () => {
    if (busyRef.current || recordingRef.current) return false;
    busyRef.current = true;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        return false;
      }
      setDenied(false);

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      levelsRef.current = [];
      durationRef.current = 0;
      setLevels([]);
      setDurationMillis(0);

      try {
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (error) {
        // Микрофон отпускается и при сорвавшемся старте: иначе на iOS
        // заметки дальше играли бы тихо и через разговорный динамик
        await setAudioModeAsync(PLAYBACK_MODE).catch(() => {});
        throw error;
      }

      startedAtRef.current = Date.now();
      recordingRef.current = true;
      setIsRecording(true);
      stopPolling();
      timerRef.current = setInterval(poll, METER_INTERVAL_MS);
      return true;
    } finally {
      busyRef.current = false;
    }
  }, [recorder, poll, stopPolling]);

  /**
   * Останавливает запись и отдаёт готовую заметку
   *
   * @returns {Promise<{uri: string, durationMillis: number, waveform: number[]}|null>}
   */
  const stop = useCallback(async () => {
    if (busyRef.current || !recordingRef.current) return null;
    busyRef.current = true;
    try {
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed < MIN_RECORDING_MS) await wait(MIN_RECORDING_MS - elapsed);

      // Опрос снимается ДО нативной остановки — см. шапку модуля
      stopPolling();
      const duration = Math.round(
        Math.max(durationRef.current, Date.now() - startedAtRef.current)
      );
      const captured = levelsRef.current;
      recordingRef.current = false;
      setIsRecording(false);

      try {
        await recorder.stop();
      } finally {
        // Микрофон отпускается сразу: пока allowsRecording включён, iOS
        // выводит звук тихо и через разговорный динамик
        await setAudioModeAsync(PLAYBACK_MODE);
        levelsRef.current = [];
        setLevels([]);
      }

      const uri = recorder.uri;
      if (!uri) return null;
      return { uri, durationMillis: duration, waveform: condense(captured) };
    } finally {
      busyRef.current = false;
    }
  }, [recorder, stopPolling]);

  return {
    start,
    stop,
    isRecording,
    durationMillis,
    levels,
    denied,
  };
}
