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
 * @returns {string} текст скрипта
 */
export function beforeContentScript({ dark, native }) {
  return `
(function(){
  try { localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(dark ? 'dark' : 'light')}); } catch (e) {}

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
`
    : ''
}

  function ready(){ send({ type: 'ready' }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
true;
`;
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
