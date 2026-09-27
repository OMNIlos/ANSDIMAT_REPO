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
  hasMapWork,
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

/**
 * Запускает скрипт моста в отдельном контексте, как его выполнил бы WebView
 *
 * @param {string} script - текст скрипта
 * @param {Object} [page] - окно страницы, если мост ставится в него повторно
 * @returns {{window: Object, posted: Array<Object>}} окно и отправленное хосту
 */
function runBridge(script, page) {
  const vm = require('vm');
  const posted = page?.posted ?? [];
  const window = page?.window ?? {
    ReactNativeWebView: { postMessage: (text) => posted.push(JSON.parse(text)) },
  };
  const document = {
    readyState: 'complete',
    documentElement: { style: { setProperty() {} }, classList: { contains: () => false } },
    addEventListener() {},
  };
  vm.runInNewContext(script, {
    window,
    document,
    localStorage: { setItem() {} },
    // В контексте vm нет браузерного btoa — даём тот же перевод, что в WebView
    btoa: (binary) => Buffer.from(binary, 'binary').toString('base64'),
  });
  return { window, posted };
}

test('мост сообщает о готовности, если страница уже загружена', () => {
  // После загрузки DOMContentLoaded уже прошёл: ждать его — значит не
  // дождаться никогда, и заглушка висела бы вечно
  const { posted } = runBridge(beforeContentScript({ dark: false, native: true }));

  expect(posted).toContainEqual({ type: 'ready' });
});

test('повторный запуск моста повторяет готовность и не теряет ожидающие ответы', async () => {
  // На Android мост ставится дважды — до загрузки и после неё: первый запуск
  // react-native-webview выполняет ненадёжно. Второй не должен затирать то,
  // что успел завести первый, — иначе ответ на выгрузку уйдёт в пустоту
  const script = beforeContentScript({ dark: false, native: true });
  const page = runBridge(script);
  const saved = page.window.hydroSaveExport('карта', '[]');
  const request = page.posted.find((message) => message.type === 'save');

  runBridge(script, page);
  page.window.__ansdHostReply(request.id, null);

  expect(page.posted.filter((message) => message.type === 'ready')).toHaveLength(2);
  await expect(saved).resolves.toBe(true);
});

test('подложка для АНСДИМАТ уходит обычной выгрузкой: растр, .aprj в cp1251 и привязка', () => {
  // Скрипт поставки сохраняет её через hydroSaveAnsd (в настольной оболочке
  // это electronAPI.saveAnsd), а без обработчика — ссылками <a download>,
  // которые в WebView не делают ничего: плитка «Подготовить карту-подложку»
  // молча не сохраняла бы файлов
  const page = runBridge(beforeContentScript({ dark: false, native: true }));

  page.window.hydroSaveAnsd('Карта', 'QUJD', 'Скв-1 №2\r\n', '1.5\n', 'PROJCS');

  const request = page.posted.find((message) => message.type === 'save');
  const files = JSON.parse(request.files);
  expect(request.name).toBe('Карта');
  expect(files.map((file) => file.name)).toEqual(['Карта.jpg', 'Карта.aprj', 'Карта.jgw', 'Карта.prj']);
  expect(files[0].b64).toBe('QUJD');
  // Настольный АНСДИМАТ читает .aprj в cp1251: «С» = 0xD1, «№» = 0xB9
  expect([...Buffer.from(files[1].b64, 'base64')]).toEqual([
    0xd1, 0xea, 0xe2, 0x2d, 0x31, 0x20, 0xb9, 0x32, 0x0d, 0x0a,
  ]);
  expect(Buffer.from(files[2].b64, 'base64').toString()).toBe('1.5\n');
  expect(Buffer.from(files[3].b64, 'base64').toString()).toBe('PROJCS');
});

test('без файлов привязки уходят только растр и .aprj', () => {
  const page = runBridge(beforeContentScript({ dark: false, native: true }));

  page.window.hydroSaveAnsd('Карта', 'QUJD', 'x', '', '');

  const files = JSON.parse(page.posted.find((message) => message.type === 'save').files);
  expect(files.map((file) => file.name)).toEqual(['Карта.jpg', 'Карта.aprj']);
});

test('в вебе подложка сохраняется самой страницей', () => {
  expect(beforeContentScript({ dark: false, native: false })).not.toContain('hydroSaveAnsd');
});

/**
 * Хранилище страницы, как его отдаёт zustand: состояние и подписчики
 *
 * @param {Object} initial - начальное состояние
 * @returns {Object} хранилище с методом set для теста
 */
function fakeStore(initial) {
  let state = initial;
  const listeners = [];
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state));
    },
  };
}

/** Окно страницы с хранилищем и журналом отправленного хосту */
function pageWith(store) {
  const posted = [];
  const window = {
    ReactNativeWebView: { postMessage: (text) => posted.push(JSON.parse(text)) },
    __hydroZ: store,
  };
  return { window, posted };
}

const works = (posted) => posted.filter((message) => message.type === 'work');

test('мост сообщает приложению, когда на карте появляется и пропадает работа', () => {
  // Страница ничего не хранит: без этого сигнала «Назад» стирало бы скважины
  // и построенную карту молча
  const store = fakeStore({ wells: [], table: null });
  const page = runBridge(beforeContentScript({ dark: false, native: true }), pageWith(store));

  store.set({ wells: [{ name: 'СКВ-1' }] });
  // Ответ не изменился — второй раз не сообщается
  store.set({ wells: [{ name: 'СКВ-1' }, { name: 'СКВ-2' }] });
  store.set({ wells: [] });

  expect(works(page.posted)).toEqual([
    { type: 'work', has: false },
    { type: 'work', has: true },
    { type: 'work', has: false },
  ]);
});

test('повторный запуск моста не подписывается на хранилище второй раз', () => {
  const script = beforeContentScript({ dark: false, native: true });
  const store = fakeStore({ wells: [] });
  const page = runBridge(script, pageWith(store));

  runBridge(script, page);
  store.set({ wells: [{ name: 'СКВ-1' }] });

  expect(works(page.posted).filter((message) => message.has)).toHaveLength(1);
});

test('хранилище, появившееся после первого запуска, подхватывает второй', () => {
  // Первый запуск на Android мог попасть в документ, где страницы ещё нет
  const script = beforeContentScript({ dark: false, native: true });
  const page = runBridge(script, pageWith(undefined));
  const store = fakeStore({ wells: [{ name: 'СКВ-1' }] });
  page.window.__hydroZ = store;

  runBridge(script, page);

  expect(works(page.posted)).toEqual([{ type: 'work', has: true }]);
});

test('мост и hasMapWork считают работу одинаково', () => {
  // Условие записано дважды: в скрипте для WebView и в модуле для веба
  const states = [
    {},
    { table: { rows: [] } },
    { wells: [{}] },
    { drawings: [{}] },
    { faults: [{}] },
    { clipPolygons: [{}] },
    { rasters: [{}] },
    { table: null, wells: [], drawings: [], faults: [], clipPolygons: [], rasters: [] },
    { wells: 'не список' },
  ];
  const script = beforeContentScript({ dark: false, native: true });

  for (const state of states) {
    const page = runBridge(script, pageWith(fakeStore(state)));
    expect([state, works(page.posted)[0].has]).toEqual([state, hasMapWork(state)]);
  }
  expect(hasMapWork(null)).toBe(false);
  expect(hasMapWork({ wells: [{}] })).toBe(true);
});
