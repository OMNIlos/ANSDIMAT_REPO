/*
 * Поведение AnsSurf внутри приложения
 *
 * Скин (`tools/anssurf-skin.css`) правит вид, а здесь то немногое, что CSS
 * не умеет. Скрипт встраивается сборкой `tools/build-anssurf.js` первым в
 * `<head>` — раньше скриптов поставки — и работает одинаково в WebView на
 * устройстве и в iframe веб-сборки.
 *
 * Внутри не должно встречаться закрывающего тега скрипта: сборка встраивает
 * текст как есть и проверяет это.
 */
(function () {
  'use strict';

  /*
   * Прокрутка к началу при смене шага.
   *
   * Поставка при переходе между шагами зовёт `window.scrollTo(0, 0)`. Но в
   * десктопной теме прокручивается не окно, а колонка `main`, и вызов уходит
   * в пустоту: второй шаг открывался там, где человек бросил первый, — с
   * середины списка скважин, без карты на экране. Поэтому возврат окна к
   * началу возвращает к началу и колонку.
   */
  var scrollWindow = window.scrollTo;
  window.scrollTo = function (a, b) {
    try {
      var top = a !== null && typeof a === 'object' ? a.top : b;
      if (top === 0) {
        var main = document.querySelector('#root > div > main');
        if (main) main.scrollTop = 0;
      }
    } catch (e) {
      /* колонки ещё нет — прокручивать нечего */
    }
    return scrollWindow.apply(window, arguments);
  };

  /*
   * Контекстное меню карты в пределах экрана.
   *
   * Меню «Добавить скважину» встаёт ровно в точку нажатия. У правого края
   * телефона половина его уходила за экран, а долгое нажатие на Android
   * вызывает то же меню, что правая кнопка мыши. Сборка подключает функцию
   * к меню как ref: после отрисовки меню сдвигается внутрь родителя.
   */
  window.__ansdClampMenu = function (menu) {
    if (!menu) return;
    var parent = menu.offsetParent;
    if (!parent) return;
    var gap = 8;
    var maxLeft = parent.clientWidth - menu.offsetWidth - gap;
    var maxTop = parent.clientHeight - menu.offsetHeight - gap;
    if (menu.offsetLeft > maxLeft) menu.style.left = Math.max(gap, maxLeft) + 'px';
    if (menu.offsetTop > maxTop) menu.style.top = Math.max(gap, maxTop) + 'px';
  };

  /*
   * Битая картинка не показывается.
   *
   * Картинки поставки сборка встраивает в страницу, но если какой-то в
   * поставке не оказалось (плитки стартового экрана пришли без своих JPG),
   * вместо неё WebView рисует значок сломанного файла. Пустое место читается
   * лучше: подпись плитки остаётся, пропадает только испорченная картинка.
   * Ошибка загрузки картинки не всплывает, поэтому ловим её на погружении.
   */
  document.addEventListener(
    'error',
    function (event) {
      var target = event.target;
      if (target && target.tagName === 'IMG') target.style.visibility = 'hidden';
    },
    true
  );
})();
