/**
 * Мост между приложением и построителем карт AnsSurf
 *
 * AnsSurf — готовое веб-приложение в WebView. Разговаривать с ним приходится
 * через внедрённый скрипт: он объявляет хост-обработчики, которые страница
 * ищет у себя в `window`, и пересылает вызовы наружу сообщениями.
 *
 * Набор обработчиков у страницы шире — выбор растра, поиск файлов-спутников,
 * открытие проекта снаружи, — но все они проверяются через
 * `typeof … === "function"`, и без них страница берёт свой обычный путь:
 * системное окно выбора файла. Здесь объявлено только то, что без хоста
 * действительно ломается.
 *
 * Общий модуль на обе платформы: на устройстве скрипт внедряет WebView, в вебе
 * — тот же текст выполняет iframe. Разойдись они, ошибка обмена искалась бы
 * дважды.
 */

/** Ключ, которым страница хранит выбранную тему */
const THEME_KEY = 'hydro-theme';

/**
 * Скрипт, который выполняется до скриптов страницы
 *
 * Тема ставится именно здесь, записью в хранилище: первый же встроенный скрипт
 * страницы читает этот ключ и вешает класс `dark` на корень. Переключить тему
 * после загрузки тоже можно, но тогда тёмная страница успевает моргнуть белым.
 *
 * @param {Object} options
 * @param {boolean} options.dark - тёмная тема
 * @param {boolean} options.native - внедряется в WebView, а не в iframe
 * @param {number} options.menuInset - высота плавающего меню приложения, px
 * @returns {string} текст скрипта
 */
export function beforeContentScript({ dark, native, menuInset = 0 }) {
  return `
(function(){
  // Мост ставится дважды: до загрузки страницы и после неё. На Android первый
  // запуск react-native-webview выполняет ненадёжно — из onPageStarted, и он то
  // и дело попадает в прежний, пустой документ. Второй запуск находит мост уже
  // стоящим и только повторяет «готово»: заведённые первым ожидания ответов
  // затирать нельзя, иначе ответ на выгрузку ушёл бы в пустоту
  if (window.__ansdBridge) { window.__ansdBridge.ready(); return; }

  try { localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(dark ? 'dark' : 'light')}); } catch (e) {}

  // Высота плавающего меню приложения: страница отводит под него место в
  // панели шага. Сама она этой высоты не знает — та зависит от системного
  // отступа снизу, а его видит только приложение
  document.documentElement.style.setProperty('--ansd-menu-inset', ${JSON.stringify(
    `${Math.round(menuInset)}px`
  )});

  var pending = {};
  var seq = 0;

  function send(message){
    var text = JSON.stringify(message);
    ${
      native
        ? 'if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);'
        : 'if (window.parent && window.parent !== window) window.parent.postMessage(text, "*");'
    }
  }

  /** Ответ хоста на запрос: снимает ожидание по его номеру */
  window.__ansdHostReply = function(id, error){
    var waiter = pending[id];
    if (!waiter) return;
    delete pending[id];
    if (error) waiter.reject(new Error(error)); else waiter.resolve(true);
  };

  /** Смена темы на ходу — из настроек приложения, пока карта открыта */
  window.__ansdSetTheme = function(dark){
    var root = document.documentElement;
    if (!root) return;
    if (!!root.classList.contains('dark') === !!dark) return;
    if (typeof window.__hydroToggleTheme === 'function') window.__hydroToggleTheme();
  };

${
  native
    ? `
  // Страница отдаёт готовое обычным <a download>. В WebView такая ссылка не
  // делает ничего, поэтому выгрузку забирает приложение. В вебе обработчика
  // нет намеренно: там скачивание работает само, и перехватывать его незачем
  window.hydroSaveExport = function(name, filesJson){
    return new Promise(function(resolve, reject){
      var id = 'e' + (++seq);
      pending[id] = { resolve: resolve, reject: reject };
      send({ type: 'save', id: id, name: String(name || 'anssurf'), files: filesJson });
    });
  };

  // Подложку для расчётных модулей АНСДИМАТ скрипт поставки сохраняет своим
  // путём — через hydroSaveAnsd (в настольной оболочке это electronAPI), а
  // без обработчика скачивает четыре файла ссылками <a download>, которые в
  // WebView не делают ничего. Здесь те же файлы уходят обычной выгрузкой:
  // растр, .aprj — в cp1251, как его читает настольный АНСДИМАТ и как пишет
  // его скрипт поставки, — и файлы привязки .jgw и .prj
  function cp1251(text){
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i), b;
      if (c < 128) b = c;
      else if (c >= 0x0410 && c <= 0x044F) b = c - 0x0410 + 0xC0;
      else if (c === 0x0401) b = 0xA8;
      else if (c === 0x0451) b = 0xB8;
      else if (c === 0x0404) b = 0xAA;
      else if (c === 0x0454) b = 0xBA;
      else if (c === 0x0406) b = 0xB2;
      else if (c === 0x0456) b = 0xB3;
      else if (c === 0x0407) b = 0xAF;
      else if (c === 0x0457) b = 0xBF;
      else if (c === 0x040E) b = 0xA1;
      else if (c === 0x045E) b = 0xA2;
      else if (c === 0x0490) b = 0xA5;
      else if (c === 0x0491) b = 0xB4;
      else if (c === 0x2116) b = 0xB9;
      else if (c === 0x00A0) b = 0xA0;
      else if (c === 0x00AB) b = 0xAB;
      else if (c === 0x00BB) b = 0xBB;
      else if (c === 0x2013) b = 0x96;
      else if (c === 0x2014) b = 0x97;
      else if (c === 0x2018 || c === 0x2019) b = 0x27;
      else if (c === 0x201C || c === 0x201D) b = 0x22;
      else b = 0x3F;
      out.push(String.fromCharCode(b));
    }
    return out.join('');
  }
  function utf8(text){ return unescape(encodeURIComponent(String(text))); }

  window.hydroSaveAnsd = function(name, jpgB64, aprj, jgw, prj){
    var base = String(name || 'ansdimat');
    var files = [{ name: base + '.jpg', b64: String(jpgB64 || '') }];
    if (aprj) files.push({ name: base + '.aprj', b64: btoa(cp1251(String(aprj))) });
    if (jgw) files.push({ name: base + '.jgw', b64: btoa(utf8(jgw)) });
    if (prj) files.push({ name: base + '.prj', b64: btoa(utf8(prj)) });
    return window.hydroSaveExport(base, JSON.stringify(files));
  };
