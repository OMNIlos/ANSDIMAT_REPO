/**
 * Съёмка экранов приложения для презентации
 *
 * Скриншоты снимаются в тройном разрешении (1170 × 2532): в мокапе экран
 * телефона занимает 300–400 px, и кадр 1× при масштабировании выглядит мылом.
 *
 * Перед запуском должен работать веб-сервер приложения:
 *   npx expo start --web
 *
 * Запуск: node presentation/capture.js
 */

const path = require('path');
const { chromium } = require('playwright-core');

const APP = process.env.APP_URL || 'http://localhost:8081';
const OUT = path.join(__dirname, 'screens');

/** Демонстрационная откачка: T = 158,13 м²/сут при Q = 864 м³/сут */
const PUMPING = [
  [1, 0.62], [2, 0.92], [5, 1.32], [10, 1.62], [30, 2.1],
  [60, 2.4], [120, 2.7], [240, 3.0], [480, 3.3],
];

/** Восстановление того же опыта: откачка длилась 480 мин */
const RECOVERY = [
  [490, 1.69], [500, 1.4], [540, 0.95], [600, 0.7],
  [720, 0.48], [960, 0.3], [1440, 0.18],
];

/** Точки полевого дневника: окраина Петербурга, все на суше */
const POINTS = [
  ['Скв. 12', 'Скважина', 205, 100],
  ['Родник Р-2', 'Родник', 292, 168],
  ['Шурф Ш-1', 'Шурф', 108, 186],
];

/**
 * Хелперы, внедряемые в страницу
 *
 * React Native Web не реагирует на обычный click: нужен полный набор
 * pointer-событий с pointerType и isPrimary.
 */
function installHelpers() {
  const fire = (el) => {
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true, cancelable: true, composed: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, detail: 1,
    };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...o, buttons: 0 }));
  };
  const visible = (e) => e.getBoundingClientRect().width > 0;

  window.__tap = (label) => {
    const el = [...document.querySelectorAll('[aria-label]')]
      .filter((e) => e.getAttribute('aria-label') === label && visible(e)).pop();
    if (!el) return 'нет: ' + label;
    fire(el);
    return 'ok';
  };
  window.__tapText = (re) => {
    const rx = new RegExp(re);
    const el = [...document.querySelectorAll('[role="button"],button,[role="tab"],[role="radio"],[role="link"]')]
      .filter((e) => rx.test((e.textContent || '').trim()) && visible(e)).pop();
    if (!el) return 'нет: ' + re;
    fire(el);
    return 'ok';
  };
  window.__openProject = (namePart) => {
    const node = [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && e.textContent.includes(namePart) && visible(e))[0];
    if (!node) return 'нет проекта: ' + namePart;

    // Журнал открывается нажатием на саму карточку. Раньше здесь искалась
    // кнопка [aria-label="Обработка"] — её убрали вместе с дублирующей
    // иконкой, и все снимки журнала выходили копией списка
    let card = node;
    for (let i = 0; i < 6 && card; i++, card = card.parentElement) {
      if (card.getAttribute && card.getAttribute('aria-label') === namePartFull(node, namePart)) {
        fire(card);
        return 'ok';
      }
    }

    // Запасной путь: ближайший предок с ролью кнопки
    card = node;
    for (let i = 0; i < 6 && card; i++, card = card.parentElement) {
      if (card.getAttribute && card.getAttribute('role') === 'button') {
        fire(card);
        return 'ok';
      }
    }
    return 'не удалось открыть журнал: ' + namePart;
  };

  /** Полное название журнала из подписи карточки */
  function namePartFull(node, part) {
    const text = (node.textContent || '').trim();
    return text.includes(part) ? text : part;
  }
  /**
   * Нажимает карточку по фрагменту текста внутри неё
   *
   * `__tapText` ищет элементы, чей текст целиком совпадает с шаблоном, и не
   * годится для карточек: там подпись лежит в отдельном узле, а кликается
   * контейнер выше по дереву.
   */
  window.__tapCard = (part) => {
    const node = [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && e.textContent.includes(part) && visible(e))[0];
    if (!node) return 'нет карточки: ' + part;
    let el = node;
    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
      if (el.getAttribute && el.getAttribute('role') === 'button') { fire(el); return 'ok'; }
    }
    fire(node);
    return 'ok (по тексту)';
  };
  window.__setField = (index, value) => {
    const inputs = [...document.querySelectorAll('input')].filter(visible);
    const input = inputs[index];
    if (!input) return 'нет поля ' + index;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  };
  window.__setNamed = (placeholderRe, value) => {
    const rx = new RegExp(placeholderRe, 'i');
    const input = [...document.querySelectorAll('input')].filter((i) => rx.test(i.placeholder || '') && visible(i)).pop();
    if (!input) return 'нет поля';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  };
  window.__count = (re) => (document.body.innerText.match(new RegExp(re)) || ['—'])[0];
}

