/**
 * Приём файлов проекта, открытых снаружи
 *
 * Живёт выше навигатора по необходимости: файл прилетает в любой момент —
 * когда открыт произвольный экран и даже пока показывается заставка. Экран
 * такое поймать не может, он к этому времени может быть ещё не смонтирован.
 *
 * Провайдер только готовит данные и держит состояние. Показывает их
 * `components/ImportProjectDialog`, чтобы разбор файла не был перемешан
 * с разметкой.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { findProjectBySourceId, importProject } from '../db/projects';
import { navigate } from '../navigation/navigationRef';
import { classifyIncomingUrl, discardIncomingFile, loadProjectFile, pickProjectFile } from './incomingFile';
import { summarizePayload } from './projectFile';

const ImportContext = createContext({
  pending: null,
  busy: false,
  openFromPicker: async () => {},
  confirm: async () => {},
  openExisting: () => {},
  dismiss: () => {},
});

export function ImportProvider({ children }) {
  // null — нечего показывать. Иначе:
  //   { status: 'loading' }
  //   { status: 'error', error, uri }
  //   { status: 'ready', payload, meta, summary, existing, uri }
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  // Одну и ту же ссылку система присылает дважды: сначала как «с чего
  // приложение запустилось», потом событием, если оно уже было запущено.
  // Без этой отметки диалог открывался бы поверх самого себя
  const lastUrlRef = useRef(null);

  const handleUri = useCallback(async ({ uri, certain }) => {
    if (!uri || lastUrlRef.current === uri) return;
    lastUrlRef.current = uri;

    setPending({ status: 'loading', uri });

    const result = await loadProjectFile(uri);

    if (!result.ok) {
      // Ссылка без обещания в имени: внутри оказалось не то, и сказать
      // об этом нечего — пользователь ничего такого не просил
      if (!certain) {
        setPending(null);
        lastUrlRef.current = null;
        return;
      }
      setPending({ status: 'error', error: result.error, uri });
      return;
    }

    // Журнал из того же файла мог уже приехать: либо его импортировали
    // раньше, либо он пришёл синхронизацией с того же аккаунта
    let existing = null;
    try {
      existing = await findProjectBySourceId(result.payload.sourceId);
    } catch {
      // База недоступна — предложим обычный импорт, он же и сообщит об ошибке
    }

    setPending({
      status: 'ready',
      payload: result.payload,
      meta: result.meta,
      summary: summarizePayload(result.payload),
      existing,
      uri,
    });
  }, []);

  // Ссылка, с которой приложение запустили, и ссылки, приходящие на ходу
  useEffect(() => {
    let cancelled = false;

    Linking.getInitialURL()
      .then((url) => {
        const incoming = classifyIncomingUrl(url);
        if (incoming && !cancelled) handleUri(incoming);
      })
      .catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const incoming = classifyIncomingUrl(url);
      if (incoming) handleUri(incoming);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [handleUri]);

  /** Выбор файла вручную — основной путь на Android */
  const openFromPicker = useCallback(async () => {
    try {
      const picked = await pickProjectFile();
      if (!picked) return;
      // Тот же файл можно выбрать повторно осознанно, поэтому отметка
      // о прошлой ссылке здесь сбрасывается
      lastUrlRef.current = null;
      await handleUri(picked);
    } catch {
      setPending({ status: 'error', error: 'read-failed', uri: null });
    }
  }, [handleUri]);

  const dismiss = useCallback(() => {
    setPending(null);
    lastUrlRef.current = null;
  }, []);

  /** Открывает журнал, который уже есть, ничего не импортируя */
  const openExisting = useCallback(() => {
    const id = pending?.existing?.id;
    dismiss();
    if (id) navigate('DataProcessing', { projectId: id });
  }, [pending, dismiss]);

  /**
   * Разворачивает файл в журнал
   *
   * @param {'copy'|'replace'} mode - создать копию или заменить существующий
   */
  const confirm = useCallback(
    async (mode = 'copy') => {
      if (pending?.status !== 'ready' || busy) return;

      setBusy(true);
      try {
        const replaceId = mode === 'replace' ? pending.existing?.id : undefined;
        const { id } = await importProject(pending.payload, { mode, replaceId });

        // Копию, оставленную системой, убираем только после удачного
        // импорта: иначе повторить попытку было бы уже не из чего
        await discardIncomingFile(pending.uri);

        setPending(null);
        lastUrlRef.current = null;
        navigate('DataProcessing', { projectId: id });
      } catch {
        setPending((current) =>
          current ? { status: 'error', error: 'invalid', uri: current.uri } : current
        );
      } finally {
        setBusy(false);
      }
    },
    [pending, busy]
  );

  return (
    <ImportContext.Provider value={{ pending, busy, openFromPicker, confirm, openExisting, dismiss }}>
      {children}
    </ImportContext.Provider>
  );
}

/**
 * Доступ к приёму файлов проекта
 *
 * @returns {Object} состояние и действия импорта
 */
export function useImport() {
  return useContext(ImportContext);
}