`
    : ''
}

  // Есть ли на карте работа. Страница ничего не хранит, и уход с экрана
  // стирал бы скважины и построенную карту без спроса — приложение
  // переспрашивает, но только когда терять есть что. Хранилище страница
  // открывает сама (window.__hydroZ); сообщение уходит при смене ответа.
  // Условие то же, что в hasMapWork ниже в модуле — их сверяет тест
  var workSent = null;
  var watching = false;
  function any(list){ return Array.isArray(list) && list.length > 0; }
  function reportWork(state){
    var has = !!state && (!!state.table || any(state.wells) || any(state.drawings) ||
      any(state.faults) || any(state.clipPolygons) || any(state.rasters));
    if (has === workSent) return;
    workSent = has;
    send({ type: 'work', has: has });
  }
  function watchWork(){
    var store = window.__hydroZ;
    if (watching || !store || typeof store.subscribe !== 'function') return;
    watching = true;
    reportWork(store.getState());
    store.subscribe(reportWork);
  }

  function ready(){ watchWork(); send({ type: 'ready' }); }
  window.__ansdBridge = { ready: ready };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
true;
`;
}

/**
 * Есть ли на карте работа, которую жалко потерять
 *
 * Таблица уровней, скважины, чертёж, разломы, границы области и растры —
 * всё, что человек загрузил или нарисовал сам. Построенные изолинии отдельно
 * не проверяются: без скважин их не бывает.
 *
 * Веб-версия спрашивает хранилище страницы напрямую, на устройстве то же
 * условие стоит в скрипте-мосте.
 *
 * @param {Object} state - состояние хранилища страницы (`__hydroZ.getState()`)
 * @returns {boolean} есть ли работа
 */
export function hasMapWork(state) {
  if (!state) return false;
  const any = (list) => Array.isArray(list) && list.length > 0;
  return (
    !!state.table ||
    any(state.wells) ||
    any(state.drawings) ||
    any(state.faults) ||
    any(state.clipPolygons) ||
    any(state.rasters)
  );
}

/**
 * Скрипт, отвечающий странице на её запрос
 *
 * @param {string} id - номер запроса
 * @param {string|null} error - текст ошибки или null, если всё получилось
 * @returns {string} текст скрипта
 */
export function replyScript(id, error) {
  return `window.__ansdHostReply(${JSON.stringify(id)}, ${
    error ? JSON.stringify(String(error)) : 'null'
  }); true;`;
}

/**
 * Скрипт, задающий странице высоту плавающего меню
 *
 * @param {number} menuInset - высота меню, px
 * @returns {string} текст скрипта
 */
export function menuInsetScript(menuInset) {
  return `document.documentElement.style.setProperty('--ansd-menu-inset', ${JSON.stringify(
    `${Math.round(menuInset)}px`
  )}); true;`;
}

/**
 * Скрипт, переключающий тему открытой страницы
 *
 * @param {boolean} dark - тёмная тема
 * @returns {string} текст скрипта
 */
export function themeScript(dark) {
  return `window.__ansdSetTheme(${dark ? 'true' : 'false'}); true;`;
}

/**
 * Разбирает сообщение от страницы
 *
 * Чужое или испорченное сообщение — не повод ронять экран: в WebView попадает
 * и то, что шлёт сама страница по своим надобностям.
 *
 * @param {*} raw - содержимое сообщения
 * @returns {Object|null} разобранное сообщение или null
 */
export function parseMessage(raw) {
  if (raw == null) return null;
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return null;
  return data;
}