/**
 * Прокручивает страницу колесом: ScrollView в RN Web не поддаётся scrollTop
 *
 * @param {Object} page - страница Playwright
 * @param {number} steps - число шагов прокрутки
 */
async function wheel(page, steps) {
  await page.mouse.move(195, 500);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(130);
  }
  await page.waitForTimeout(500);
}

/**
 * Заводит демонстрационные данные, если их ещё нет
 *
 * @param {Object} page - страница Playwright
 */
async function seed(page) {
  await page.evaluate(() => __tap('Создать откачку'));
  await page.waitForTimeout(2500);

  const has = await page.evaluate(() => document.body.innerText.includes('кустовая откачка'));
  if (has) return;

  // Журнал откачки
  await page.evaluate(() => __setNamed('название журнала|название проекта|Например', 'Скв. 12 — кустовая откачка'));
  await page.waitForTimeout(300);
  await page.evaluate(() => __tapText('^Создать'));
  await page.waitForTimeout(2500);

  for (let i = 0; i < PUMPING.length; i++) {
    await page.evaluate(() => __tapText('Добавить замер'));
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(600);
  await page.evaluate(() => __setField(0, 864));
  for (let i = 0; i < PUMPING.length; i++) {
    await page.evaluate(([idx, row]) => { __setField(1 + idx * 2, row[0]); __setField(2 + idx * 2, row[1]); }, [i, PUMPING[i]]);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1500);

  // Журнал восстановления
  await page.evaluate(() => __tap('Главная'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => __tap('Создать откачку'));
  await page.waitForTimeout(2000);
  await page.evaluate(() => __setNamed('название журнала|название проекта|Например', 'Скв. 12 — восстановление уровня'));
  await page.waitForTimeout(300);
  await page.evaluate(() => __tapText('^Создать'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => __tapText('^Восстановление$'));
  await page.waitForTimeout(1200);

  for (let i = 0; i < RECOVERY.length; i++) {
    await page.evaluate(() => __tapText('Добавить замер'));
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(700);
  await page.evaluate(() => { __setField(0, 864); __setField(1, 480); });
  for (let i = 0; i < RECOVERY.length; i++) {
    await page.evaluate(([idx, row]) => { __setField(2 + idx * 2, row[0]); __setField(3 + idx * 2, row[1]); }, [i, RECOVERY[i]]);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1500);

  // Точки полевого дневника
  await page.evaluate(() => __tap('Главная'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => __tap('Полевой дневник'));
  await page.waitForTimeout(6000);
  await page.evaluate(() => __tap('Показать моё местоположение на карте'));
  await page.waitForTimeout(5000);
  await wheel(page, 0);
  await page.mouse.move(195, 195);
  for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(900); }
  await page.waitForTimeout(2500);

  const frame = page.frames().find((f) => f !== page.mainFrame());
  for (const [name, type, x, y] of POINTS) {
    await page.evaluate((n) => __setNamed('Название точки', n), name);
    await page.waitForTimeout(300);
    await page.evaluate((t) => __tapText('^' + t + '$'), type);
    await page.waitForTimeout(300);
    await frame.locator('#map').click({ position: { x, y } });
    await page.waitForTimeout(1400);
  }
}

/**
 * Снимает весь набор экранов
 */
async function main() {
  // Берём уже установленный браузер: playwright-core своих не скачивает,
  // а в кэше лежит сборка, которой пользуется MCP-сервер
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    permissions: ['geolocation'],
    geolocation: { latitude: 59.716, longitude: 30.396 },
    locale: 'ru-RU',
  });
  const page = await ctx.newPage();

  await page.goto(APP, { timeout: 90000 });
  await page.waitForTimeout(15000);
  await page.evaluate(installHelpers);

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name), type: 'png' });
    process.stdout.write('  ' + name + '\n');
  };
  const home = async () => { await page.evaluate(() => __tap('Главная')); await page.waitForTimeout(1600); };

  await seed(page);
  await page.evaluate(installHelpers);
  await home();

  console.log('Снимаю экраны:');
  await shot('01-home.png');

  await page.evaluate(() => __tap('Создать откачку'));
  await page.waitForTimeout(2500);
  await shot('02-projects.png');

  await page.evaluate(() => __openProject('кустовая откачка'));
  await page.waitForTimeout(3000);
  await shot('03-journal.png');
  await wheel(page, 8);
  await shot('04-chart.png');

  await home();
  await page.evaluate(() => __tap('Создать откачку'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => __openProject('восстановление уровня'));
  await page.waitForTimeout(3000);
  // Экран всегда открывается в фазе откачки: без переключения на графике
  // окажутся замеры восстановления, обсчитанные не тем методом
  await page.evaluate(() => __tapText('^Восстановление$'));
  await page.waitForTimeout(1800);
  await wheel(page, 7);
  await shot('15-recovery.png');

  await home();
  await page.evaluate(() => __tap('Калькулятор'));
  await page.waitForTimeout(2500);
  await shot('05-calculator.png');
  await page.evaluate(() => __tapText('^Барраж$'));
  await page.waitForTimeout(1500);
  await shot('06-barrage.png');
  await page.evaluate(() => __tapText('^Утечки$'));
  await page.waitForTimeout(1500);
  await shot('07-leakage.png');

  await home();
  await page.evaluate(() => __tap('Полевой дневник'));
  await page.waitForTimeout(7000);
  // Карта открывается на центре города: подводим её к точкам на окраине,
  // иначе в кадре пустой центр Петербурга, а маркеры за границей экрана
  await page.evaluate(() => __tap('Показать моё местоположение на карте'));
  await page.waitForTimeout(5000);
  await page.mouse.move(195, 195);
  for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(900); }
  await page.waitForTimeout(3000);
  await shot('08-diary.png');

  await home();
  await page.evaluate(() => __tap('Примеры и видео'));
  await page.waitForTimeout(6000);
  await shot('09-videos.png');

  await page.evaluate(() => __tap('Справка'));
  await page.waitForTimeout(2200);
  await shot('10-about.png');
  await page.evaluate(() => __tap('Руководство пользователя'));
  await page.waitForTimeout(2500);
  await shot('11-manual.png');

  await page.evaluate(() => __tap('Настройки'));
  await page.waitForTimeout(2200);
  await shot('12-settings.png');

  const sub = await page.evaluate(() => __tapCard('Базовая версия'));
  await page.waitForTimeout(2800);
  if (!/Подписка/.test(await page.title())) throw new Error('не открылась подписка: ' + sub);
  await shot('13-subscription.png');

  await page.evaluate(() => __tap('Настройки'));
  await page.waitForTimeout(2200);
  const auth = await page.evaluate(() => __tapCard('Войти в аккаунт'));
  await page.waitForTimeout(2800);
  if (!/Аккаунт/.test(await page.title())) throw new Error('не открылся вход: ' + auth);
  await shot('14-auth.png');

  await ctx.close();
  await browser.close();
  console.log('Готово.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
