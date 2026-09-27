/**
 * Проигрывание голосовых заметок точки
 *
 * Один плеер на шторку, а не на строку: плеер на каждую заметку завёл бы по
 * нативному проигрывателю на запись, хотя слушают их всё равно по одной.
 * Статус приходит событиями плеера — опроса здесь нет.
 *
 * Хук знает, что играет и где остановиться. Когда глушить звук — при
 * закрытии шторки, начале записи, удалении заметки — решает шторка.
 */

import { useCallback, useEffect, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

/**
 * @returns {{activeId: string|null, playing: boolean, progress: number,
 *   toggle: Function, stop: Function}} что играет и управление
 */
export default function useVoicePlayback() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState(null);

  const finished = !!status?.didJustFinish;
  const playing = !!status?.playing;

  // Доигравшая заметка встаёт в начало: плеер остаётся в конце записи, и
  // следующее нажатие не проиграло бы ничего
  useEffect(() => {
    if (!finished) return;
    player.pause();
    Promise.resolve(player.seekTo(0)).catch(() => {});
    setActiveId(null);
  }, [finished, player]);

  /**
   * Играет заметку или ставит её на паузу
   *
   * @param {{id: string, uri: string}} record - голосовая заметка
   * @returns {Promise<void>}
   */
  const toggle = useCallback(
    async (record) => {
      if (record.id === activeId) {
        if (playing) player.pause();
        else player.play();
        return;
      }
      // Если в этом сеансе ещё ничего не записывали, режим звука не выставлен,
      // и на iPhone бесшумный переключатель глушит заметку
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      player.replace({ uri: record.uri });
      player.play();
      setActiveId(record.id);
    },
    [activeId, playing, player]
  );

  /** Глушит играющую заметку */
  const stop = useCallback(() => {
    if (activeId === null) return;
    player.pause();
    setActiveId(null);
  }, [activeId, player]);

  const duration = status?.duration > 0 ? status.duration : 0;
  const progress =
    activeId !== null && duration > 0 ? Math.min(1, (status?.currentTime ?? 0) / duration) : 0;

  return {
    activeId,
    playing: activeId !== null && playing,
    progress,
    toggle,
    stop,
  };
}
