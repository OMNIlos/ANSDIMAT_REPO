/**
 * Мост к построителю карт AnsSurf
 *
 * Проверяется договор со страницей, которую мы не писали и править не можем:
 * имена обработчиков, которые она ищет у себя в `window`, и ключ, по которому
 * читает тему. Ошибка здесь не роняет ничего — она тихо отключает выгрузку
 * или оставляет тёмное приложение со светлой картой.
 */

import {
  beforeContentScript,
  parseMessage,
  replyScript,
  themeScript,
} from '../anssurfBridge';

test('тема кладётся в хранилище до скриптов страницы', () => {
  // Самый первый встроенный скрипт страницы читает этот ключ и вешает класс
  // на корень: поставленная позже тёмная тема моргнула бы белым
  const script = beforeContentScript({ dark: true, native: true });

  expect(script).toContain('localStorage.setItem("hydro-theme", "dark")');
});

test('светлая тема пишется явно, а не отсутствием ключа', () => {
  const script = beforeContentScript({ dark: false, native: true });

  expect(script).toContain('localStorage.setItem("hydro-theme", "light")');
});

test('на устройстве объявляется перехват выгрузки', () => {
  // Страница отдаёт готовое через <a download>; в WebView такая ссылка
  // не делает ничего, и без обработчика экспорт молча пропадает
  const script = beforeContentScript({ dark: false, native: true });

  expect(script).toContain('window.hydroSaveExport');
  expect(script).toContain('window.ReactNativeWebView.postMessage');
});

test('в вебе выгрузка не перехватывается', () => {
  // Там скачивание работает само, и перехват только отнял бы у страницы
  // её собственный, уже рабочий путь
  const script = beforeContentScript({ dark: false, native: false });

  expect(script).not.toContain('window.hydroSaveExport');
  expect(script).toContain('window.parent.postMessage');
});

test('страница получает способ ответить хосту и сменить тему', () => {
  const script = beforeContentScript({ dark: false, native: true });

  expect(script).toContain('window.__ansdHostReply');
  expect(script).toContain('window.__ansdSetTheme');
  expect(script).toContain('__hydroToggleTheme');
});

test('ответ хоста передаёт ошибку строкой, а успех — пустотой', () => {
  expect(replyScript('e1', null)).toContain('__ansdHostReply("e1", null)');
  expect(replyScript('e1', 'нет места')).toContain('"e1", "нет места"');
});

test('переключение темы зовёт установщик страницы', () => {
  expect(themeScript(true)).toContain('__ansdSetTheme(true)');
  expect(themeScript(false)).toContain('__ansdSetTheme(false)');
});

test('сообщение разбирается из строки и из объекта', () => {
  expect(parseMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
  expect(parseMessage({ type: 'save', id: 'e1' })).toEqual({ type: 'save', id: 'e1' });
});

test('чужое сообщение не роняет экран', () => {
  // В WebView попадает и то, что страница шлёт по своим надобностям
  expect(parseMessage('не json')).toBeNull();
  expect(parseMessage(null)).toBeNull();
  expect(parseMessage('{"нет":"типа"}')).toBeNull();
  expect(parseMessage(42)).toBeNull();
});
