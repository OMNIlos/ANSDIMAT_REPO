/**
 * Сквозная проверка синхронизации на живом приложении
 *
 * Сценарий ровно тот, ради которого нужен аккаунт: журнал заведён на одном
 * устройстве и открывается на другом. Два независимых браузерных контекста
 * играют роль телефона и планшета — у каждого своя локальная база и своя
 * сессия.
 *
 * Перед запуском нужны работающие Supabase и веб-сборка приложения:
 *   npx supabase start
 *   npx expo start --web
 *   CHROME_PATH=... node supabase/tests/e2e-sync.test.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright-core'));

const APP = 'http://localhost:8081';
const EMAIL = `mvp-${Date.now()}@example.com`;
const PASSWORD = 'test-password-123';

// Хелперы внедряются строкой: замыкания между вложенными функциями при
// сериализации в страницу теряются, поэтому каждая самодостаточна
const HELPERS = `
(() => {
  const fire = (el) => {
    const r = el.getBoundingClientRect();
    const o = {bubbles:true,cancelable:true,composed:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,
               button:0,buttons:1,pointerId:1,pointerType:'mouse',isPrimary:true,detail:1};
    el.dispatchEvent(new PointerEvent('pointerdown',o));
    el.dispatchEvent(new PointerEvent('pointerup',Object.assign({},o,{buttons:0})));
    el.dispatchEvent(new MouseEvent('click',Object.assign({},o,{buttons:0})));
  };
  const vis = (e) => e.getBoundingClientRect().width > 0;
  window.__tap = (label) => {
    const el = Array.from(document.querySelectorAll('[aria-label]'))
      .filter((e) => e.getAttribute('aria-label') === label && vis(e)).pop();
    if (!el) return 'нет: ' + label; fire(el); return 'ok';
  };
  window.__tapText = (re) => {
    const rx = new RegExp(re);
    const el = Array.from(document.querySelectorAll('[role="button"],button,[role="tab"]'))
      .filter((e) => rx.test((e.textContent||'').trim()) && vis(e)).pop();
    if (!el) return 'нет: ' + re; fire(el); return 'ok';
  };
  window.__tapCard = (part) => {
    const node = Array.from(document.querySelectorAll('*'))
      .filter((e) => e.children.length===0 && e.textContent.includes(part) && vis(e))[0];
    if (!node) return 'нет карточки: ' + part;
    let el = node;
    for (let i=0;i<8&&el;i++,el=el.parentElement) {
      if (el.getAttribute && el.getAttribute('role')==='button') { fire(el); return 'ok'; }
    }
    fire(node); return 'ok';
  };
  window.__fill = (placeholderRe, value) => {
    const rx = new RegExp(placeholderRe, 'i');
    const i = Array.from(document.querySelectorAll('input')).filter((x) => rx.test(x.placeholder||'') && vis(x)).pop();
    if (!i) return 'нет поля: ' + placeholderRe;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    set.call(i, value); i.dispatchEvent(new Event('input',{bubbles:true}));
    return 'ok';
  };
  window.__fillPassword = (value) => {
    const i = Array.from(document.querySelectorAll('input')).filter((x) => x.type === 'password' && vis(x))[0];
    if (!i) return 'нет поля пароля';
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    set.call(i, value); i.dispatchEvent(new Event('input',{bubbles:true}));
    return 'ok';
  };
  window.__text = () => document.body.innerText;
})();
`;

let failures = 0;
const check = (name, ok, detail='') => {
  if (ok) console.log('  ✓ ' + name);
  else { failures++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });

  // ── Устройство 1: регистрация и журнал
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p1 = await ctx1.newPage();
  await p1.goto(APP, { timeout: 90000 });
  await p1.waitForTimeout(14000);
  await p1.evaluate(HELPERS);

  console.log('Устройство 1: регистрация');
  await p1.evaluate(() => __tap('Настройки'));
  await p1.waitForTimeout(1800);
  const toAuth = await p1.evaluate(() => __tapCard('Войти в аккаунт'));
  await p1.waitForTimeout(2500);
  console.log('    переход на вход: ' + toAuth + ', заголовок: ' + (await p1.title()));
  await p1.evaluate(() => __tapText('^Регистрация$'));
  await p1.waitForTimeout(900);
  await p1.evaluate(([e]) => __fill('example.com', e), [EMAIL]);
  const pwd1 = await p1.evaluate(([pw]) => __fillPassword(pw), [PASSWORD]);
  if (pwd1 !== 'ok') console.log('    (пароль: ' + pwd1 + ')');
  await p1.waitForTimeout(500);
  await p1.evaluate(() => __tap('Зарегистрироваться'));
  await p1.waitForTimeout(7000);

  const afterSignup = await p1.evaluate(() => __text());
  check('регистрация прошла', !/Неверные|ошибк|Ошибк/i.test(afterSignup), afterSignup.slice(0, 120));

  console.log('\nУстройство 1: журнал');
  await p1.evaluate(() => __tap('Главная'));
  await p1.waitForTimeout(1600);
  await p1.evaluate(() => __tap('Создать откачку'));
  await p1.waitForTimeout(2200);
  await p1.evaluate(() => __fill('название проекта', 'Скв. 12 — синхронизация'));
  await p1.waitForTimeout(400);
  await p1.evaluate(() => __tapText('^Создать'));
  await p1.waitForTimeout(2500);

  await p1.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')].filter((i) => i.getBoundingClientRect().width > 0);
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    set.call(inputs[0], '864'); inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
  });
  await p1.waitForTimeout(1500);

  console.log('\nУстройство 1: синхронизация');
  await p1.evaluate(() => __tap('Настройки'));
  await p1.waitForTimeout(1800);
  await p1.evaluate(() => __tapCard('Синхронизация, пароль'));
  await p1.waitForTimeout(2500);
  const accountText = await p1.evaluate(() => __text());
  check("экран аккаунта открылся", /синхронизация/i.test(accountText), accountText.slice(0, 100));

  await p1.evaluate(() => __tap('Синхронизировать'));
  await p1.waitForTimeout(6000);
  const synced = await p1.evaluate(() => __text());
  check('обмен прошёл без ошибок', /актуальны|Готово к обмену/.test(synced) && !/Не удалось/.test(synced),
    synced.match(/Последний обмен[^\n]*/)?.[0] ?? synced.slice(0, 150));

  // ── Устройство 2: вход и получение данных
  console.log('\nУстройство 2: вход в тот же аккаунт');
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto(APP, { timeout: 90000 });
  await p2.waitForTimeout(14000);
  await p2.evaluate(HELPERS);

  const before = await p2.evaluate(() => { __tap('Создать откачку'); return 1; });
  await p2.waitForTimeout(2500);
  const emptyList = await p2.evaluate(() => __text());
  check('на втором устройстве журналов нет', /Нет проектов|РАНЕЕ СОЗДАННЫЕ · 0/.test(emptyList));

  await p2.evaluate(() => __tap('Настройки'));
  await p2.waitForTimeout(1800);
  await p2.evaluate(() => __tapCard('Войти в аккаунт'));
  await p2.waitForTimeout(2200);
  await p2.evaluate(([e]) => __fill('example.com', e), [EMAIL]);
  const pwd2 = await p2.evaluate(([pw]) => __fillPassword(pw), [PASSWORD]);
  if (pwd2 !== 'ok') console.log('    (пароль: ' + pwd2 + ')');
  await p2.waitForTimeout(500);
  await p2.evaluate(() => __tap('Войти'));
  await p2.waitForTimeout(9000);

  await p2.evaluate(() => __tap('Главная'));
  await p2.waitForTimeout(1600);
  await p2.evaluate(() => __tap('Создать откачку'));
  await p2.waitForTimeout(3500);
  const list2 = await p2.evaluate(() => __text());
  check('журнал приехал с первого устройства', /Скв\. 12 — синхронизация/.test(list2),
    list2.match(/РАНЕЕ СОЗДАННЫЕ[^\n]*/)?.[0] ?? list2.slice(0, 150));

    await browser.close();
  console.log('\n' + (failures ? `ПРОВАЛОВ: ${failures}` : 'Сквозная проверка пройдена.'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
